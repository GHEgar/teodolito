import type { FeatureLike } from 'ol/Feature.js';
import type { ProjectionLike } from 'ol/proj.js';
import Style, { createDefaultStyle, createEditingStyle } from 'ol/style/Style.js';
import { measureGeometry, type Measure } from './measure.js';
import type { Item, Kind, Props, StyleContext, StyleFunction, Tool } from './types.js';

export interface StylingDeps {
    style: StyleFunction | undefined;
    item(id: string): Item | undefined;
    selectedId(): string | null;
    editingId(): string | null;
    tool(): Tool | null;
    label(kind: Kind, measure: Measure, text: string): string;
    defaultProps(kind: Kind): Props;
    projection(): ProjectionLike;
}

type OlStyleFunction = (feature: FeatureLike, resolution: number) => Style | Style[] | undefined;

const editing = createEditingStyle();

export function layerStyle(deps: StylingDeps): OlStyleFunction {
    return (feature, resolution) => {
        const item = deps.item(String(feature.getId()));
        if (!item || !item.visible) return undefined;
        if (!deps.style) return createDefaultStyle(feature, resolution);
        const context: StyleContext = {
            kind: item.kind,
            measure: item.measure,
            label: deps.label(item.kind, item.measure, item.text),
            text: item.text,
            props: item.props,
            selected: deps.selectedId() === item.id,
            editing: deps.editingId() === item.id,
            sketch: false,
            vertex: false,
            resolution,
        };
        return deps.style(feature, context);
    };
}

export function sketchStyle(deps: StylingDeps): OlStyleFunction {
    return (feature, resolution) => {
        const geometry = feature.getGeometry();
        const kind = deps.tool();
        if (!geometry || !kind) return undefined;
        const type = geometry.getType();
        if (!deps.style) return editing[type];
        const vertex = type === 'Point' && kind !== 'point' && kind !== 'text';
        const measure: Measure = 'getRevision' in geometry
            ? measureGeometry(geometry, deps.projection())
            : { kind: 'none' };
        const context: StyleContext = {
            kind,
            measure,
            label: deps.label(kind, measure, ''),
            text: '',
            props: deps.defaultProps(kind),
            selected: false,
            editing: false,
            sketch: true,
            vertex,
            resolution,
        };
        return deps.style(feature, context);
    };
}
