import Collection from 'ol/Collection.js';
import type Feature from 'ol/Feature.js';
import type Geometry from 'ol/geom/Geometry.js';
import Draw, { createBox } from 'ol/interaction/Draw.js';
import Modify from 'ol/interaction/Modify.js';
import Snap from 'ol/interaction/Snap.js';
import Translate from 'ol/interaction/Translate.js';
import type OlMap from 'ol/Map.js';
import type VectorSource from 'ol/source/Vector.js';
import type { StyleLike } from 'ol/style/Style.js';
import { circleGeometry } from './shapes.js';
import type { Tool } from './types.js';

const drawTypes = {
    line: 'LineString',
    polygon: 'Polygon',
    point: 'Point',
    freehand: 'LineString',
    text: 'Point',
    circle: 'Circle',
    rectangle: 'Circle',
    symbol: 'Point',
} as const;

export function createDraw(tool: Tool, style: StyleLike, circleSides = 64): Draw {
    const geometryFunction = tool === 'circle' ? circleGeometry(circleSides) : tool === 'rectangle' ? createBox() : undefined;
    return new Draw({
        type: drawTypes[tool], freehand: tool === 'freehand', style, stopClick: true,
        ...(geometryFunction ? { geometryFunction } : {}),
    });
}

export interface EditingOptions {
    vertexStyle: StyleLike | undefined;
    snap: boolean;
    snapTolerance: number;
    onStart(features: Feature<Geometry>[]): void;
    onEnd(features: Feature<Geometry>[]): void;
}

export interface Editing {
    select(feature: Feature<Geometry> | null, vertices: boolean): void;
    raiseSnap(): void;
    dispose(): void;
}

export function createEditing(map: OlMap, source: VectorSource<Feature<Geometry>>, options: EditingOptions): Editing {
    const selection = new Collection<Feature<Geometry>>();
    const editable = new Collection<Feature<Geometry>>();
    const translate = new Translate({ features: selection });
    const modify = new Modify({ features: editable, ...(options.vertexStyle ? { style: options.vertexStyle } : {}) });
    const snap = options.snap ? new Snap({ source, pixelTolerance: options.snapTolerance }) : null;

    translate.on('translatestart', (event) => options.onStart(event.features.getArray()));
    translate.on('translateend', (event) => options.onEnd(event.features.getArray()));
    modify.on('modifystart', (event) => options.onStart(event.features.getArray() as Feature<Geometry>[]));
    modify.on('modifyend', (event) => options.onEnd(event.features.getArray() as Feature<Geometry>[]));

    map.addInteraction(translate);
    map.addInteraction(modify);
    if (snap) map.addInteraction(snap);

    return {
        select(feature, vertices) {
            selection.clear();
            editable.clear();
            if (!feature) return;
            selection.push(feature);
            if (vertices) editable.push(feature);
        },
        raiseSnap() {
            if (!snap) return;
            map.removeInteraction(snap);
            map.addInteraction(snap);
        },
        dispose() {
            map.removeInteraction(translate);
            map.removeInteraction(modify);
            if (snap) map.removeInteraction(snap);
            selection.clear();
            editable.clear();
        },
    };
}
