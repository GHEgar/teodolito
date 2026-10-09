import Collection from 'ol/Collection.js';
import Feature from 'ol/Feature.js';
import type Geometry from 'ol/geom/Geometry.js';
import Draw, { DrawEvent } from 'ol/interaction/Draw.js';
import Translate, { TranslateEvent } from 'ol/interaction/Translate.js';
import OlMap from 'ol/Map.js';
import type MapBrowserEvent from 'ol/MapBrowserEvent.js';
import View from 'ol/View.js';
import { createTeodolito, type Teodolito, type TeodolitoOptions, type Tool } from '../src/core/index.js';

export function setup(options: TeodolitoOptions = {}): Teodolito {
    const map = new OlMap({ view: new View({ center: [0, 0], zoom: 2 }) });
    return createTeodolito(map, { keyboard: false, ...options });
}

function interaction<T>(t: Teodolito, type: abstract new (...args: never[]) => T): T {
    const found = t.map.getInteractions().getArray().find((candidate) => candidate instanceof type);
    if (!found) throw new Error('interaction not found');
    return found as T;
}

export function draw(t: Teodolito, tool: Tool, geometry: Geometry): string {
    t.setTool(tool);
    const feature = new Feature(geometry);
    const interactionDraw = interaction(t, Draw);
    interactionDraw.dispatchEvent(new DrawEvent('drawstart', feature));
    interactionDraw.dispatchEvent(new DrawEvent('drawend', feature));
    const items = t.getSnapshot().items;
    return items[items.length - 1]?.id ?? '';
}

export function move(t: Teodolito, id: string, change: () => void): void {
    const translate = interaction(t, Translate);
    const features = new Collection([t.getFeature(id) as Feature<Geometry>]);
    const event = null as unknown as MapBrowserEvent;
    translate.dispatchEvent(new TranslateEvent('translatestart', features, [0, 0], [0, 0], event));
    change();
    translate.dispatchEvent(new TranslateEvent('translateend', features, [0, 0], [0, 0], event));
}
