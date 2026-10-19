import type { FeatureLike } from 'ol/Feature.js';
import type Geometry from 'ol/geom/Geometry.js';
import type { ProjectionLike } from 'ol/proj.js';
import Style, { createDefaultStyle, createEditingStyle } from 'ol/style/Style.js';
import { anyMarks, computeMarks, markStyles, type MarkFormat, type Marks, type MarkStyleFunction } from './marks.js';
import { measureGeometry, type Measure } from './measure.js';
import type { Handle, Item, Kind, Props, StyleContext, StyleFunction, Tool } from './types.js';

export interface StylingDeps {
    style: StyleFunction | undefined;
    item(id: string): Item | undefined;
    selectedId(): string | null;
    editingId(): string | null;
    tool(): Tool | null;
    symbol(): string;
    label(kind: Kind, measure: Measure, text: string): string;
    defaultProps(kind: Kind): Props;
    projection(): ProjectionLike;
    marks(): Marks;
    markStyle: MarkStyleFunction;
    markFormat: MarkFormat;
}

type Styles = Style | Style[] | undefined;
type OlStyleFunction = (feature: FeatureLike, resolution: number) => Styles;

const editing = createEditingStyle();

function withMarks(base: Styles, feature: FeatureLike, context: StyleContext, deps: StylingDeps): Styles {
    const marks = deps.marks();
    const geometry = feature.getGeometry();
    if (!anyMarks(marks) || !geometry || !('getRevision' in geometry)) return base;
    const found = computeMarks(geometry as Geometry, context.kind, context.measure, context.resolution, marks, deps.markFormat);
    if (found.length === 0) return base;
    const list = Array.isArray(base) ? base : base ? [base] : [];
    return [...list, ...markStyles(found, context, deps.markStyle)];
}

export function layerStyle(deps: StylingDeps): OlStyleFunction {
    return (feature, resolution) => {
        const item = deps.item(String(feature.getId()));
        if (!item || !item.visible) return undefined;
        const context: StyleContext = {
            kind: item.kind,
            measure: item.measure,
            label: deps.label(item.kind, item.measure, item.text),
            name: item.name,
            text: item.text,
            props: item.props,
            selected: deps.selectedId() === item.id,
            editing: deps.editingId() === item.id,
            sketch: false,
            vertex: false,
            symbol: item.symbol,
            rotation: item.rotation,
            scale: item.scale,
            handle: null,
            resolution,
        };
        const base = deps.style ? deps.style(feature, context) : createDefaultStyle(feature, resolution);
        return withMarks(base, feature, context, deps);
    };
}

export function sketchStyle(deps: StylingDeps): OlStyleFunction {
    return (feature, resolution) => {
        const geometry = feature.getGeometry();
        const kind = deps.tool();
        if (!geometry || !kind) return undefined;
        const type = geometry.getType();
        const vertex = type === 'Point' && kind !== 'point' && kind !== 'text';
        const measure: Measure = 'getRevision' in geometry
            ? measureGeometry(geometry, deps.projection(), kind)
            : { kind: 'none' };
        const context: StyleContext = {
            kind,
            measure,
            label: deps.label(kind, measure, ''),
            name: '',
            text: '',
            props: deps.defaultProps(kind),
            selected: false,
            editing: false,
            sketch: true,
            vertex,
            symbol: kind === 'symbol' ? deps.symbol() : '',
            rotation: 0,
            scale: 1,
            handle: null,
            resolution,
        };
        return withMarks(deps.style ? deps.style(feature, context) : editing[type], feature, context, deps);
    };
}

export function handleStyle(deps: StylingDeps): OlStyleFunction {
    return (feature, resolution) => {
        const item = deps.item(String(feature.get('target')));
        if (!item) return undefined;
        if (!deps.style) return editing.Point;
        return deps.style(feature, {
            kind: item.kind,
            measure: item.measure,
            label: '',
            name: item.name,
            text: item.text,
            props: item.props,
            selected: true,
            editing: false,
            sketch: false,
            vertex: false,
            symbol: item.symbol,
            rotation: item.rotation,
            scale: item.scale,
            handle: feature.get('handle') as Handle,
            resolution,
        });
    };
}
