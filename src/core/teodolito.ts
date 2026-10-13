import type Feature from 'ol/Feature.js';
import type Geometry from 'ol/geom/Geometry.js';
import type SimpleGeometry from 'ol/geom/SimpleGeometry.js';
import VectorLayer from 'ol/layer/Vector.js';
import type OlMap from 'ol/Map.js';
import VectorSource from 'ol/source/Vector.js';
import { createTransforms } from './actions.js';
import type { Teodolito } from './api.js';
import { createCommands } from './commands.js';
import { startDrawing, type Drawing } from './drawing.js';
import { defaultUnits, formatMeasure, type Units } from './format.js';
import { readCollection, writeCollection } from './geojson.js';
import { createHandles } from './handles.js';
import { createHistory } from './history.js';
import { createEditing } from './interactions.js';
import { listenKeys } from './keyboard.js';
import { measureGeometry, type Measure } from './measure.js';
import { createRegistry, type Entry } from './registry.js';
import { listenPointer } from './pointer.js';
import { createStore } from './store.js';
import { handleStyle, layerStyle, sketchStyle } from './styling.js';
import type { Item, Kind, Props, Snapshot, TeodolitoEvent, TeodolitoOptions, Tool } from './types.js';
import { createTextEditing } from './text.js';

let counter = 0;
const newId = (): string => `t${Date.now().toString(36)}${(counter++).toString(36)}`;

export function createTeodolito(map: OlMap, options: TeodolitoOptions = {}): Teodolito {
    const emit = (event: TeodolitoEvent): void => options.onEvent?.(event);
    const projection = () => map.getView().getProjection();
    const defaultProps = (kind: Kind): Props => options.defaultProps?.(kind) ?? {};
    const store = createStore<Snapshot>({
        tool: null, drawing: false, sketch: null, items: [], selectedId: null, editingTextId: null,
        symbol: options.symbol ?? '', units: { ...defaultUnits, ...options.units }, canUndo: false, canRedo: false,
    });
    const sides = options.circleSides ?? 64;
    const limits = options.scaleLimits ?? [0.25, 4] as const;
    const history = createHistory(options.historyLimit);
    const source = new VectorSource<Feature<Geometry>>();
    const registry = createRegistry(source, (items) => store.set({ items }));
    const syncHistory = (): void => store.set({ canUndo: history.canUndo(), canRedo: history.canRedo() });
    const format = (measure: Measure): string => formatMeasure(measure, {
        ...options.format, units: store.get().units, ...(options.locale ? { locale: options.locale } : {}),
    });
    const styling = {
        style: options.style,
        item: registry.item,
        selectedId: () => store.get().selectedId,
        editingId: () => store.get().editingTextId,
        tool: () => store.get().tool,
        symbol: () => store.get().symbol,
        label: (kind: Kind, measure: Measure, text: string) => (kind === 'text' ? text : format(measure)),
        defaultProps,
        projection,
    };
    const layer = new VectorLayer({ source, style: layerStyle(styling), zIndex: options.zIndex ?? 1000 });
    map.addLayer(layer);

    const refresh = (id: string | null): void => { if (id) registry.feature(id)?.changed(); };
    const select = (id: string | null): void => {
        const previous = store.get().selectedId;
        const next = id && registry.item(id) ? id : null;
        if (previous === next) return;
        const kind = next ? registry.item(next)?.kind : undefined;
        editing.select((next && registry.feature(next)) || null, kind !== 'circle' && kind !== 'rectangle');
        handles?.show(next);
        store.set({ selectedId: next });
        refresh(previous);
        refresh(next);
        emit({ type: 'select', id: next });
    };
    const ops = {
        insert(entry: Entry) {
            registry.insert(entry.feature, entry.item, entry.index);
            emit({ type: 'add', id: entry.item.id });
        },
        detach(id: string) {
            if (store.get().selectedId === id) select(null);
            if (store.get().editingTextId === id) store.set({ editingTextId: null });
            const entry = registry.detach(id);
            if (entry) emit({ type: 'remove', id });
            return entry;
        },
        update(id: string, patch: Partial<Item>) {
            registry.update(id, patch);
            emit({ type: 'change', id });
        },
        coordinates: (id: string) => (registry.feature(id)?.getGeometry() as SimpleGeometry | undefined)?.getCoordinates(),
        setCoordinates(id: string, coordinates: unknown) {
            const geometry = registry.feature(id)?.getGeometry() as SimpleGeometry | undefined;
            geometry?.setCoordinates(coordinates as never);
        },
    };
    const commands = createCommands(ops, registry, history);
    const recorded = <T>(result: T): T => { syncHistory(); return result; };
    let pendingGeometry: Map<string, string> | null = null;
    const editing = createEditing(map, source, {
        vertexStyle: options.vertexStyle,
        snap: options.snap ?? true,
        snapTolerance: options.snapTolerance ?? 10,
        onStart: (features) => { pendingGeometry = commands.snapshotGeometry(features.map((f) => String(f.getId()))); },
        onEnd: () => {
            if (pendingGeometry) recorded(commands.geometry(pendingGeometry));
            pendingGeometry = null;
        },
    });
    const text = createTextEditing({ store, registry, ops, commands, recorded, emit });
    const transforms = createTransforms({ registry, commands, recorded, projection, sides, limits });
    const handles = options.handles === false ? null : createHandles({
        map, registry, commands, recorded, projection, sides, limits,
        update: ops.update,
        style: options.handleStyle ?? handleStyle(styling),
        zIndex: (options.zIndex ?? 1000) + 1,
        tolerance: options.hitTolerance ?? 8,
    });

    source.on('changefeature', (event) => {
        const id = event.feature?.getId();
        if (id !== undefined && registry.remeasure(String(id), projection())) emit({ type: 'change', id: String(id) });
    });

    let drawing: Drawing | null = null;
    const onDrawEnd = (tool: Tool, feature: Feature<Geometry>): void => {
        const geometry = feature.getGeometry() as Geometry;
        const id = newId();
        ops.insert({
            feature,
            item: {
                id, kind: tool, measure: measureGeometry(geometry, projection(), tool), text: '', props: defaultProps(tool),
                visible: true, symbol: tool === 'symbol' ? store.get().symbol : '', rotation: 0, scale: 1,
            },
            index: Number.POSITIVE_INFINITY,
        });
        if (tool === 'text') text.begin(id, true);
        else recorded(commands.add(id));
        if (options.once) queueMicrotask(() => setTool(null));
    };
    const setTool = (tool: Tool | null): void => {
        if (store.get().tool === tool) return;
        drawing?.stop();
        drawing = null;
        if (tool) text.cancel();
        select(null);
        store.set({ tool, drawing: false, sketch: null });
        if (tool) {
            drawing = startDrawing({
                map, tool, projection, circleSides: sides,
                style: sketchStyle(styling),
                onSketch: (sketch) => store.set({ sketch, drawing: sketch !== null }),
                onEnd: (feature) => onDrawEnd(tool, feature),
            });
            editing.raiseSnap();
        }
        emit({ type: 'tool', tool });
    };

    const unlistenPointer = listenPointer({
        map, layer,
        hitTolerance: options.hitTolerance ?? 6,
        active: () => !store.get().tool,
        blocked: (event) => handles?.at(event.pixel) ?? false,
        onClick: select,
        onDoubleClick(id, event) {
            if (registry.item(id)?.kind !== 'text') return;
            event.preventDefault();
            event.stopPropagation();
            text.begin(id, false);
        },
    });

    const undo = (): boolean => { text.cancel(); return recorded(history.undo()) && (emit({ type: 'undo' }), true); };
    const redo = (): boolean => { text.cancel(); return recorded(history.redo()) && (emit({ type: 'redo' }), true); };
    const removeLastPoint = (): void => drawing?.draw.removeLastPoint();
    const remove = (id: string): boolean => recorded(commands.remove(id));
    const escape = (): boolean => {
        const state = store.get();
        if (state.drawing) drawing?.draw.abortDrawing();
        else if (state.editingTextId) text.cancel();
        else if (state.selectedId) select(null);
        else if (state.tool) setTool(null);
        else return false;
        return true;
    };
    const unlistenKeys = options.keyboard === false ? () => undefined : listenKeys(window, {
        escape,
        undo: () => (store.get().drawing ? (removeLastPoint(), true) : undo()),
        redo,
        remove: () => {
            const { drawing: busy, selectedId } = store.get();
            if (busy) { removeLastPoint(); return true; }
            return selectedId ? remove(selectedId) : false;
        },
    });

    return {
        map, layer, source,
        getSnapshot: store.get,
        subscribe: store.subscribe,
        setTool,
        setSymbol: (symbol) => store.set({ symbol }),
        ...transforms,
        removeLastPoint,
        finishDrawing: () => drawing?.draw.finishDrawing(),
        abortDrawing: () => drawing?.draw.abortDrawing(),
        select,
        remove,
        clear: () => recorded(commands.clear()) && (emit({ type: 'clear' }), true),
        setVisible: (id, visible) => ops.update(id, { visible }),
        setProps: (id, props) => recorded(commands.update(id, { props: { ...registry.item(id)?.props, ...props } })),
        editText: (id) => text.begin(id, false),
        commitText: text.commit,
        cancelText: text.cancel,
        undo,
        redo,
        setUnits: (units) => { store.set({ units: { ...store.get().units, ...units } }); layer.changed(); },
        format,
        getFeature: (id) => registry.feature(id) ?? null,
        getCoordinate: (id) => {
            const geometry = registry.feature(id)?.getGeometry();
            if (!geometry) return null;
            return geometry.getType() === 'Polygon'
                ? (geometry as unknown as { getInteriorPoint(): SimpleGeometry }).getInteriorPoint().getFlatCoordinates().slice(0, 2)
                : (geometry as SimpleGeometry).getLastCoordinate();
        },
        toGeoJSON: () => writeCollection(
            registry.ids().map((id) => [registry.feature(id) as Feature<Geometry>, registry.item(id) as Item]),
            projection(),
        ),
        fromGeoJSON(collection) {
            setTool(null);
            registry.ids().forEach((id) => ops.detach(id));
            readCollection(collection, projection()).forEach((parsed) => {
                const geometry = parsed.feature.getGeometry() as Geometry;
                const id = parsed.id && !registry.item(parsed.id) ? parsed.id : newId();
                registry.insert(parsed.feature, {
                    id, kind: parsed.kind, measure: measureGeometry(geometry, projection(), parsed.kind),
                    text: parsed.text, props: parsed.props, visible: parsed.visible,
                    symbol: parsed.symbol, rotation: parsed.rotation, scale: parsed.scale,
                });
            });
            history.clear();
            syncHistory();
            emit({ type: 'load' });
        },
        escape,
        destroy() {
            setTool(null);
            unlistenKeys();
            unlistenPointer();
            handles?.dispose();
            editing.dispose();
            map.removeLayer(layer);
        },
    };
}
