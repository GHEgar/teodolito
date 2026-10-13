import type { Coordinate } from 'ol/coordinate.js';
import Point from 'ol/geom/Point.js';
import Polygon, { circular } from 'ol/geom/Polygon.js';
import { fromLonLat } from 'ol/proj.js';
import { describe, expect, it } from 'vitest';
import { measureSegments, type Item, type Measure, type Teodolito } from '../src/core/index.js';
import { resizeRectangle } from '../src/core/transform.js';
import { draw, setup } from './helpers.js';

const project = (points: [number, number][]): number[][] => points.map((p) => fromLonLat(p));
const box = project([[0, 0], [0.02, 0], [0.02, 0.01], [0, 0.01], [0, 0]]);
const item = (t: Teodolito, id: string): Item => t.getSnapshot().items.find((candidate) => candidate.id === id) as Item;
const area = (measure: Measure) => {
    if (measure.kind !== 'area') throw new Error('expected area');
    return measure;
};

describe('rotate y scale sobre geometrías', () => {
    it('rotar 90° un rectángulo conserva área, ancho y alto en su marco; deshacer lo regresa', () => {
        const t = setup();
        const id = draw(t, 'rectangle', new Polygon([box]));
        const before = area(item(t, id).measure);
        expect(t.rotate(id, Math.PI / 2)).toBe(true);
        const after = area(item(t, id).measure);
        expect(after.area / before.area).toBeCloseTo(1, 3);
        if (before.shape?.type === 'rectangle' && after.shape?.type === 'rectangle') {
            expect(after.shape.width).toBeCloseTo(before.shape.width, -1);
            expect(after.shape.height).toBeCloseTo(before.shape.height, -1);
        }
        t.undo();
        expect(area(item(t, id).measure).area).toBeCloseTo(before.area, 3);
    });

    it('rotar es en sentido horario', () => {
        const line = setup();
        const lineId = draw(line, 'polygon', new Polygon([project([[0, 0], [0.01, 0], [0.01, 0.001], [0, 0.001], [0, 0]])]));
        const bearing = () => area(item(line, lineId).measure).segments[0]?.bearing ?? 0;
        expect(bearing()).toBeCloseTo(90, 1);
        line.rotate(lineId, Math.PI / 2);
        expect(bearing()).toBeCloseTo(180, 1);
    });

    it('escalar ×2 un polígono multiplica el área por cuatro', () => {
        const t = setup();
        const id = draw(t, 'polygon', new Polygon([box]));
        const before = area(item(t, id).measure).area;
        expect(t.scale(id, 2)).toBe(true);
        expect(area(item(t, id).measure).area / before).toBeCloseTo(4, 3);
        expect(t.scale(id, 1)).toBe(false);
        expect(t.scale(id, -1)).toBe(false);
    });

    it('el círculo escala y cambia de radio geodésico, pero no rota', () => {
        const t = setup();
        const id = draw(t, 'circle', circular([-103.35, 20.67], 500, 64).transform('EPSG:4326', 'EPSG:3857') as Polygon);
        const radius = () => {
            const shape = area(item(t, id).measure).shape;
            return shape?.type === 'circle' ? shape.radius : 0;
        };
        expect(t.rotate(id, 1)).toBe(false);
        expect(t.scale(id, 2)).toBe(true);
        expect(radius()).toBeCloseTo(1000, 0);
        expect(t.setRadius(id, 250)).toBe(true);
        expect(radius()).toBeCloseTo(250, 0);
        t.undo();
        expect(radius()).toBeCloseTo(1000, 0);
    });

    it('el punto no rota ni escala', () => {
        const t = setup();
        const id = draw(t, 'point', new Point([0, 0]));
        expect(t.rotate(id, 1)).toBe(false);
        expect(t.scale(id, 2)).toBe(false);
        expect(t.setTransform(id, { scale: 2 })).toBe(false);
    });
});

describe('símbolos', () => {
    it('lleva el símbolo vigente, rota y escala con límites, y se deshace', () => {
        const t = setup();
        t.setSymbol('🌳');
        expect(t.getSnapshot().symbol).toBe('🌳');
        const id = draw(t, 'symbol', new Point([0, 0]));
        expect(item(t, id)).toMatchObject({ kind: 'symbol', symbol: '🌳', rotation: 0, scale: 1 });
        t.rotate(id, Math.PI / 4);
        expect(item(t, id).rotation).toBeCloseTo(Math.PI / 4, 9);
        t.scale(id, 10);
        expect(item(t, id).scale).toBe(4);
        t.setTransform(id, { scale: 0.1 });
        expect(item(t, id).scale).toBe(0.25);
        t.undo();
        expect(item(t, id).scale).toBe(4);
        t.undo();
        t.undo();
        expect(item(t, id)).toMatchObject({ rotation: 0, scale: 1 });
    });

    it('scaleLimits configurable y texto también rota', () => {
        const t = setup({ scaleLimits: [0.5, 2] });
        const id = draw(t, 'text', new Point([0, 0]));
        t.commitText('Hola');
        t.scale(id, 5);
        expect(item(t, id).scale).toBe(2);
    });

    it('ida y vuelta por GeoJSON; lo de la 0.4 se lee con valores por defecto', () => {
        const t = setup({ symbol: '⛰️' });
        const id = draw(t, 'symbol', new Point([0, 0]));
        t.setTransform(id, { rotation: 1, scale: 2 });
        const copy = setup();
        copy.fromGeoJSON(t.toGeoJSON());
        expect(copy.getSnapshot().items[0]).toMatchObject({ kind: 'symbol', symbol: '⛰️', rotation: 1, scale: 2 });
        const old = setup();
        old.fromGeoJSON({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { kind: 'point' } }],
        });
        expect(old.getSnapshot().items[0]).toMatchObject({ symbol: '', rotation: 0, scale: 1 });
    });
});

describe('resizeRectangle', () => {
    it('una esquina de un rectángulo rotado lo deja rectángulo y la opuesta fija', () => {
        const rectangle = new Polygon([box]);
        rectangle.rotate(Math.PI / 6, [0, 0]);
        const corners = (rectangle.getCoordinates()[0] ?? []).slice(0, 4);
        const opposite = corners[0] as Coordinate;
        const target: Coordinate = [(corners[2]?.[0] ?? 0) + 500, (corners[2]?.[1] ?? 0) + 300];
        const [ring] = resizeRectangle(corners, 2, target);
        expect(ring?.[0]).toEqual(opposite);
        const { angles } = measureSegments(ring ?? [], 'EPSG:3857', true);
        angles.forEach((angle) => expect(angle.degrees).toBeCloseTo(90, 1));
    });
});
