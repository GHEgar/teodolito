import type Feature from 'ol/Feature.js';
import type Geometry from 'ol/geom/Geometry.js';
import type { ProjectionLike } from 'ol/proj.js';
import type VectorSource from 'ol/source/Vector.js';
import { measureGeometry } from './measure.js';
import type { Item } from './types.js';

export interface Entry {
    feature: Feature<Geometry>;
    item: Item;
    index: number;
}

export interface Registry {
    ids(): string[];
    item(id: string): Item | undefined;
    feature(id: string): Feature<Geometry> | undefined;
    insert(feature: Feature<Geometry>, item: Item, index?: number): void;
    detach(id: string): Entry | null;
    update(id: string, patch: Partial<Omit<Item, 'id' | 'kind'>>): void;
    remeasure(id: string, projection: ProjectionLike): boolean;
}

export function createRegistry(source: VectorSource<Feature<Geometry>>, publish: (items: Item[]) => void): Registry {
    const features = new Map<string, Feature<Geometry>>();
    const items = new Map<string, Item>();
    const revisions = new Map<string, number>();
    const order: string[] = [];

    const emit = (): void => publish(order.map((id) => items.get(id) as Item));

    return {
        ids: () => [...order],
        item: (id) => items.get(id),
        feature: (id) => features.get(id),
        insert(feature, item, index = order.length) {
            feature.setId(item.id);
            features.set(item.id, feature);
            items.set(item.id, item);
            revisions.set(item.id, feature.getGeometry()?.getRevision() ?? 0);
            order.splice(Math.min(index, order.length), 0, item.id);
            source.addFeature(feature);
            emit();
        },
        detach(id) {
            const feature = features.get(id);
            const item = items.get(id);
            if (!feature || !item) return null;
            const index = order.indexOf(id);
            order.splice(index, 1);
            features.delete(id);
            items.delete(id);
            revisions.delete(id);
            source.removeFeature(feature);
            emit();
            return { feature, item, index };
        },
        update(id, patch) {
            const item = items.get(id);
            if (!item) return;
            items.set(id, { ...item, ...patch });
            emit();
            features.get(id)?.changed();
        },
        remeasure(id, projection) {
            const geometry = features.get(id)?.getGeometry();
            const item = items.get(id);
            if (!geometry || !item || revisions.get(id) === geometry.getRevision()) return false;
            revisions.set(id, geometry.getRevision());
            items.set(id, { ...item, measure: measureGeometry(geometry, projection, item.kind) });
            emit();
            return true;
        },
    };
}
