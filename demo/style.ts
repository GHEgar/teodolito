import Point from 'ol/geom/Point.js';
import { Circle, Fill, Stroke, Style, Text } from 'ol/style.js';
import { formatAngle, formatLength, type Measure, type StyleFunction } from 'teodolito';

export const swatches = ['#0f766e', '#c2410c', '#7c3aed', '#be123c', '#1d4ed8'];

export let showDetails = true;
export const setShowDetails = (value: boolean): void => { showDetails = value; };

const halo = new Stroke({ color: 'rgba(255,255,255,0.95)', width: 4 });

function label(text: string, placement: 'point' | 'line' = 'point', offsetY = 0): Text | undefined {
    if (!text) return undefined;
    return new Text({
        text,
        font: '600 13px system-ui, sans-serif',
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

const small = (text: string, offsetY = 0): Text => new Text({
    text,
    font: '500 11px system-ui, sans-serif',
    fill: new Fill({ color: '#334155' }),
    stroke: halo,
    offsetY,
});

function details(measure: Measure): Style[] {
    if (!showDetails || (measure.kind !== 'length' && measure.kind !== 'area')) return [];
    return [
        ...measure.segments.map((segment) => new Style({
            geometry: new Point(segment.midpoint),
            text: small(formatLength(segment.length, { locale: 'es-MX' }).text, 12),
        })),
        ...measure.angles.map((angle) => new Style({
            geometry: new Point(angle.coordinate),
            text: small(formatAngle(angle.degrees, { locale: 'es-MX', maximumFractionDigits: 0 }), 14),
        })),
    ];
}

function circleLabel(measure: Measure, fallback: string): string {
    if (measure.kind !== 'area' || measure.shape?.type !== 'circle') return fallback;
    return `${fallback}\nr = ${formatLength(measure.shape.radius, { locale: 'es-MX' }).text}`;
}

export const demoStyle: StyleFunction = (_feature, context) => {
    const color = typeof context.props.color === 'string' ? context.props.color : '#0f766e';
    const width = context.selected ? 4 : 2.5;
    const dash = context.sketch ? [8, 6] : undefined;
    const stroke = new Stroke({ color, width, ...(dash ? { lineDash: dash } : {}) });
    const fill = new Fill({ color: `${color}22` });
    if (context.vertex) return new Style({ image: vertex(color, 4) });
    switch (context.kind) {
        case 'polygon':
        case 'rectangle':
            return [new Style({ stroke, fill, text: label(context.label) }), ...details(context.measure)];
        case 'circle':
            return new Style({ stroke, fill, text: label(circleLabel(context.measure, context.label)) });
        case 'line':
            return [new Style({ stroke, text: label(context.label, 'line', -12) }), ...details(context.measure)];
        case 'freehand':
            return new Style({ stroke });
        case 'point':
            return new Style({ image: vertex(color, context.selected ? 7 : 6), text: label(context.label, 'point', -18) });
        case 'text':
            return new Style({
                image: context.sketch || context.editing ? vertex(color, 4) : undefined,
                text: new Text({
                    text: context.editing ? '' : context.text,
                    font: `600 ${context.selected ? 17 : 16}px system-ui, sans-serif`,
                    fill: new Fill({ color }),
                    stroke: halo,
                }),
            });
    }
};
