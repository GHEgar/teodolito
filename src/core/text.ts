import type { Commands, Patch } from './commands.js';
import type { Entry, Registry } from './registry.js';
import type { Store } from './store.js';
import type { Snapshot, TeodolitoEvent } from './types.js';

export interface TextDeps {
    store: Store<Snapshot>;
    registry: Registry;
    ops: { detach(id: string): Entry | null; update(id: string, patch: Patch): void };
    commands: Commands;
    recorded<T>(result: T): T;
    emit(event: TeodolitoEvent): void;
}

export interface TextEditing {
    begin(id: string, fresh: boolean): void;
    commit(value: string): void;
    cancel(): void;
}

export function createTextEditing(deps: TextDeps): TextEditing {
    let fresh: string | null = null;

    const finish = (): void => {
        const previous = deps.store.get().editingTextId;
        fresh = null;
        deps.store.set({ editingTextId: null });
        if (previous) deps.registry.feature(previous)?.changed();
    };

    const cancel = (): void => {
        const id = deps.store.get().editingTextId;
        if (!id) return;
        if (fresh === id) deps.ops.detach(id);
        finish();
    };

    return {
        begin(id, isFresh) {
            if (deps.store.get().editingTextId === id) return;
            cancel();
            if (deps.registry.item(id)?.kind !== 'text') return;
            fresh = isFresh ? id : null;
            deps.store.set({ editingTextId: id });
            deps.registry.feature(id)?.changed();
        },
        commit(value) {
            const id = deps.store.get().editingTextId;
            if (!id) return;
            const text = value.trim();
            if (fresh === id) {
                if (text) {
                    deps.ops.update(id, { text });
                    deps.recorded(deps.commands.add(id));
                } else {
                    deps.ops.detach(id);
                }
            } else if (text) {
                deps.recorded(deps.commands.update(id, { text }));
            } else {
                deps.recorded(deps.commands.remove(id));
            }
            finish();
        },
        cancel,
    };
}
