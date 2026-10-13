import type { Coordinate } from 'ol/coordinate.js';
import { fromLonLat, toLonLat, type ProjectionLike } from 'ol/proj.js';
import { getDistance } from 'ol/sphere.js';
import { interpolate, type LonLat } from './sampling.js';

export interface Segment {
    readonly length: number;
    readonly bearing: number;
    readonly midpoint: Coordinate;
}

export interface Angle {
    readonly vertex: number;
    readonly degrees: number;
    readonly coordinate: Coordinate;
}

export interface Segments {
    readonly segments: readonly Segment[];
    readonly angles: readonly Angle[];
}

export const noSegments: Segments = { segments: [], angles: [] };

const radians = (degrees: number): number => (degrees * Math.PI) / 180;
const normalize = (degrees: number): number => ((degrees % 360) + 360) % 360;

export function bearing(a: LonLat, b: LonLat): number {
    const phi1 = radians(a[1]);
    const phi2 = radians(b[1]);
    const delta = radians(b[0] - a[0]);
    const y = Math.sin(delta) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(delta);
    return normalize((Math.atan2(y, x) * 180) / Math.PI);
}

const lonLatOf = (coordinate: Coordinate, projection: ProjectionLike): LonLat => {
    const [lon = 0, lat = 0] = toLonLat(coordinate, projection);
    return [lon, lat];
};

function signedArea(ring: readonly LonLat[]): number {
    let sum = 0;
    ring.forEach((point, i) => {
        const next = ring[(i + 1) % ring.length] as LonLat;
        sum += point[0] * next[1] - next[0] * point[1];
    });
    return sum / 2;
}

export function measureSegments(coordinates: readonly Coordinate[], projection: ProjectionLike, closed: boolean): Segments {
    const points = closed && coordinates.length > 1 ? coordinates.slice(0, -1) : [...coordinates];
    const lonLats = points.map((point) => lonLatOf(point, projection));
    const count = closed ? lonLats.length : lonLats.length - 1;
    if (count < 1 || (closed && lonLats.length < 3)) return noSegments;
    const segments = Array.from({ length: count }, (_, i): Segment => {
        const a = lonLats[i] as LonLat;
        const b = lonLats[(i + 1) % lonLats.length] as LonLat;
        return {
            length: getDistance([a[0], a[1]], [b[0], b[1]]),
            bearing: bearing(a, b),
            midpoint: fromLonLat([...interpolate(a, b, 0.5)], projection),
        };
    });
    const ccw = signedArea(lonLats) > 0;
    const vertices = closed ? lonLats.map((_, i) => i) : lonLats.slice(1, -1).map((_, i) => i + 1);
    const angles = vertices.map((vertex): Angle => {
        const here = lonLats[vertex] as LonLat;
        const previous = lonLats[(vertex - 1 + lonLats.length) % lonLats.length] as LonLat;
        const next = lonLats[(vertex + 1) % lonLats.length] as LonLat;
        const clockwise = normalize(bearing(here, previous) - bearing(here, next));
        const degrees = closed
            ? (ccw ? 360 - clockwise : clockwise)
            : Math.min(clockwise, 360 - clockwise);
        return { vertex, degrees, coordinate: points[vertex] as Coordinate };
    });
    return { segments, angles };
}
