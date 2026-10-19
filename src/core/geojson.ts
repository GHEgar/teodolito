import type Feature from 'ol/Feature.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import type Geometry from 'ol/geom/Geometry.js';
import type { ProjectionLike } from 'ol/proj.js';
import type { Item, Kind, Props } from './types.js';

export interface TeodolitoFeature {
    type: 'Feature';
    id: string;
    geometry: unknown;
    properties: { kind: Kind; name: string; text: string; props: Props; visible: boolean; symbol: string; rotation: number; scale: number };
}

export interface TeodolitoCollection {
    type: 'FeatureCollection';
    features: TeodolitoFeature[];
}

export interface Parsed {
    feature: Feature<Geometry>;
    id: string | null;
    kind: Kind;
    name: string;
    text: string;
    props: Props;
    visible: boolean;
    symbol: string;
    rotation: number;
    scale: number;
}

const kinds: readonly Kind[] = ['line', 'polygon', 'point', 'freehand', 'text', 'circle', 'rectangle', 'symbol', 'angle'];
const finite = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

const options = (projection: ProjectionLike) => ({ dataProjection: 'EPSG:4326', featureProjection: projection });

export function writeCollection(entries: [Feature<Geometry>, Item][], projection: ProjectionLike): TeodolitoCollection {
    const format = new GeoJSON();
    return {
        type: 'FeatureCollection',
        features: entries.map(([feature, item]) => ({
            type: 'Feature',
            id: item.id,
            geometry: format.writeGeometryObject(feature.getGeometry() as Geometry, options(projection)),
            properties: {
                kind: item.kind, name: item.name, text: item.text, props: item.props, visible: item.visible,
                symbol: item.symbol, rotation: item.rotation, scale: item.scale,
            },
        })),
    };
}

export function readCollection(collection: unknown, projection: ProjectionLike): Parsed[] {
    const features = new GeoJSON().readFeatures(collection, options(projection)) as Feature<Geometry>[];
    return features.flatMap((feature) => {
        const kind = feature.get('kind') as Kind;
        if (!kinds.includes(kind) || !feature.getGeometry()) return [];
        const id = feature.getId();
        const name = feature.get('name');
        const text = feature.get('text');
        const props = feature.get('props');
        const visible = feature.get('visible') !== false;
        const symbol = feature.get('symbol');
        const rotation = finite(feature.get('rotation'), 0);
        const scale = finite(feature.get('scale'), 1);
        ['kind', 'name', 'text', 'props', 'visible', 'symbol', 'rotation', 'scale'].forEach((key) => feature.unset(key, true));
        return [{
            feature,
            id: id === undefined ? null : String(id),
            kind,
            name: typeof name === 'string' ? name : '',
            text: typeof text === 'string' ? text : '',
            props: props && typeof props === 'object' ? props : {},
            visible,
            symbol: typeof symbol === 'string' ? symbol : '',
            rotation,
            scale: scale > 0 ? scale : 1,
        }];
    });
}
