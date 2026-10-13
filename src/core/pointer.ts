import type Feature from 'ol/Feature.js';
import type Geometry from 'ol/geom/Geometry.js';
import type VectorLayer from 'ol/layer/Vector.js';
import type OlMap from 'ol/Map.js';
import type MapBrowserEvent from 'ol/MapBrowserEvent.js';
import type VectorSource from 'ol/source/Vector.js';

export interface PointerDeps {
    map: OlMap;
    layer: VectorLayer<VectorSource<Feature<Geometry>>>;
    hitTolerance: number;
    active(): boolean;
    blocked(event: MapBrowserEvent): boolean;
    onClick(id: string | null): void;
    onDoubleClick(id: string, event: MapBrowserEvent): void;
}

export function listenPointer(deps: PointerDeps): () => void {
    const hit = (event: MapBrowserEvent): string | null => {
        const feature = deps.map.forEachFeatureAtPixel(event.pixel, (f) => f, {
            layerFilter: (candidate) => candidate === deps.layer,
            hitTolerance: deps.hitTolerance,
        });
        return feature ? String(feature.getId()) : null;
    };
    const onClick = (event: MapBrowserEvent): void => {
        if (deps.active() && !deps.blocked(event)) deps.onClick(hit(event));
    };
    const onDoubleClick = (event: MapBrowserEvent): void => {
        const id = deps.active() ? hit(event) : null;
        if (id) deps.onDoubleClick(id, event);
    };
    deps.map.on('singleclick', onClick);
    deps.map.on('dblclick', onDoubleClick);
    return () => {
        deps.map.un('singleclick', onClick);
        deps.map.un('dblclick', onDoubleClick);
    };
}
