import type Feature from 'ol/Feature.js';
import type Geometry from 'ol/geom/Geometry.js';
import type Draw from 'ol/interaction/Draw.js';
import type OlMap from 'ol/Map.js';
import type { EventsKey } from 'ol/events.js';
import { unByKey } from 'ol/Observable.js';
import type { ProjectionLike } from 'ol/proj.js';
import type { StyleLike } from 'ol/style/Style.js';
import { createDraw } from './interactions.js';
import { measureGeometry, type Measure } from './measure.js';
import type { Tool } from './types.js';

export interface DrawingOptions {
    map: OlMap;
    tool: Tool;
    style: StyleLike;
    projection(): ProjectionLike;
    onSketch(measure: Measure | null): void;
    onEnd(feature: Feature<Geometry>): void;
}

export interface Drawing {
    readonly draw: Draw;
    stop(): void;
}

export function startDrawing(options: DrawingOptions): Drawing {
    const draw = createDraw(options.tool, options.style);
    let geometryKey: EventsKey | null = null;

    const release = (): void => {
        if (geometryKey) unByKey(geometryKey);
        geometryKey = null;
    };

    draw.on('drawstart', (event) => {
        const geometry = event.feature.getGeometry();
        if (!geometry) return;
        options.onSketch(measureGeometry(geometry, options.projection()));
        geometryKey = geometry.on('change', () => {
            options.onSketch(measureGeometry(geometry, options.projection()));
        });
    });
    draw.on('drawend', (event) => {
        release();
        options.onSketch(null);
        options.onEnd(event.feature as Feature<Geometry>);
    });
    draw.on('drawabort', () => {
        release();
        options.onSketch(null);
    });

    options.map.addInteraction(draw);

    return {
        draw,
        stop() {
            draw.abortDrawing();
            release();
            options.map.removeInteraction(draw);
        },
    };
}
