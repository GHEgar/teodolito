import LineString from 'ol/geom/LineString.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import { fromLonLat } from 'ol/proj.js';
import { describe, expect, it } from 'vitest';
import { measureGeometry } from '../src/core/measure.js';

const project = (points: [number, number][]): number[][] => points.map((p) => fromLonLat(p));

describe('measureGeometry', () => {
    it('mide una línea de un grado de longitud sobre el ecuador', () => {
        const measure = measureGeometry(new LineString(project([[0, 0], [1, 0]])));
        expect(measure.kind).toBe('length');
        if (measure.kind === 'length') expect(measure.length).toBeCloseTo(111_195, -2);
    });

    it('mide área y perímetro de un polígono', () => {
        const ring = project([[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]]);
        const measure = measureGeometry(new Polygon([ring]));
        expect(measure.kind).toBe('area');
        if (measure.kind === 'area') {
            expect(measure.area).toBeCloseTo(1_236_000, -4);
            expect(measure.perimeter).toBeCloseTo(4_448, -1);
        }
    });

    it('devuelve lon/lat de un punto', () => {
        const measure = measureGeometry(new Point(fromLonLat([-103.35, 20.67])));
        expect(measure).toEqual({ kind: 'point', lonLat: [expect.closeTo(-103.35, 6), expect.closeTo(20.67, 6)] });
    });
});
