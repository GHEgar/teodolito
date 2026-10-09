import LineString from 'ol/geom/LineString.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import { fromLonLat } from 'ol/proj.js';
import { describe, expect, it, vi } from 'vitest';
import { draw, move, setup } from './helpers.js';

const line = (): LineString => new LineString([fromLonLat([0, 0]), fromLonLat([1, 0])]);
const ring: [number, number][] = [[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]];
const square = (): Polygon => new Polygon([ring.map((p) => fromLonLat(p))]);

describe('createTeodolito', () => {
    it('agrega una línea medida y la deshace y rehace', () => {
        const t = setup();
        const id = draw(t, 'line', line());
        const item = t.getSnapshot().items[0];
        expect(item?.kind).toBe('line');
        expect(item?.measure.kind === 'length' && item.measure.length).toBeGreaterThan(111_000);
        expect(t.getSnapshot().canUndo).toBe(true);
        t.undo();
        expect(t.getSnapshot().items).toHaveLength(0);
        expect(t.source.getFeatures()).toHaveLength(0);
        t.redo();
        expect(t.getSnapshot().items[0]?.id).toBe(id);
    });

    it('vuelve a medir al editar y deshace el movimiento', () => {
        const t = setup();
        const id = draw(t, 'line', line());
        t.setTool(null);
        const geometry = t.getFeature(id)?.getGeometry() as LineString;
        move(t, id, () => geometry.setCoordinates([fromLonLat([0, 0]), fromLonLat([2, 0])]));
        const measured = t.getSnapshot().items[0]?.measure;
        expect(measured?.kind === 'length' && measured.length).toBeGreaterThan(222_000);
        t.undo();
        const restored = t.getSnapshot().items[0]?.measure;
        expect(restored?.kind === 'length' && restored.length).toBeLessThan(112_000);
        expect(t.getSnapshot().items).toHaveLength(1);
    });

    it('no registra un movimiento que no cambió nada', () => {
        const t = setup();
        const id = draw(t, 'point', new Point([0, 0]));
        move(t, id, () => undefined);
        t.undo();
        expect(t.getSnapshot().items).toHaveLength(0);
    });

    it('crea el texto al confirmarlo y lo descarta vacío', () => {
        const t = setup();
        const id = draw(t, 'text', new Point([0, 0]));
        expect(t.getSnapshot().editingTextId).toBe(id);
        expect(t.getSnapshot().canUndo).toBe(false);
        t.commitText('  Hola  ');
        expect(t.getSnapshot().items[0]?.text).toBe('Hola');
        expect(t.getSnapshot().canUndo).toBe(true);
        draw(t, 'text', new Point([1, 1]));
        t.commitText('');
        expect(t.getSnapshot().items).toHaveLength(1);
    });

    it('deshace cambios de props', () => {
        const t = setup({ defaultProps: () => ({ color: 'red' }) });
        const id = draw(t, 'polygon', square());
        expect(t.getSnapshot().items[0]?.props).toEqual({ color: 'red' });
        t.setProps(id, { width: 3 });
        expect(t.getSnapshot().items[0]?.props).toEqual({ color: 'red', width: 3 });
        t.undo();
        expect(t.getSnapshot().items[0]?.props).toEqual({ color: 'red' });
    });

    it('borra todo y lo restaura en el mismo orden', () => {
        const t = setup();
        const a = draw(t, 'point', new Point([0, 0]));
        const b = draw(t, 'line', line());
        t.select(a);
        expect(t.clear()).toBe(true);
        expect(t.getSnapshot().selectedId).toBeNull();
        t.undo();
        expect(t.getSnapshot().items.map((item) => item.id)).toEqual([a, b]);
    });

    it('ida y vuelta por GeoJSON en 4326', () => {
        const t = setup();
        draw(t, 'line', line());
        const textId = draw(t, 'text', new Point(fromLonLat([-103.35, 20.67])));
        t.commitText('Guadalajara');
        t.setVisible(textId, false);
        const collection = t.toGeoJSON();
        expect(collection.features[1]?.geometry).toEqual({ type: 'Point', coordinates: [expect.closeTo(-103.35, 6), expect.closeTo(20.67, 6)] });
        const other = setup();
        other.fromGeoJSON(collection);
        const items = other.getSnapshot().items;
        expect(items.map((item) => item.kind)).toEqual(['line', 'text']);
        expect(items[1]).toMatchObject({ id: textId, text: 'Guadalajara', visible: false });
        expect(other.getSnapshot().canUndo).toBe(false);
    });

    it('Escape cancela en orden: selección y luego herramienta', () => {
        const t = setup();
        const id = draw(t, 'point', new Point([0, 0]));
        t.setTool(null);
        t.select(id);
        expect(t.escape()).toBe(true);
        expect(t.getSnapshot().selectedId).toBeNull();
        t.setTool('line');
        expect(t.escape()).toBe(true);
        expect(t.getSnapshot().tool).toBeNull();
        expect(t.escape()).toBe(false);
    });

    it('con once apaga la herramienta tras un trazo', async () => {
        const onEvent = vi.fn();
        const t = setup({ once: true, onEvent });
        draw(t, 'point', new Point([0, 0]));
        await Promise.resolve();
        expect(t.getSnapshot().tool).toBeNull();
        expect(onEvent).toHaveBeenCalledWith({ type: 'tool', tool: null });
    });

    it('formatea con las unidades vigentes', () => {
        const t = setup({ locale: 'es-MX' });
        draw(t, 'line', line());
        const measure = t.getSnapshot().items[0]?.measure;
        if (!measure) throw new Error('sin medida');
        expect(t.format(measure)).toMatch(/km$/);
        t.setUnits({ length: 'm' });
        expect(t.format(measure)).toMatch(/ m$/);
    });

    it('se desmonta sin dejar capa ni interacciones', () => {
        const t = setup();
        const before = t.map.getInteractions().getLength();
        t.setTool('polygon');
        t.destroy();
        expect(t.map.getLayers().getLength()).toBe(0);
        expect(t.map.getInteractions().getLength()).toBe(before - 3);
    });
});
