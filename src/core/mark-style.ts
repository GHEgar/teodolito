import Point from 'ol/geom/Point.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import Text from 'ol/style/Text.js';
import type { Mark, MarkStyleFunction } from './marks.js';
import type { StyleContext } from './types.js';

export interface MarkStyleOptions {
    color?: string | ((context: StyleContext) => string);
    background?: string;
    textColor?: string;
    haloColor?: string;
    font?: string;
    vertexRadius?: number;
    endpointRadius?: number;
    strokeWidth?: number;
    segmentOffset?: number;
    angleOffset?: number;
}

const fallbackColor = (context: StyleContext): string => (
    typeof context.props.color === 'string' ? context.props.color : '#3399cc'
);

type Resolved = Required<Omit<MarkStyleOptions, 'color'>>;

function images(color: string, o: Resolved): Record<'start' | 'end' | 'vertex', CircleStyle[]> {
    const stroke = new Stroke({ color, width: o.strokeWidth });
    const background = new Fill({ color: o.background });
    return {
        start: [new CircleStyle({
            radius: o.endpointRadius, fill: new Fill({ color }), stroke: new Stroke({ color: o.background, width: o.strokeWidth }),
        })],
        end: [
            new CircleStyle({ radius: o.endpointRadius, fill: background, stroke }),
            new CircleStyle({ radius: Math.max(1, o.endpointRadius * 0.45), fill: background, stroke }),
        ],
        vertex: [new CircleStyle({ radius: o.vertexRadius, fill: background, stroke })],
    };
}

export function createMarkStyle(options: MarkStyleOptions = {}): MarkStyleFunction {
    const resolved: Resolved = {
        background: options.background ?? '#ffffff',
        textColor: options.textColor ?? '#1f2933',
        haloColor: options.haloColor ?? 'rgba(255,255,255,0.9)',
        font: options.font ?? '11px sans-serif',
        vertexRadius: options.vertexRadius ?? 4,
        endpointRadius: options.endpointRadius ?? 6,
        strokeWidth: options.strokeWidth ?? 2,
        segmentOffset: options.segmentOffset ?? -10,
        angleOffset: options.angleOffset ?? 16,
    };
    const colorOf = typeof options.color === 'function' ? options.color
        : options.color ? () => options.color as string : fallbackColor;
    const cache = new Map<string, ReturnType<typeof images>>();
    const fill = new Fill({ color: resolved.textColor });
    const halo = new Stroke({ color: resolved.haloColor, width: 3 });
    return (mark: Mark, context: StyleContext) => {
        const geometry = new Point(mark.coordinate);
        if (mark.type === 'segment' || mark.type === 'angle') {
            return new Style({
                geometry,
                text: new Text({
                    text: mark.label, font: resolved.font, fill, stroke: halo,
                    offsetY: mark.type === 'segment' ? resolved.segmentOffset : resolved.angleOffset,
                }),
            });
        }
        const color = colorOf(context);
        const set = cache.get(color) ?? images(color, resolved);
        cache.set(color, set);
        return set[mark.type].map((image) => new Style({ geometry, image }));
    };
}
