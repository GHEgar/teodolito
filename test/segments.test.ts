import Feature from 'ol/Feature.js';
import type Geometry from 'ol/geom/Geometry.js';
import LineString from 'ol/geom/LineString.js';
import Polygon, { circular } from 'ol/geom/Polygon.js';
import { fromLonLat } from 'ol/proj.js';
import { getDistance } from 'ol/sphere.js';
import { describe, expect, it } from 'vitest';
import { circleGeometry } from '../src/core/shapes.js';
import {
    bearing, formatAngle, formatBearing, measureGeometry, measureSegments, type Measure,
} from '../src/core/index.js';
import { draw, move, setup } from './helpers.js';

const project = (points: [number, number][]): number[][] => points.map((p) => fromLonLat(p));
const ccw = project([[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]]);
const area = (measure: Measure | undefined) => {
    if (measure?.kind !== 'area') throw new Error(`expected area, got ${measure?.kind}`);
    return measure;
};

describe('bearing', () => {
    it('norte, este, sur y oeste', () => {
        expect(bearing([0, 0], [0, 1])).toBeCloseTo(0, 9);
        expect(bearing([0, 0], [1, 0])).toBeCloseTo(90, 9);
        expect(bearing([0, 1], [0, 0])).toBeCloseTo(180, 9);
        expect(bearing([1, 0], [0, 0])).toBeCloseTo(270, 9);
    });
});

describe('measureSegments', () => {
    it('cuadrado: cuatro ángulos interiores de 90° en ambos sentidos', () => {
        const forward = measureSegments(ccw, 'EPSG:3857', true);
        const backward = measureSegments([...ccw].reverse(), 'EPSG:3857', true);
        for (const result of [forward, backward]) {
            expect(result.segments).toHaveLength(4);
            expect(result.angles).toHaveLength(4);
            result.angles.forEach((angle) => expect(angle.degrees).toBeCloseTo(90, 2));
        }
        expect(forward.segments[0]?.length).toBeCloseTo(getDistance([0, 0], [0.01, 0]), 6);
        expect(forward.segments.map((s) => Math.round(s.bearing))).toEqual([90, 0, 270, 180]);
    });

    it('triángulo cóncavo: un ángulo reflejo y la suma de un pentágono', () => {
        const ring = project([[0, 0], [0.02, 0], [0.02, 0.02], [0.01, 0.005], [0, 0.02], [0, 0]]);
        const { angles } = measureSegments(ring, 'EPSG:3857', true);
        expect(angles.reduce((sum, a) => sum + a.degrees, 0)).toBeCloseTo(540, 1);
        expect(Math.max(...angles.map((a) => a.degrees))).toBeGreaterThan(180);
    });

    it('línea: ángulo entre segmentos en los vértices intermedios', () => {
        const { segments, angles } = measureSegments(project([[0, 0], [0.01, 0], [0.01, 0.01], [0.02, 0.01]]), 'EPSG:3857', false);
        expect(segments).toHaveLength(3);
        expect(angles.map((a) => a.vertex)).toEqual([1, 2]);
        angles.forEach((a) => expect(a.degrees).toBeCloseTo(90, 2));
        const straight = measureSegments(project([[0, 0], [0.01, 0], [0.02, 0]]), 'EPSG:3857', false);
        expect(straight.angles[0]?.degrees).toBeCloseTo(180, 4);
    });

    it('el punto medio va en la proyección del mapa', () => {
        const { segments } = measureSegments(project([[0, 0], [0.02, 0]]), 'EPSG:3857', false);
        expect(segments[0]?.midpoint[0]).toBeCloseTo(fromLonLat([0.01, 0])[0] ?? 0, 3);
    });

    it('casos degenerados', () => {
        expect(measureSegments([], 'EPSG:3857', false)).toEqual({ segments: [], angles: [] });
        expect(measureSegments(project([[0, 0], [1, 0], [0, 0]]), 'EPSG:3857', true).segments).toEqual([]);
    });
});

describe('measureGeometry con kind', () => {
    it('mano alzada y círculo no llevan segmentos', () => {
        const line = new LineString(project([[0, 0], [0.01, 0], [0.02, 0.01]]));
        expect(measureGeometry(line, 'EPSG:3857', 'line')).toMatchObject({ segments: { length: 2 } });
        expect(measureGeometry(line, 'EPSG:3857', 'freehand')).toMatchObject({ segments: [], angles: [] });
    });

    it('rectángulo: ancho y alto', () => {
        const measure = area(measureGeometry(new Polygon([ccw]), 'EPSG:3857', 'rectangle'));
        expect(measure.shape).toEqual({
            type: 'rectangle',
            width: expect.closeTo((getDistance([0, 0], [0.01, 0]) + getDistance([0, 0.01], [0.01, 0.01])) / 2, 6),
            height: expect.closeTo(getDistance([0, 0], [0, 0.01]), 6),
        });
        expect(measure.angles).toHaveLength(4);
    });

    it('círculo: recupera centro y radio', () => {
        const polygon = circular([-103.35, 20.67], 1500, 64).transform('EPSG:4326', 'EPSG:3857') as Polygon;
        const measure = area(measureGeometry(polygon, 'EPSG:3857', 'circle'));
        expect(measure.segments).toEqual([]);
        expect(measure.shape?.type).toBe('circle');
        if (measure.shape?.type !== 'circle') return;
        expect(measure.shape.radius).toBeCloseTo(1500, 0);
        expect(measure.shape.center[0]).toBeCloseTo(-103.35, 6);
        expect(measure.shape.center[1]).toBeCloseTo(20.67, 6);
        expect(measure.area / (32 * 1500 ** 2 * Math.sin((2 * Math.PI) / 64))).toBeCloseTo(1, 3);
    });
});

describe('herramientas de círculo y rectángulo', () => {
    it('la geometryFunction del círculo usa metros geodésicos', () => {
        const fn = circleGeometry(32);
        const center = fromLonLat([0, 60]);
        const edge = fromLonLat([0, 60.01]);
        const polygon = fn([center, edge], undefined as never, 'EPSG:3857' as never) as Polygon;
        expect(polygon.getCoordinates()[0]).toHaveLength(33);
        const measure = area(measureGeometry(polygon, 'EPSG:3857', 'circle'));
        if (measure.shape?.type === 'circle') expect(measure.shape.radius).toBeCloseTo(getDistance([0, 60], [0, 60.01]), 0);
    });

    it('el círculo conserva el radio al moverse, deshacer y pasar por GeoJSON', () => {
        const t = setup();
        const polygon = circular([0, 0], 500, 64).transform('EPSG:4326', 'EPSG:3857') as Polygon;
        const id = draw(t, 'circle', polygon);
        const radius = () => {
            const shape = area(t.getSnapshot().items.find((item) => item.id === id)?.measure).shape;
            return shape?.type === 'circle' ? shape : null;
        };
        expect(radius()?.radius).toBeCloseTo(500, 0);
        move(t, id, () => polygon.translate(2000, 1000));
        expect(radius()?.radius).toBeCloseTo(500, 0);
        expect(radius()?.center[0]).toBeGreaterThan(0.01);
        t.undo();
        expect(radius()?.center[0]).toBeCloseTo(0, 6);
        const copy = setup();
        copy.fromGeoJSON(t.toGeoJSON());
        const item = copy.getSnapshot().items[0];
        expect(item?.kind).toBe('circle');
        const shape = area(item?.measure).shape;
        expect(shape?.type === 'circle' ? shape.radius : 0).toBeCloseTo(500, 0);
    });

    it('rectángulo por la herramienta', () => {
        const t = setup();
        const id = draw(t, 'rectangle', new Polygon([ccw]));
        expect(t.getSnapshot().items.find((item) => item.id === id)?.kind).toBe('rectangle');
        expect(t.toGeoJSON().features[0]?.properties.kind).toBe('rectangle');
        expect((t.getFeature(id) as Feature<Geometry>).getGeometry()?.getType()).toBe('Polygon');
    });
});

describe('formatAngle y formatBearing', () => {
    it('grados y cuadrantes', () => {
        expect(formatAngle(90)).toBe('90°');
        expect(formatAngle(45.25, { maximumFractionDigits: 2 })).toBe('45.25°');
        expect(formatBearing(-10)).toBe('350°');
        expect(formatBearing(45, { style: 'quadrant' })).toBe('N 45° E');
        expect(formatBearing(135, { style: 'quadrant' })).toBe('S 45° E');
        expect(formatBearing(200, { style: 'quadrant' })).toBe('S 20° W');
        expect(formatBearing(300, { style: 'quadrant' })).toBe('N 60° W');
    });
});
