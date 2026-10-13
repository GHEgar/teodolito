import type { Coordinate } from 'ol/coordinate.js';
import { getCenter } from 'ol/extent.js';
import type Geometry from 'ol/geom/Geometry.js';
import Polygon, { circular } from 'ol/geom/Polygon.js';
import type SimpleGeometry from 'ol/geom/SimpleGeometry.js';
import { fromLonLat, toLonLat, type ProjectionLike } from 'ol/proj.js';
import { circleShape, openRing } from './shapes.js';
import type { Kind } from './types.js';

export const pointLike = (kind: Kind): boolean => kind === 'point' || kind === 'text' || kind === 'symbol';
export const styled = (kind: Kind): boolean => kind === 'text' || kind === 'symbol';

export function centerOf(kind: Kind, geometry: Geometry, projection: ProjectionLike): Coordinate {
    if (kind === 'circle') {
        const shape = circleShape(openRing(geometry as Polygon, projection));
        if (shape?.type === 'circle') return fromLonLat([...shape.center], projection);
    }
    return getCenter(geometry.getExtent());
}

export function circleRadius(geometry: Geometry, projection: ProjectionLike): number | null {
    const shape = circleShape(openRing(geometry as Polygon, projection));
    return shape?.type === 'circle' ? shape.radius : null;
}

export function setCircle(geometry: Geometry, center: Coordinate, radius: number, projection: ProjectionLike, sides: number): void {
    const [lon = 0, lat = 0] = toLonLat(center, projection);
    const polygon = circular([lon, lat], Math.max(0, radius), sides).transform('EPSG:4326', projection) as Polygon;
    (geometry as Polygon).setCoordinates(polygon.getCoordinates());
}

export function rotateGeometry(kind: Kind, geometry: Geometry, angle: number, anchor: Coordinate): boolean {
    if (kind === 'circle' || pointLike(kind) || angle === 0) return false;
    (geometry as SimpleGeometry).rotate(angle, anchor);
    return true;
}

export function scaleGeometry(
    kind: Kind,
    geometry: Geometry,
    factor: number,
    anchor: Coordinate,
    projection: ProjectionLike,
    sides: number,
): boolean {
    if (pointLike(kind) || !(factor > 0) || factor === 1) return false;
    if (kind === 'circle') {
        const radius = circleRadius(geometry, projection);
        if (radius === null) return false;
        setCircle(geometry, centerOf(kind, geometry, projection), radius * factor, projection, sides);
        return true;
    }
    (geometry as SimpleGeometry).scale(factor, factor, anchor);
    return true;
}

const sub = (a: Coordinate, b: Coordinate): [number, number] => [(a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0)];
const dot = (a: [number, number], b: [number, number]): number => a[0] * b[0] + a[1] * b[1];
const unitOf = (v: [number, number]): [number, number] => {
    const length = Math.hypot(v[0], v[1]) || 1;
    return [v[0] / length, v[1] / length];
};

export function rectangleCorners(geometry: Geometry): Coordinate[] {
    return ((geometry as Polygon).getCoordinates()[0] ?? []).slice(0, 4);
}

export function resizeRectangle(start: Coordinate[], corner: number, target: Coordinate): Coordinate[][] {
    const [p0, p1, , p3] = start as [Coordinate, Coordinate, Coordinate, Coordinate];
    const opposite = start[(corner + 2) % 4] as Coordinate;
    const u = unitOf(sub(p1, p0));
    const v = unitOf(sub(p3, p0));
    const drag = sub(target, opposite);
    const du = dot(drag, u);
    const dv = dot(drag, v);
    const width = Math.hypot(...sub(p1, p0)) || 1;
    const height = Math.hypot(...sub(p3, p0)) || 1;
    const corners = start.map((point) => {
        const local = sub(point, opposite);
        const a = Math.abs(dot(local, u)) > width / 2 ? du : 0;
        const b = Math.abs(dot(local, v)) > height / 2 ? dv : 0;
        return [(opposite[0] ?? 0) + a * u[0] + b * v[0], (opposite[1] ?? 0) + a * u[1] + b * v[1]];
    });
    return [[...corners, corners[0] as Coordinate]];
}

export const clamp = (value: number, [low, high]: readonly [number, number]): number => Math.min(high, Math.max(low, value));
