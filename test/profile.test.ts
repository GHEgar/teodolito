import LineString from 'ol/geom/LineString.js';
import { fromLonLat } from 'ol/proj.js';
import { getDistance } from 'ol/sphere.js';
import { describe, expect, it, vi } from 'vitest';
import {
    buildProfile, computeProfile, formatElevation, interpolate, requestElevations, sampleLine,
    type ElevationProvider, type LonLat,
} from '../src/core/index.js';

const line: LonLat[] = [[0, 0], [0.01, 0], [0.01, 0.01]];
const fixed = (elevation: (lonLat: LonLat) => number | null, maxPoints?: number): ElevationProvider => ({
    getElevations: vi.fn(async (points: readonly LonLat[]) => points.map(elevation)),
    ...(maxPoints ? { maxPoints } : {}),
});

describe('sampleLine', () => {
    it('incluye los vértices con su índice y distancias crecientes', () => {
        const samples = sampleLine(line, { step: 100 });
        expect(samples[0]).toEqual({ lonLat: [0, 0], distance: 0, vertex: 0 });
        expect(samples.filter((s) => s.vertex !== null).map((s) => s.vertex)).toEqual([0, 1, 2]);
        const total = getDistance([0, 0], [0.01, 0]) + getDistance([0.01, 0], [0.01, 0.01]);
        expect(samples[samples.length - 1]?.distance).toBeCloseTo(total, 6);
        samples.slice(1).forEach((s, i) => expect(s.distance).toBeGreaterThan(samples[i]?.distance ?? 0));
        expect(samples.length).toBe(1 + 12 + 12);
    });

    it('respeta el tope de muestras', () => {
        expect(sampleLine(line, { step: 1, maxSamples: 50 }).length).toBeLessThanOrEqual(50);
        expect(sampleLine(line).length).toBeLessThanOrEqual(512);
        expect(sampleLine(line, { maxSamples: 2 })).toHaveLength(3);
    });

    it('casos degenerados', () => {
        expect(sampleLine([])).toEqual([]);
        expect(sampleLine([[1, 2]])).toEqual([{ lonLat: [1, 2], distance: 0, vertex: 0 }]);
        expect(sampleLine([[1, 2], [1, 2]]).map((s) => s.distance)).toEqual([0, 0]);
    });

    it('interpola sobre el gran círculo', () => {
        const middle = interpolate([-90, 45], [90, 45], 0.5);
        expect(middle[1]).toBeCloseTo(90, 6);
        const point = interpolate([0, 0], [10, 0], 0.25);
        expect(point[0]).toBeCloseTo(2.5, 9);
        expect(point[1]).toBeCloseTo(0, 9);
    });
});

describe('buildProfile', () => {
    const samples = sampleLine([[0, 0], [0.004, 0]], { step: 120 });

    it('calcula subida, bajada, extremos y longitud sobre el relieve', () => {
        const profile = buildProfile(samples, [100, 150, 120, 130, 90]);
        expect(profile.ascent).toBe(60);
        expect(profile.descent).toBe(70);
        expect(profile.netChange).toBe(-10);
        expect(profile.max).toMatchObject({ elevation: 150, distance: samples[1]?.distance });
        expect(profile.min?.elevation).toBe(90);
        expect(profile.surfaceLength).toBeGreaterThan(profile.length);
        expect(profile.missing).toBe(0);
    });

    it('puentea los huecos y los cuenta', () => {
        const profile = buildProfile(samples, [null, 100, null, Number.NaN, 140]);
        expect(profile.missing).toBe(3);
        expect(profile.ascent).toBe(40);
        expect(profile.netChange).toBe(40);
        expect(profile.points[0]?.elevation).toBeNull();
        const run = (samples[4]?.distance ?? 0) - (samples[1]?.distance ?? 0);
        expect(profile.surfaceLength).toBeCloseTo(profile.length + Math.hypot(run, 40) - run, 9);
    });

    it('sin alturas no hay extremos', () => {
        const profile = buildProfile(samples, samples.map(() => null));
        expect(profile).toMatchObject({ max: null, min: null, netChange: null, ascent: 0, surfaceLength: profile.length });
    });

    it('perfil plano', () => {
        const profile = buildProfile(samples, samples.map(() => 5));
        expect(profile).toMatchObject({ ascent: 0, descent: 0, netChange: 0, surfaceLength: profile.length });
    });

    it('rechaza longitudes distintas', () => {
        expect(() => buildProfile(samples, [1])).toThrow();
    });
});

describe('requestElevations y computeProfile', () => {
    it('parte en lotes según maxPoints', async () => {
        const provider = fixed(([lon]) => lon * 1000, 2);
        const points: LonLat[] = [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]];
        expect(await requestElevations(provider, points)).toEqual([1000, 2000, 3000, 4000, 5000]);
        expect(provider.getElevations).toHaveBeenCalledTimes(3);
    });

    it('falla si el proveedor devuelve otra cantidad', async () => {
        const provider: ElevationProvider = { getElevations: async () => [1] };
        await expect(requestElevations(provider, [[0, 0], [1, 1]])).rejects.toThrow(/1 alturas para 2/);
    });

    it('se cancela con el signal', async () => {
        const controller = new AbortController();
        const provider = fixed(() => { controller.abort(); return 1; }, 1);
        await expect(requestElevations(provider, [[0, 0], [1, 1]], { signal: controller.signal })).rejects.toThrow();
        expect(provider.getElevations).toHaveBeenCalledTimes(1);
    });

    it('arma el perfil de una LineString proyectada', async () => {
        const geometry = new LineString([fromLonLat([0, 0]), fromLonLat([0.01, 0])]);
        const profile = await computeProfile(geometry, fixed(([lon]) => lon * 10_000), { step: 200 });
        expect(profile.points[0]?.lonLat[0]).toBeCloseTo(0, 9);
        expect(profile.length).toBeCloseTo(getDistance([0, 0], [0.01, 0]), 3);
        expect(profile.ascent).toBeCloseTo(100, 6);
        expect(profile.max?.elevation).toBeCloseTo(100, 6);
    });
});

describe('formatElevation', () => {
    it('redondea a metros con el locale', () => {
        expect(formatElevation(1523.4, { locale: 'es-MX' })).toBe('1,523 m');
        expect(formatElevation(12.345, { maximumFractionDigits: 1 })).toBe('12.3 m');
    });
});
