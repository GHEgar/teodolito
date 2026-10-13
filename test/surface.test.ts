import LineString from 'ol/geom/LineString.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import { fromLonLat } from 'ol/proj.js';
import { describe, expect, it } from 'vitest';
import {
    buildGrid, buildSurface, computeElevation, computeSurface, getPointElevation, inPolygon,
    type ElevationProvider, type LonLat,
} from '../src/core/index.js';

const provider = (elevation: (lonLat: LonLat) => number | null): ElevationProvider => ({
    getElevations: async (points) => points.map(elevation),
});
const project = (ring: [number, number][]): number[][] => ring.map((p) => fromLonLat(p));
const square: [number, number][] = [[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]];
const hole: [number, number][] = [[0.003, 0.003], [0.007, 0.003], [0.007, 0.007], [0.003, 0.007], [0.003, 0.003]];

describe('inPolygon y buildGrid', () => {
    it('respeta los agujeros', () => {
        expect(inPolygon([0.001, 0.001], [square, hole])).toBe(true);
        expect(inPolygon([0.005, 0.005], [square, hole])).toBe(false);
        expect(inPolygon([0.02, 0.005], [square])).toBe(false);
    });

    it('arma la rejilla sobre el bbox y agrega los vértices sin cerrar el anillo', () => {
        const grid = buildGrid([square], 4);
        expect(grid.nodes).toHaveLength(25);
        expect(grid.extra).toHaveLength(4);
        expect(buildGrid([], 4).nodes).toEqual([]);
    });
});

describe('computeSurface', () => {
    it('un terreno plano deja el área sobre el relieve igual a la plana', async () => {
        const surface = await computeSurface(new Polygon([project(square)]), provider(() => 1500), { cells: 10 });
        expect(surface.surfaceArea).toBeCloseTo(surface.planarArea, 6);
        expect(surface.planarArea).toBeCloseTo(1_236_000, -4);
        expect(surface).toMatchObject({ mean: 1500, missing: 0 });
        expect(surface.max?.elevation).toBe(1500);
    });

    it('un plano inclinado a 45° multiplica el área por raíz de dos', async () => {
        const meters = (Math.PI / 180) * 6_371_008.8;
        const slope = provider(([lon, lat]) => lon * meters * Math.cos((lat * Math.PI) / 180));
        const surface = await computeSurface(new Polygon([project(square)]), slope, { cells: 20 });
        expect(surface.surfaceArea / surface.planarArea).toBeCloseTo(Math.SQRT2, 3);
    });

    it('deja fuera las alturas del agujero', async () => {
        const terrain = provider((p) => (inPolygon(p, [hole]) ? 1000 : 10));
        const surface = await computeSurface(new Polygon([project(square), project(hole)]), terrain, { cells: 20 });
        expect(surface.max?.elevation).toBe(10);
        expect(surface.planarArea).toBeCloseTo(1_236_000 * 0.84, -4);
    });

    it('curva hipsométrica de mayor a menor, de 0 a 1', async () => {
        const terrain = provider(([lon]) => lon * 100_000);
        const surface = await computeSurface(new Polygon([project(square)]), terrain, { cells: 10, hypsometrySteps: 4 });
        expect(surface.hypsometry.map((step) => step.share)).toEqual([0, 0.25, 0.5, 0.75, 1]);
        expect(surface.hypsometry[0]?.elevation).toBeCloseTo(surface.max?.elevation ?? 0, 6);
        expect(surface.hypsometry[4]?.elevation).toBeCloseTo(surface.min?.elevation ?? 0, 6);
        surface.hypsometry.slice(1).forEach((step, i) => {
            expect(step.elevation).toBeLessThanOrEqual(surface.hypsometry[i]?.elevation ?? 0);
        });
    });

    it('cuenta las alturas faltantes y sigue calculando', async () => {
        const terrain = provider(([lon]) => (lon > 0.005 ? null : 100));
        const surface = await computeSurface(new Polygon([project(square)]), terrain, { cells: 10 });
        expect(surface.missing).toBeGreaterThan(0);
        expect(surface.samples).toBe(buildGrid([square], 10).inside.filter(Boolean).length + 4);
        expect(surface.surfaceArea).toBeCloseTo(surface.planarArea, 6);
    });

    it('sin alturas no hay estadísticas', () => {
        const grid = buildGrid([square], 2);
        const surface = buildSurface(grid, [square], new Array(13).fill(null), 100);
        expect(surface).toMatchObject({ max: null, min: null, mean: null, hypsometry: [], surfaceArea: 100 });
        expect(() => buildSurface(grid, [square], [1], 100)).toThrow();
    });
});

describe('getPointElevation y computeElevation', () => {
    const terrain = provider(([lon]) => lon * 1000);

    it('altura de un punto', async () => {
        expect(await getPointElevation(new Point(fromLonLat([2, 0])), terrain)).toBeCloseTo(2000, 6);
        expect(await getPointElevation(new Point([0, 0]), provider(() => Number.NaN))).toBeNull();
    });

    it('despacha según la geometría', async () => {
        expect((await computeElevation(new Point(fromLonLat([1, 0])), terrain))?.kind).toBe('point');
        const line = new LineString([fromLonLat([0, 0]), fromLonLat([0.01, 0])]);
        expect((await computeElevation(line, terrain))?.kind).toBe('profile');
        expect((await computeElevation(new Polygon([project(square)]), terrain, { cells: 4 }))?.kind).toBe('surface');
        expect(await computeElevation(new MultiPoint([[0, 0]]), terrain)).toBeNull();
    });
});
