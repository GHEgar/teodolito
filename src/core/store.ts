export type Listener = () => void;

export interface Store<T extends object> {
    get(): T;
    set(patch: Partial<T>): void;
    subscribe(listener: Listener): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
    let state = initial;
    const listeners = new Set<Listener>();
    return {
        get: () => state,
        set(patch) {
            const keys = Object.keys(patch) as (keyof T)[];
            if (keys.every((key) => Object.is(state[key], patch[key]))) return;
            state = { ...state, ...patch };
            listeners.forEach((listener) => listener());
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
