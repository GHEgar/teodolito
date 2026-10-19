import type { FeatureLike } from 'ol/Feature.js';
import type LineString from 'ol/geom/LineString.js';
import Point from 'ol/geom/Point.js';
import { Circle, Fill, RegularShape, Stroke, Style, Text } from 'ol/style.js';
import { createMarkStyle, formatLength, type Measure, type StyleContext, type StyleFunction } from 'teodolito';

export const swatches = ['#0f766e', '#c2410c', '#7c3aed', '#be123c', '#1d4ed8'];

const halo = new Stroke({ color: 'rgba(255,255,255,0.95)', width: 4 });

function label(text: string, placement: 'point' | 'line' = 'point', offsetY = 0): Text | undefined {
    if (!text) return undefined;
    return new Text({
        text,
        font: '600 13px Rotulo, system-ui, sans-serif',
        fill: new Fill({ color: '#1f2933' }),
        stroke: halo,
        placement,
        offsetY,
        overflow: true,
    });
}

const vertex = (color: string, radius = 5) => new Circle({
    radius,
    fill: new Fill({ color: '#fff' }),
    stroke: new Stroke({ color, width: 2 }),
});

export const demoMarkStyle = createMarkStyle({
    font: '500 11px Rotulo, system-ui, sans-serif',
    textColor: '#334155',
    endpointRadius: 6,
    segmentOffset: 12,
    angleOffset: -16,
});

function circleLabel(measure: Measure, fallback: string): string {
    if (measure.kind !== 'area' || measure.shape?.type !== 'circle') return fallback;
    return `${fallback}\nr = ${formatLength(measure.shape.radius, { locale: 'en-US' }).text}`;
}

function handle(color: string, kind: NonNullable<StyleContext['handle']>): Style {
    const round = kind === 'rotate' || kind === 'radius';
    return new Style({
        image: round
            ? new Circle({ radius: 6, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 2 }) })
            : new RegularShape({ points: 4, radius: 7, angle: Math.PI / 4, fill: new Fill({ color: '#fff' }), stroke: new Stroke({ color, width: 2 }) }),
    });
}

function angleStyle(feature: FeatureLike, stroke: Stroke, text: string): Style[] {
    const vertex = (feature.getGeometry() as LineString).getCoordinates?.()[1];
    if (!vertex) return [new Style({ stroke })];
    return [new Style({ stroke }), new Style({ geometry: new Point(vertex), text: label(text, 'point', 20) })];
}

export const demoStyle: StyleFunction = (feature, context) => {
    const color = typeof context.props.color === 'string' ? context.props.color : '#0f766e';
    const width = context.selected ? 4 : 2.5;
    const dash = context.sketch ? [8, 6] : undefined;
    const stroke = new Stroke({ color, width, ...(dash ? { lineDash: dash } : {}) });
    const fill = new Fill({ color: `${color}22` });
    if (context.vertex) return new Style({ image: vertex(color, 4) });
    if (context.handle) return handle(color, context.handle);
    switch (context.kind) {
        case 'polygon':
        case 'rectangle':
            return new Style({ stroke, fill, text: label(context.label) });
        case 'circle':
            return new Style({ stroke, fill, text: label(circleLabel(context.measure, context.label)) });
        case 'line':
            return new Style({ stroke, text: label(context.label, 'line', -12) });
        case 'angle':
            return angleStyle(feature, stroke, context.label);
        case 'freehand':
            return new Style({ stroke });
        case 'point':
            return new Style({ image: vertex(color, context.selected ? 7 : 6), text: label(context.label, 'point', -18) });
        case 'symbol':
            return new Style({
                text: new Text({
                    text: context.symbol,
                    font: `${Math.round(28 * context.scale)}px Rotulo, system-ui, sans-serif`,
                    rotation: context.rotation,
                    ...(context.selected ? { backgroundStroke: new Stroke({ color, width: 1.5 }), padding: [2, 2, 2, 2] } : {}),
                }),
            });
        case 'text':
            return new Style({
                image: context.sketch || context.editing ? vertex(color, 4) : undefined,
                text: new Text({
                    text: context.editing ? '' : context.text,
                    rotation: context.rotation,
                    font: `600 ${Math.round((context.selected ? 17 : 16) * context.scale)}px Rotulo, system-ui, sans-serif`,
                    fill: new Fill({ color }),
                    stroke: halo,
                }),
            });
    }
};
