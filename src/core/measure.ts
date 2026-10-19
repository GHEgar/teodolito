import type { Coordinate } from 'ol/coordinate.js';
import type Geometry from 'ol/geom/Geometry.js';
import type LineString from 'ol/geom/LineString.js';
import type Polygon from 'ol/geom/Polygon.js';
import type { ProjectionLike } from 'ol/proj.js';
import { toLonLat } from 'ol/proj.js';
import { getArea, getLength } from 'ol/sphere.js';
import { measureSegments, noSegments, type Angle, type Segment } from './segments.js';
import { circleShape, openRing, rectangleShape, type Shape } from './shapes.js';
import type { Kind } from './types.js';

export type Measure =
    | { kind: 'length'; length: number; segments: readonly Segment[]; angles: readonly Angle[] }
    | { kind: 'angle'; degrees: number; length: number; segments: readonly Segment[]; angles: readonly Angle[] }
    | { kind: 'area'; area: number; perimeter: number; segments: readonly Segment[]; angles: readonly Angle[]; shape?: Shape }
    | { kind: 'point'; lonLat: [number, number] }
    | { kind: 'none' };

const withSegments = (kind: Kind | undefined): boolean => kind !== 'freehand' && kind !== 'circle';

function shapeOf(kind: Kind | undefined, polygon: Polygon, projection: ProjectionLike): Shape | null {
    if (kind === 'circle') return circleShape(openRing(polygon, projection));
    if (kind === 'rectangle') return rectangleShape(openRing(polygon, projection));
    return null;
}

export function measureGeometry(geometry: Geometry, projection: ProjectionLike = 'EPSG:3857', kind?: Kind): Measure {
    const options = { projection };
    switch (geometry.getType()) {
        case 'LineString': {
            const coordinates = (geometry as LineString).getCoordinates();
            const details = withSegments(kind) ? measureSegments(coordinates, projection, false) : noSegments;
            const length = getLength(geometry, options);
            const angle = kind === 'angle' ? details.angles[0] : undefined;
            if (angle) return { kind: 'angle', degrees: angle.degrees, length, ...details };
            return { kind: 'length', length, ...details };
        }
        case 'MultiLineString':
            return { kind: 'length', length: getLength(geometry, options), ...noSegments };
        case 'Polygon': {
            const polygon = geometry as Polygon;
            const ring = polygon.getCoordinates()[0] ?? [];
            const details = withSegments(kind) ? measureSegments(ring, projection, true) : noSegments;
            const shape = shapeOf(kind, polygon, projection);
            return {
                kind: 'area', area: getArea(geometry, options), perimeter: getLength(geometry, options), ...details,
                ...(shape ? { shape } : {}),
            };
        }
        case 'MultiPolygon':
            return { kind: 'area', area: getArea(geometry, options), perimeter: getLength(geometry, options), ...noSegments };
        case 'Point': {
            const flat = (geometry as unknown as { getCoordinates(): Coordinate }).getCoordinates();
            const [lon = 0, lat = 0] = toLonLat(flat, projection);
            return { kind: 'point', lonLat: [lon, lat] };
        }
        default:
            return { kind: 'none' };
    }
}
