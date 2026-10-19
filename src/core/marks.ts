import type { Coordinate } from 'ol/coordinate.js';
import type Geometry from 'ol/geom/Geometry.js';
import type LineString from 'ol/geom/LineString.js';
import Point from 'ol/geom/Point.js';
import type Polygon from 'ol/geom/Polygon.js';
import type Style from 'ol/style/Style.js';
import type { Measure } from './measure.js';
import type { Segment } from './segments.js';
import type { Kind, StyleContext } from './types.js';

export interface Marks {
    segmentLabels: boolean;
    vertexAngles: boolean;
    vertices: boolean;
    minSegmentPixels: number;
    angleDigits: number;
}

export type MarkType = 'segment' | 'angle' | 'start' | 'end' | 'vertex';

export interface Mark {
    readonly type: MarkType;
    readonly index: number;
    readonly coordinate: Coordinate;
    readonly value: number;
    readonly label: string;
}

export type MarkStyleFunction = (mark: Mark, context: StyleContext) => Style | Style[] | undefined;

export interface MarkFormat {
    length(meters: number): string;
    angle(degrees: number, digits: number): string;
}

export const defaultMarks: Marks = {
    segmentLabels: false, vertexAngles: false, vertices: false, minSegmentPixels: 40, angleDigits: 0,
};

type Layout = 'open' | 'closed' | 'ends';

const layouts: Partial<Record<Kind, Layout>> = {
    line: 'open', angle: 'open', freehand: 'ends', polygon: 'closed', rectangle: 'closed',
};

const geometryTypes: Partial<Record<Layout, string>> = { open: 'LineString', ends: 'LineString', closed: 'Polygon' };

export const anyMarks = (marks: Marks): boolean => marks.segmentLabels || marks.vertexAngles || marks.vertices;

function coordinatesOf(geometry: Geometry, layout: Layout): Coordinate[] {
    if (layout === 'closed') return ((geometry as Polygon).getCoordinates()[0] ?? []).slice(0, -1);
    return (geometry as LineString).getCoordinates();
}

function vertexMarks(coordinates: readonly Coordinate[], layout: Layout): Mark[] {
    const last = coordinates.length - 1;
    return coordinates.flatMap((coordinate, index): Mark[] => {
        const type: MarkType | null = index === 0 ? 'start'
            : layout !== 'closed' && index === last ? 'end'
                : layout === 'ends' ? null : 'vertex';
        return type ? [{ type, index, coordinate, value: index, label: '' }] : [];
    });
}

const pixels = (segment: Segment, resolution: number): number => Math.hypot(
    (segment.end[0] ?? 0) - (segment.start[0] ?? 0),
    (segment.end[1] ?? 0) - (segment.start[1] ?? 0),
) / resolution;

export function computeMarks(
    geometry: Geometry, kind: Kind, measure: Measure, resolution: number, marks: Marks, format: MarkFormat,
): Mark[] {
    const layout = layouts[kind];
    if (!layout || !anyMarks(marks) || geometry.getType() !== geometryTypes[layout]) return [];
    const result = marks.vertices ? vertexMarks(coordinatesOf(geometry, layout), layout) : [];
    if (measure.kind !== 'length' && measure.kind !== 'area' && measure.kind !== 'angle') return result;
    const { segments, angles } = measure;
    const wide = segments.map((segment) => pixels(segment, resolution) >= marks.minSegmentPixels);
    if (marks.segmentLabels) {
        segments.forEach((segment, index) => {
            if (!wide[index]) return;
            result.push({ type: 'segment', index, coordinate: segment.midpoint, value: segment.length, label: format.length(segment.length) });
        });
    }
    if (marks.vertexAngles && kind !== 'angle') {
        angles.forEach((angle) => {
            const before = (angle.vertex - 1 + segments.length) % segments.length;
            if (!wide[before] || !wide[angle.vertex % segments.length]) return;
            result.push({
                type: 'angle', index: angle.vertex, coordinate: angle.coordinate, value: angle.degrees,
                label: format.angle(angle.degrees, marks.angleDigits),
            });
        });
    }
    return result;
}

export function markStyles(marks: readonly Mark[], context: StyleContext, style: MarkStyleFunction): Style[] {
    return marks.flatMap((mark) => {
        const produced = style(mark, context);
        const list = Array.isArray(produced) ? produced : produced ? [produced] : [];
        return list.map((entry) => {
            if (entry.getGeometry()) return entry;
            const placed = entry.clone();
            placed.setGeometry(new Point(mark.coordinate));
            return placed;
        });
    });
}
