import type { FeatureLike } from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import { fromLonLat } from 'ol/proj.js';
import CircleStyle from 'ol/style/Circle.js';
import Style from 'ol/style/Style.js';
import Text from 'ol/style/Text.js';
import { describe, expect, it } from 'vitest';
import {
    computeMarks, createMarkStyle, defaultMarks, measureGeometry, type Kind, type Mark, type Marks, type StyleContext,
} from '../src/core/index.js';
import { draw, setup } from './helpers.js';

const all: Marks = { ...defaultMarks, segmentLabels: true, vertexAngles: true, vertices: true };
const format = { length: (m: number) => `${Math.round(m)} m`, angle: (d: number, digits: number) => `${d.toFixed(digits)}°` };
const elbow = (): LineString => new LineString([[0, 0], [0.01, 0], [0.01, 0.01]].map((p) => fromLonLat(p)));
const square = (): Polygon => new Polygon([[[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]].map((p) => fromLonLat(p))]);

function marksOf(geometry: LineString | Polygon, kind: Kind, resolution = 10, marks: Marks = all): Mark[] {
    return computeMarks(geometry, kind, measureGeometry(geometry, 'EPSG:3857', kind), resolution, marks, format);
}

const types = (marks: Mark[]): string[] => marks.map((mark) => mark.type);

const context = (props: Record<string, unknown> = {}): StyleContext => ({
    kind: 'line', measure: { kind: 'none' }, label: '', name: '', text: '', props, selected: false, editing: false,
    sketch: false, vertex: false, symbol: '', rotation: 0, scale: 1, handle: null, resolution: 10,
});

describe('computeMarks', () => {
    it('marca inicio, intermedios y fin de una línea con tramos y ángulo', () => {
        const marks = marksOf(elbow(), 'line');
        expect(types(marks)).toEqual(['start', 'vertex', 'end', 'segment', 'segment', 'angle']);
        expect(marks[3]?.label).toBe('1112 m');
        expect(marks[5]?.label).toBe('90°');
        expect(marks[5]?.coordinate).toEqual(fromLonLat([0.01, 0]));
    });

    it('oculta tramos cortos en pantalla y los ángulos que tocan', () => {
        expect(types(marksOf(elbow(), 'line', 100))).toEqual(['start', 'vertex', 'end']);
        expect(types(marksOf(elbow(), 'line', 10, { ...all, minSegmentPixels: 0 }))).toContain('angle');
    });

    it('en polígonos el anillo empieza en el inicio y no tiene fin', () => {
        const marks = marksOf(square(), 'polygon');
        expect(types(marks).filter((type) => type === 'start' || type === 'end' || type === 'vertex'))
            .toEqual(['start', 'vertex', 'vertex', 'vertex']);
        expect(marks.filter((mark) => mark.type === 'segment')).toHaveLength(4);
        expect(marks.filter((mark) => mark.type === 'angle').map((mark) => mark.label)).toEqual(['90°', '90°', '90°', '90°']);
    });

    it('mano alzada solo marca los extremos y el círculo nada', () => {
        expect(types(marksOf(elbow(), 'freehand'))).toEqual(['start', 'end']);
        expect(marksOf(square(), 'circle')).toEqual([]);
        expect(marksOf(elbow(), 'line', 10, defaultMarks)).toEqual([]);
    });

    it('el ángulo de la herramienta angle es su propia etiqueta', () => {
        expect(types(marksOf(elbow(), 'angle'))).toEqual(['start', 'vertex', 'end', 'segment', 'segment']);
    });

    it('con angleAt last solo marca el ángulo de la última esquina', () => {
        const line = new LineString([[0, 0], [0.01, 0], [0.01, 0.01], [0.02, 0.01]].map((p) => fromLonLat(p)));
        const angles = marksOf(line, 'line', 10, { ...defaultMarks, vertexAngles: true, angleAt: 'last' });
        expect(types(angles)).toEqual(['angle']);
        expect(angles[0]?.index).toBe(2);
        expect(angles[0]?.coordinate).toEqual(fromLonLat([0.01, 0.01]));
        const ring = marksOf(square(), 'polygon', 10, { ...defaultMarks, vertexAngles: true, angleAt: 'last' });
        expect(ring.map((mark) => mark.index)).toEqual([3]);
    });

    it('respeta cada interruptor', () => {
        expect(types(marksOf(elbow(), 'line', 10, { ...defaultMarks, segmentLabels: true }))).toEqual(['segment', 'segment']);
        expect(types(marksOf(elbow(), 'line', 10, { ...defaultMarks, vertexAngles: true }))).toEqual(['angle']);
    });
});

describe('createMarkStyle', () => {
    const style = createMarkStyle();
    const at = (type: Mark['type']): Mark => ({ type, index: 0, coordinate: [5, 6], value: 12, label: '12 m' });
    const list = (value: Style | Style[] | undefined): Style[] => (Array.isArray(value) ? value : value ? [value] : []);

    it('inicio relleno, fin con anillo doble y vértice hueco', () => {
        const start = list(style(at('start'), context({ color: '#ff0000' })));
        const end = list(style(at('end'), context()));
        const vertex = list(style(at('vertex'), context()));
        expect(start).toHaveLength(1);
        expect((start[0]?.getImage() as CircleStyle).getFill()?.getColor()).toBe('#ff0000');
        expect(end).toHaveLength(2);
        expect(end.map((entry) => (entry.getImage() as CircleStyle).getRadius())).toEqual([6, 2.7]);
        expect((vertex[0]?.getImage() as CircleStyle).getFill()?.getColor()).toBe('#ffffff');
        expect((vertex[0]?.getGeometry() as Point).getCoordinates()).toEqual([5, 6]);
    });

    it('etiqueta tramos y ángulos con texto', () => {
        const label = list(style(at('segment'), context()))[0];
        expect((label?.getText() as Text).getText()).toBe('12 m');
        expect(createMarkStyle({ color: 'navy' })(at('start'), context({ color: 'red' }))).toBeDefined();
    });
});

describe('marcas en la instancia', () => {
    const render = (t: ReturnType<typeof setup>, id: string, resolution = 10): Style[] => {
        const fn = t.layer.getStyleFunction() as (feature: FeatureLike, resolution: number) => Style | Style[];
        const value = fn(t.getFeature(id) as FeatureLike, resolution);
        return Array.isArray(value) ? value : [value];
    };

    it('apagadas por omisión y prendidas con setMarks', () => {
        const t = setup({ style: () => new Style() });
        const id = draw(t, 'line', elbow());
        expect(render(t, id)).toHaveLength(1);
        t.setMarks({ vertices: true, segmentLabels: true });
        expect(t.getSnapshot().marks).toMatchObject({ vertices: true, segmentLabels: true, vertexAngles: false });
        expect(render(t, id)).toHaveLength(1 + 1 + 1 + 2 + 2);
    });

    it('usa markStyle y pone la geometría en una copia', () => {
        const shared = new Style();
        const t = setup({ style: () => new Style(), marks: { vertices: true }, markStyle: () => shared });
        const id = draw(t, 'line', elbow());
        const marks = render(t, id).slice(1);
        expect(marks).toHaveLength(3);
        expect(shared.getGeometry()).toBeNull();
        expect((marks[2]?.getGeometry() as Point).getCoordinates()).toEqual(fromLonLat([0.01, 0.01]));
    });

    it('formatea con las unidades de la instancia', () => {
        const t = setup({ style: () => new Style(), locale: 'en-US', marks: { segmentLabels: true }, units: { system: 'imperial' } });
        const id = draw(t, 'line', elbow());
        const labels = render(t, id).slice(1).map((entry) => entry.getText()?.getText());
        expect(labels).toEqual(['3,648.13 ft', '3,648.13 ft']);
    });
});
