import type { LonLat, Sample } from './sampling.js';

export interface ProfilePoint extends Sample {
    readonly elevation: number | null;
}

export interface Extreme {
    readonly elevation: number;
    readonly distance: number;
    readonly lonLat: LonLat;
}

export interface Profile {
    readonly points: readonly ProfilePoint[];
    readonly length: number;
    readonly surfaceLength: number;
    readonly ascent: number;
    readonly descent: number;
    readonly netChange: number | null;
    readonly max: Extreme | null;
    readonly min: Extreme | null;
    readonly missing: number;
}

type Known = ProfilePoint & { readonly elevation: number };

const extreme = (point: Known): Extreme => ({ elevation: point.elevation, distance: point.distance, lonLat: point.lonLat });

export function buildProfile(samples: readonly Sample[], elevations: readonly (number | null)[]): Profile {
    if (samples.length !== elevations.length) {
        throw new Error(`teodolito: ${elevations.length} elevations for ${samples.length} samples.`);
    }
    const points = samples.map((sample, i): ProfilePoint => {
        const elevation = elevations[i];
        return { ...sample, elevation: typeof elevation === 'number' && Number.isFinite(elevation) ? elevation : null };
    });
    const known = points.filter((point): point is Known => point.elevation !== null);
    const length = points.length ? (points[points.length - 1] as ProfilePoint).distance : 0;
    let surfaceLength = length;
    let ascent = 0;
    let descent = 0;
    let max: Known | null = null;
    let min: Known | null = null;
    let previous: Known | null = null;
    for (const point of known) {
        if (!max || point.elevation > max.elevation) max = point;
        if (!min || point.elevation < min.elevation) min = point;
        if (previous) {
            const run = point.distance - previous.distance;
            const rise = point.elevation - previous.elevation;
            surfaceLength += Math.hypot(run, rise) - run;
            if (rise > 0) ascent += rise;
            else descent -= rise;
        }
        previous = point;
    }
    const first = known[0];
    const last = known[known.length - 1];
    return {
        points,
        length,
        surfaceLength,
        ascent,
        descent,
        netChange: first && last ? last.elevation - first.elevation : null,
        max: max ? extreme(max) : null,
        min: min ? extreme(min) : null,
        missing: points.length - known.length,
    };
}
