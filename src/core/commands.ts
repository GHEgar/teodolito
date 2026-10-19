import type { History } from './history.js';
import type { Entry, Registry } from './registry.js';
import type { Item } from './types.js';

export type Coordinates = unknown;
export type Patch = Partial<Pick<Item, 'name' | 'text' | 'props' | 'visible' | 'symbol' | 'rotation' | 'scale'>>;

export interface Operations {
    insert(entry: Entry): void;
    detach(id: string): Entry | null;
    update(id: string, patch: Patch): void;
    coordinates(id: string): Coordinates;
    setCoordinates(id: string, coordinates: Coordinates): void;
}

export interface Commands {
    add(id: string): void;
    remove(id: string): boolean;
    clear(): boolean;
    snapshotGeometry(ids: string[]): Map<string, string>;
    geometry(before: Map<string, string>): boolean;
    update(id: string, patch: Patch): boolean;
}

export function createCommands(ops: Operations, registry: Registry, history: History): Commands {
    const serialize = (id: string): string => JSON.stringify(ops.coordinates(id));
    const restore = (states: Map<string, string>): void => {
        states.forEach((value, id) => ops.setCoordinates(id, JSON.parse(value)));
    };

    return {
        add(id) {
            let entry: Entry | null = null;
            history.push({
                undo: () => { entry = ops.detach(id); },
                redo: () => { if (entry) ops.insert(entry); },
            });
        },
        remove(id) {
            const entry = ops.detach(id);
            if (!entry) return false;
            history.push({ undo: () => ops.insert(entry), redo: () => { ops.detach(id); } });
            return true;
        },
        clear() {
            const ids = registry.ids();
            if (ids.length === 0) return false;
            const entries = ids.map((id, index) => ({ ...(ops.detach(id) as Entry), index }));
            history.push({
                undo: () => entries.forEach((entry) => ops.insert(entry)),
                redo: () => ids.forEach((id) => ops.detach(id)),
            });
            return true;
        },
        snapshotGeometry(ids) {
            return new Map(ids.map((id) => [id, serialize(id)]));
        },
        geometry(before) {
            const changed = [...before].filter(([id, value]) => registry.item(id) && serialize(id) !== value);
            if (changed.length === 0) return false;
            const prior = new Map(changed);
            const after = new Map(changed.map(([id]) => [id, serialize(id)]));
            history.push({ undo: () => restore(prior), redo: () => restore(after) });
            return true;
        },
        update(id, patch) {
            const item = registry.item(id);
            if (!item) return false;
            const keys = Object.keys(patch) as (keyof Patch)[];
            if (keys.every((key) => Object.is(item[key], patch[key]))) return false;
            const prior = Object.fromEntries(keys.map((key) => [key, item[key]])) as Patch;
            ops.update(id, patch);
            history.push({ undo: () => ops.update(id, prior), redo: () => ops.update(id, patch) });
            return true;
        },
    };
}
