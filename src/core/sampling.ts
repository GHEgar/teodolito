import { getDistance } from 'ol/sphere.js';

export type LonLat = readonly [number, number];

export interface Sample {
    readonly lonLat: LonLat;
    readonly distance: number;
    readonly vertex: number | null;
}

export interface SampleOptions {
    step?: number;
    maxSamples?: number;
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180;
const degrees = (value: number): number => (value * 180) / Math.PI;
const distance = (a: LonLat, b: LonLat): number => getDistance([a[0], a[1]], [b[0], b[1]]);

export function unit([lon, lat]: LonLat): [number, number, number] {
    const phi = radians(lat);
    const lambda = radians(lon);
    return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
}

export function interpolate(a: LonLat, b: LonLat, fraction: number): LonLat {
    const p = unit(a);
    const q = unit(b);
    const dot = Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]));
    const angle = Math.acos(dot);
    if (angle < 1e-12) return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
    const wa = Math.sin((1 - fraction) * angle) / Math.sin(angle);
    const wb = Math.sin(fraction * angle) / Math.sin(angle);
    const x = wa * p[0] + wb * q[0];
    const y = wa * p[1] + wb * q[1];
    const z = wa * p[2] + wb * q[2];
    return [degrees(Math.atan2(y, x)), degrees(Math.atan2(z, Math.hypot(x, y)))];
}

export function sampleLine(coordinates: readonly LonLat[], options: SampleOptions = {}): Sample[] {
    if (coordinates.length === 0) return [];
    const first = coordinates[0] as LonLat;
    const samples: Sample[] = [{ lonLat: first, distance: 0, vertex: 0 }];
    if (coordinates.length === 1) return samples;
    const lengths = coordinates.slice(1).map((point, i) => distance(coordinates[i] as LonLat, point));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    const room = (options.maxSamples ?? 512) - coordinates.length;
    const floor = room > 0 ? total / room : Number.POSITIVE_INFINITY;
    const step = Math.max(options.step ?? 0, floor);
    let travelled = 0;
    lengths.forEach((length, i) => {
        const a = coordinates[i] as LonLat;
        const b = coordinates[i + 1] as LonLat;
        const pieces = step > 0 && Number.isFinite(step) ? Math.max(1, Math.ceil(length / step)) : 1;
        for (let k = 1; k < pieces; k += 1) {
            const fraction = k / pieces;
            samples.push({ lonLat: interpolate(a, b, fraction), distance: travelled + length * fraction, vertex: null });
        }
        travelled += length;
        samples.push({ lonLat: b, distance: travelled, vertex: i + 1 });
    });
    return samples;
}
