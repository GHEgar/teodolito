import type OlMap from 'ol/Map.js';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Coordinate } from 'ol/coordinate.js';
import { createTeodolito, type Item, type Snapshot, type Teodolito, type TeodolitoOptions } from '../core/index.js';
import { useTeodolitoInstance } from './context.js';

export type TeodolitoActions = Pick<Teodolito,
    | 'setTool' | 'removeLastPoint' | 'finishDrawing' | 'abortDrawing' | 'select' | 'remove' | 'clear'
    | 'setVisible' | 'setProps' | 'editText' | 'commitText' | 'cancelText' | 'undo' | 'redo' | 'setUnits'
    | 'format' | 'toGeoJSON' | 'fromGeoJSON' | 'escape' | 'setSymbol' | 'rotate' | 'scale' | 'setTransform' | 'setRadius'>;

export type UseTeodolito = Snapshot & TeodolitoActions & { instance: Teodolito };

export function useCreateTeodolito(map: OlMap | null, options: TeodolitoOptions = {}): Teodolito | null {
    const [instance, setInstance] = useState<Teodolito | null>(null);
    const optionsRef = useRef(options);
    useEffect(() => {
        optionsRef.current = options;
    });
    useEffect(() => {
        if (!map) return undefined;
        const created = createTeodolito(map, {
            ...optionsRef.current,
            onEvent: (event) => optionsRef.current.onEvent?.(event),
        });
        setInstance(created);
        return () => {
            created.destroy();
            setInstance(null);
        };
    }, [map]);
    return instance;
}

function useInstanceSnapshot(instance: Teodolito): Snapshot {
    return useSyncExternalStore(instance.subscribe, instance.getSnapshot, instance.getSnapshot);
}

export function useSnapshot(): Snapshot {
    return useInstanceSnapshot(useTeodolitoInstance());
}

export function useTeodolito(): UseTeodolito {
    const instance = useTeodolitoInstance();
    const snapshot = useInstanceSnapshot(instance);
    const actions = useMemo((): TeodolitoActions & { instance: Teodolito } => ({
        instance,
        setTool: instance.setTool,
        removeLastPoint: instance.removeLastPoint,
        finishDrawing: instance.finishDrawing,
        abortDrawing: instance.abortDrawing,
        select: instance.select,
        remove: instance.remove,
        clear: instance.clear,
        setVisible: instance.setVisible,
        setProps: instance.setProps,
        editText: instance.editText,
        commitText: instance.commitText,
        cancelText: instance.cancelText,
        undo: instance.undo,
        redo: instance.redo,
        setUnits: instance.setUnits,
        format: instance.format,
        toGeoJSON: instance.toGeoJSON,
        fromGeoJSON: instance.fromGeoJSON,
        escape: instance.escape,
        setSymbol: instance.setSymbol,
        rotate: instance.rotate,
        scale: instance.scale,
        setTransform: instance.setTransform,
        setRadius: instance.setRadius,
    }), [instance]);
    return useMemo(() => ({ ...snapshot, ...actions }), [snapshot, actions]);
}

export function useMeasurement(id: string | null): Item | null {
    const instance = useTeodolitoInstance();
    const read = (): Item | null => (id ? instance.getSnapshot().items.find((item) => item.id === id) ?? null : null);
    return useSyncExternalStore(instance.subscribe, read, read);
}

export interface TextEditor {
    id: string;
    value: string;
    coordinate: Coordinate | null;
    commit(value: string): void;
    cancel(): void;
}

export function useTextEditor(): TextEditor | null {
    const instance = useTeodolitoInstance();
    const { editingTextId } = useInstanceSnapshot(instance);
    const item = useMeasurement(editingTextId);
    return useMemo(() => (editingTextId && item ? {
        id: editingTextId,
        value: item.text,
        coordinate: instance.getCoordinate(editingTextId),
        commit: instance.commitText,
        cancel: instance.cancelText,
    } : null), [editingTextId, item, instance]);
}
