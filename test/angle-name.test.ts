import LineString from 'ol/geom/LineString.js';
import Modify from 'ol/interaction/Modify.js';
import { fromLonLat } from 'ol/proj.js';
import { describe, expect, it } from 'vitest';
import { measureGeometry } from '../src/core/index.js';
import { draw, setup } from './helpers.js';

const arms = (...points: [number, number][]): LineString => new LineString(points.map((p) => fromLonLat(p)));

describe('herramienta angle', () => {
    it('mide el ángulo entre los dos brazos', () => {
        const t = setup({ locale: 'en-US' });
        const id = draw(t, 'angle', arms([0, 0.01], [0, 0], [0.01, 0]));
        const item = t.getSnapshot().items.find((candidate) => candidate.id === id);
        expect(item?.kind).toBe('angle');
        expect(item?.measure.kind).toBe('angle');
        expect(item?.measure.kind === 'angle' && item.measure.degrees).toBeCloseTo(90, 1);
        expect(t.format(item?.measure ?? { kind: 'none' })).toBe('90°');
    });

    it('con un solo brazo es una longitud', () => {
        expect(measureGeometry(arms([0, 0], [0.01, 0]), 'EPSG:3857', 'angle').kind).toBe('length');
    });

    it('se guarda y se lee en GeoJSON', () => {
        const t = setup();
        draw(t, 'angle', arms([0, 0.01], [0, 0], [0.01, 0.01]));
        const json = t.toGeoJSON();
        const other = setup();
        other.fromGeoJSON(json);
        const measure = other.getSnapshot().items[0]?.measure;
        expect(measure?.kind === 'angle' && measure.degrees).toBeCloseTo(45, 0);
    });

    it('no deja insertar ni borrar vértices al editarlo', () => {
        const t = setup();
        const id = draw(t, 'angle', arms([0, 0.01], [0, 0], [0.01, 0]));
        t.setTool(null);
        t.select(id);
        const modify = t.map.getInteractions().getArray().find((candidate) => candidate instanceof Modify) as Modify;
        const conditions = modify as unknown as { insertVertexCondition_(event: unknown): boolean };
        expect(conditions.insertVertexCondition_({})).toBe(false);
        const line = draw(t, 'line', arms([0, 0], [0.01, 0]));
        t.setTool(null);
        t.select(line);
        expect(conditions.insertVertexCondition_({})).toBe(true);
    });
});

describe('rename', () => {
    it('pone el nombre, lo recorta y se deshace', () => {
        const t = setup();
        const id = draw(t, 'line', arms([0, 0], [1, 0]));
        expect(t.getSnapshot().items[0]?.name).toBe('');
        expect(t.rename(id, '  North fence  ')).toBe(true);
        expect(t.getSnapshot().items[0]?.name).toBe('North fence');
        expect(t.rename(id, 'North fence')).toBe(false);
        t.undo();
        expect(t.getSnapshot().items[0]?.name).toBe('');
        t.redo();
        expect(t.getSnapshot().items[0]?.name).toBe('North fence');
    });

    it('viaja en properties.name del GeoJSON', () => {
        const t = setup();
        const id = draw(t, 'line', arms([0, 0], [1, 0]));
        t.rename(id, 'Route');
        const json = t.toGeoJSON();
        expect(json.features[0]?.properties.name).toBe('Route');
        const other = setup();
        other.fromGeoJSON(json);
        expect(other.getSnapshot().items[0]?.name).toBe('Route');
        other.fromGeoJSON({ type: 'FeatureCollection', features: [{ ...json.features[0], properties: { kind: 'line' } }] });
        expect(other.getSnapshot().items[0]?.name).toBe('');
    });
});
