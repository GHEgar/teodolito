import type { Coordinate } from 'ol/coordinate.js';
import Polygon, { circular } from 'ol/geom/Polygon.js';
import type SimpleGeometry from 'ol/geom/SimpleGeometry.js';
import type { GeometryFunction } from 'ol/interaction/Draw.js';
import { toLonLat, type ProjectionLike } from 'ol/proj.js';
import { getDistance } from 'ol/sphere.js';
import { unit, type LonLat } from './sampling.js';

export type Shape =
    | { readonly type: 'circle'; readonly center: LonLat; readonly radius: number }
    | { readonly type: 'rectangle'; readonly width: number; readonly height: number };

const lonLatOf = (coordinate: Coordinate, projection: ProjectionLike): [number, number] => {
    const [lon = 0, lat = 0] = toLonLat(coordinate, projection);
    return [lon, lat];
};

export function circleGeometry(sides: number): GeometryFunction {
    return (coordinates, geometry, projection) => {
        const line = coordinates as Coordinate[];
        const center = lonLatOf(line[0] as Coordinate, projection);
        const edge = lonLatOf(line[line.length - 1] as Coordinate, projection);
        const polygon = circular(center, getDistance(center, edge), sides).transform('EPSG:4326', projection) as Polygon;
        if (!geometry) return polygon;
        (geometry as SimpleGeometry & Polygon).setCoordinates(polygon.getCoordinates());
        return geometry;
    };
}

export function circleShape(ring: readonly LonLat[]): Shape | null {
    if (ring.length < 3) return null;
    const sum = ring.map(unit).reduce((acc, v) => [acc[0] + v[0], acc[1] + v[1], acc[2] + v[2]], [0, 0, 0]);
    const center: [number, number] = [
        (Math.atan2(sum[1], sum[0]) * 180) / Math.PI,
        (Math.atan2(sum[2], Math.hypot(sum[0], sum[1])) * 180) / Math.PI,
    ];
    const radius = ring.reduce((acc, point) => acc + getDistance(center, [point[0], point[1]]), 0) / ring.length;
    return { type: 'circle', center, radius };
}

export function rectangleShape(ring: readonly LonLat[]): Shape | null {
    if (ring.length !== 4) return null;
    const [a, b, c, d] = ring.map((point): [number, number] => [point[0], point[1]]) as [number, number][];
    if (!a || !b || !c || !d) return null;
    return {
        type: 'rectangle',
        width: (getDistance(a, b) + getDistance(d, c)) / 2,
        height: (getDistance(b, c) + getDistance(a, d)) / 2,
    };
}

export const openRing = (polygon: Polygon, projection: ProjectionLike): LonLat[] => {
    const ring = polygon.getCoordinates()[0] ?? [];
    return ring.slice(0, -1).map((coordinate) => lonLatOf(coordinate, projection));
};
