import type { FeatureLike } from 'ol/Feature.js';
import type { StyleLike } from 'ol/style/Style.js';
import type Style from 'ol/style/Style.js';
import type { FormatOptions, Units } from './format.js';
import type { Measure } from './measure.js';

export type Tool = 'line' | 'polygon' | 'point' | 'freehand' | 'text' | 'circle' | 'rectangle';
export type Kind = Tool;
export type Props = Readonly<Record<string, unknown>>;

export interface Item {
    readonly id: string;
    readonly kind: Kind;
    readonly measure: Measure;
    readonly text: string;
    readonly props: Props;
    readonly visible: boolean;
}

export interface Snapshot {
    readonly tool: Tool | null;
    readonly drawing: boolean;
    readonly sketch: Measure | null;
    readonly items: readonly Item[];
    readonly selectedId: string | null;
    readonly editingTextId: string | null;
    readonly units: Units;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
}

export interface StyleContext {
    readonly kind: Kind;
    readonly measure: Measure;
    readonly label: string;
    readonly text: string;
    readonly props: Props;
    readonly selected: boolean;
    readonly editing: boolean;
    readonly sketch: boolean;
    readonly vertex: boolean;
    readonly resolution: number;
}

export type StyleFunction = (feature: FeatureLike, context: StyleContext) => Style | Style[] | undefined;

export type TeodolitoEvent =
    | { type: 'add' | 'remove' | 'change' | 'select'; id: string | null }
    | { type: 'tool'; tool: Tool | null }
    | { type: 'undo' | 'redo' | 'clear' | 'load' };

export interface TeodolitoOptions {
    style?: StyleFunction;
    vertexStyle?: StyleLike;
    units?: Partial<Units>;
    locale?: string;
    format?: Omit<FormatOptions, 'units' | 'locale'>;
    defaultProps?: (kind: Kind) => Props;
    circleSides?: number;
    once?: boolean;
    snap?: boolean;
    snapTolerance?: number;
    hitTolerance?: number;
    historyLimit?: number;
    keyboard?: boolean;
    zIndex?: number;
    onEvent?: (event: TeodolitoEvent) => void;
}
