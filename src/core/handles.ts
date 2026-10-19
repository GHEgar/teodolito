import type { Coordinate } from 'ol/coordinate.js';
import { getCenter } from 'ol/extent.js';
import Feature from 'ol/Feature.js';
import type Geometry from 'ol/geom/Geometry.js';
import Point from 'ol/geom/Point.js';
import type Polygon from 'ol/geom/Polygon.js';
import type SimpleGeometry from 'ol/geom/SimpleGeometry.js';
import PointerInteraction from 'ol/interaction/Pointer.js';
import VectorLayer from 'ol/layer/Vector.js';
import type OlMap from 'ol/Map.js';
import type MapBrowserEvent from 'ol/MapBrowserEvent.js';
import type { EventsKey } from 'ol/events.js';
import { unByKey } from 'ol/Observable.js';
import type { Pixel } from 'ol/pixel.js';
import { toLonLat, type ProjectionLike } from 'ol/proj.js';
import VectorSource from 'ol/source/Vector.js';
import { getDistance } from 'ol/sphere.js';
import type { StyleLike } from 'ol/style/Style.js';
import type { Commands, Patch } from './commands.js';
import type { Registry } from './registry.js';
import {
    centerOf, clamp, rectangleCorners, resizeRectangle, rotateGeometry, scaleGeometry, setCircle, styled,
} from './transform.js';
import type { Handle, Item } from './types.js';

export interface HandlesDeps {
    map: OlMap;
    registry: Registry;
    commands: Commands;
    recorded<T>(result: T): T;
    update(id: string, patch: Patch): void;
    projection(): ProjectionLike;
    style: StyleLike;
    zIndex: number;
    sides: number;
    limits: readonly [number, number];
    tolerance: number;
}

export interface Handles {
    show(id: string | null): void;
    at(pixel: Pixel): boolean;
    dispose(): void;
}

interface Spot {
    handle: Handle;
    index: number;
    coordinate: Coordinate;
}

interface Drag {
    id: string;
    spot: Spot;
    item: Item;
    start: Coordinate;
    anchor: Coordinate;
    before: Map<string, string>;
    coordinates: unknown;
}

const OFFSET = 28;
const SIZE = 32;
const sub = (a: Coordinate, b: Coordinate): [number, number] => [(a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0)];
const clockwise = (v: [number, number]): number => Math.atan2(v[0], v[1]);

function spotsOf(item: Item, geometry: Geometry, unit: number, projection: ProjectionLike): Spot[] {
    if (styled(item.kind)) {
        const p = (geometry as Point).getCoordinates();
        const r = SIZE * unit * item.scale;
        const [sin, cos] = [Math.sin(item.rotation), Math.cos(item.rotation)];
        return [
            { handle: 'rotate', index: 0, coordinate: [(p[0] ?? 0) + sin * (r + OFFSET * unit), (p[1] ?? 0) + cos * (r + OFFSET * unit)] },
            { handle: 'scale', index: 0, coordinate: [(p[0] ?? 0) + cos * r, (p[1] ?? 0) - sin * r] },
        ];
    }
    if (item.kind === 'circle') {
        const ring = (geometry as Polygon).getCoordinates()[0] ?? [];
        return ring[0] ? [{ handle: 'radius', index: 0, coordinate: ring[0] }] : [];
    }
    if (item.kind === 'rectangle') {
        const corners = rectangleCorners(geometry);
        const [, , c, d] = corners as [Coordinate, Coordinate, Coordinate, Coordinate];
        const center = centerOf(item.kind, geometry, projection);
        const mid: Coordinate = [((c[0] ?? 0) + (d[0] ?? 0)) / 2, ((c[1] ?? 0) + (d[1] ?? 0)) / 2];
        const out = sub(mid, center);
        const length = Math.hypot(...out) || 1;
        const rotate: Coordinate = [(mid[0] ?? 0) + (out[0] / length) * OFFSET * unit, (mid[1] ?? 0) + (out[1] / length) * OFFSET * unit];
        return [
            ...corners.map((coordinate, index): Spot => ({ handle: 'corner', index, coordinate })),
            { handle: 'rotate', index: 0, coordinate: rotate },
        ];
    }
    if (item.kind === 'line' || item.kind === 'angle' || item.kind === 'polygon') {
        const [, , maxX, maxY] = geometry.getExtent() as [number, number, number, number];
        const [cx] = getCenter(geometry.getExtent()) as [number, number];
        return [
            { handle: 'rotate', index: 0, coordinate: [cx, maxY + OFFSET * unit] },
            { handle: 'scale', index: 0, coordinate: [maxX + (OFFSET / 2) * unit, maxY + (OFFSET / 2) * unit] },
        ];
    }
    return [];
}

export function createHandles(deps: HandlesDeps): Handles {
    const { map, registry } = deps;
    const source = new VectorSource<Feature<Geometry>>();
    const layer = new VectorLayer({ source, style: deps.style, zIndex: deps.zIndex, updateWhileInteracting: true });
    let target: string | null = null;
    let spots: Spot[] = [];
    let drag: Drag | null = null;
    let keys: EventsKey[] = [];

    const rebuild = (): void => {
        source.clear(true);
        const item = target ? registry.item(target) : undefined;
        const geometry = target ? registry.feature(target)?.getGeometry() : undefined;
        const unit = map.getView().getResolution() ?? 1;
        spots = item && geometry && item.visible ? spotsOf(item, geometry, unit, deps.projection()) : [];
        source.addFeatures(spots.map((spot) => {
            const feature = new Feature<Geometry>(new Point(spot.coordinate));
            feature.setProperties({ target, handle: spot.handle, index: spot.index }, true);
            return feature;
        }));
    };

    const hit = (pixel: Pixel): Spot | null => spots.find((spot) => {
        const at = map.getPixelFromCoordinate(spot.coordinate);
        return at && Math.hypot((at[0] ?? 0) - (pixel[0] ?? 0), (at[1] ?? 0) - (pixel[1] ?? 0)) <= deps.tolerance;
    }) ?? null;

    const apply = (current: Drag, pointer: Coordinate): void => {
        const geometry = registry.feature(current.id)?.getGeometry() as SimpleGeometry | undefined;
        if (!geometry) return;
        const { item, spot, anchor, start } = current;
        const turn = clockwise(sub(pointer, anchor)) - clockwise(sub(start, anchor));
        const stretch = Math.hypot(...sub(pointer, anchor)) / (Math.hypot(...sub(start, anchor)) || 1);
        if (styled(item.kind)) {
            const patch = spot.handle === 'rotate'
                ? { rotation: item.rotation + turn }
                : { scale: clamp(item.scale * stretch, deps.limits) };
            deps.update(current.id, patch);
            return;
        }
        geometry.setCoordinates(current.coordinates as never);
        if (spot.handle === 'rotate') rotateGeometry(item.kind, geometry, -turn, anchor);
        else if (spot.handle === 'scale') scaleGeometry(item.kind, geometry, stretch, anchor, deps.projection(), deps.sides);
        else if (spot.handle === 'corner') geometry.setCoordinates(resizeRectangle(rectangleCorners(geometry), spot.index, pointer) as never);
        else if (spot.handle === 'radius') {
            const [lon = 0, lat = 0] = toLonLat(anchor, deps.projection());
            const [plon = 0, plat = 0] = toLonLat(pointer, deps.projection());
            setCircle(geometry, anchor, getDistance([lon, lat], [plon, plat]), deps.projection(), deps.sides);
        }
    };

    const interaction = new PointerInteraction({
        handleDownEvent(event: MapBrowserEvent) {
            const spot = target ? hit(event.pixel) : null;
            const item = target ? registry.item(target) : undefined;
            const geometry = target ? registry.feature(target)?.getGeometry() as SimpleGeometry | undefined : undefined;
            if (!spot || !item || !geometry || !target) return false;
            drag = {
                id: target, spot, item, start: spot.coordinate,
                anchor: centerOf(item.kind, geometry, deps.projection()),
                before: deps.commands.snapshotGeometry([target]),
                coordinates: geometry.getCoordinates(),
            };
            return true;
        },
        handleDragEvent(event: MapBrowserEvent) {
            if (drag) apply(drag, event.coordinate);
        },
        handleUpEvent() {
            const done = drag;
            drag = null;
            if (!done) return false;
            if (styled(done.item.kind)) {
                const now = registry.item(done.id);
                if (!now) return false;
                const final = { rotation: now.rotation, scale: now.scale };
                deps.update(done.id, { rotation: done.item.rotation, scale: done.item.scale });
                deps.recorded(deps.commands.update(done.id, final));
            } else {
                deps.recorded(deps.commands.geometry(done.before));
            }
            return false;
        },
    });

    map.addLayer(layer);
    map.addInteraction(interaction);
    const resolutionKey = map.getView().on('change:resolution', rebuild);

    return {
        show(id) {
            unByKey(keys);
            keys = [];
            target = id;
            const feature = id ? registry.feature(id) : undefined;
            if (feature) keys = [feature.on('change', rebuild)];
            rebuild();
        },
        at: (pixel) => hit(pixel) !== null,
        dispose() {
            unByKey(keys);
            unByKey(resolutionKey);
            map.removeInteraction(interaction);
            map.removeLayer(layer);
        },
    };
}
