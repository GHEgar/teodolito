import { Circle, Fill, Stroke, Style, Text } from 'ol/style.js';
import type { StyleFunction } from 'teodolito';

export const swatches = ['#0f766e', '#c2410c', '#7c3aed', '#be123c', '#1d4ed8'];

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

export const demoStyle: StyleFunction = (_feature, context) => {
    const color = typeof context.props.color === 'string' ? context.props.color : '#0f766e';
    const width = context.selected ? 4 : 2.5;
    const dash = context.sketch ? [8, 6] : undefined;
    const stroke = new Stroke({ color, width, ...(dash ? { lineDash: dash } : {}) });
    if (context.vertex) return new Style({ image: vertex(color, 4) });
    switch (context.kind) {
        case 'polygon':
            return new Style({ stroke, fill: new Fill({ color: `${color}22` }), text: label(context.label) });
        case 'line':
        case 'freehand':
            return new Style({ stroke, text: label(context.kind === 'line' ? context.label : '', 'line', -12) });
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
