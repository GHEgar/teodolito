import type { Coordinate } from 'ol/coordinate.js';
import type Geometry from 'ol/geom/Geometry.js';
import type { ProjectionLike } from 'ol/proj.js';
import type { Commands } from './commands.js';
import type { Registry } from './registry.js';
import {
    centerOf, clamp, rotateGeometry, scaleGeometry, setCircle, styled,
} from './transform.js';
import type { Kind } from './types.js';

export interface TransformDeps {
    registry: Registry;
    commands: Commands;
    recorded<T>(result: T): T;
    projection(): ProjectionLike;
    sides: number;
    limits: readonly [number, number];
}

export interface StyleTransform {
    rotation?: number;
    scale?: number;
}

export interface Transforms {
    rotate(id: string, radians: number, anchor?: Coordinate): boolean;
    scale(id: string, factor: number, anchor?: Coordinate): boolean;
    setTransform(id: string, transform: StyleTransform): boolean;
    setRadius(id: string, meters: number): boolean;
}

export function createTransforms(deps: TransformDeps): Transforms {
    const { registry, commands, recorded } = deps;

    const geometric = (id: string, change: (kind: Kind, geometry: Geometry) => boolean): boolean => {
        const item = registry.item(id);
        const geometry = registry.feature(id)?.getGeometry();
        if (!item || !geometry) return false;
        const before = commands.snapshotGeometry([id]);
        return change(item.kind, geometry) ? recorded(commands.geometry(before)) : false;
    };

    const setTransform = (id: string, transform: StyleTransform): boolean => {
        const item = registry.item(id);
        if (!item || !styled(item.kind)) return false;
        const patch = {
            ...(transform.rotation === undefined ? {} : { rotation: transform.rotation }),
            ...(transform.scale === undefined ? {} : { scale: clamp(transform.scale, deps.limits) }),
        };
        return recorded(commands.update(id, patch));
    };

    return {
        rotate(id, radians, anchor) {
            const item = registry.item(id);
            if (item && styled(item.kind)) return setTransform(id, { rotation: item.rotation + radians });
            return geometric(id, (kind, geometry) => (
                rotateGeometry(kind, geometry, -radians, anchor ?? centerOf(kind, geometry, deps.projection()))
            ));
        },
        scale(id, factor, anchor) {
            const item = registry.item(id);
            if (item && styled(item.kind)) return setTransform(id, { scale: item.scale * factor });
            return geometric(id, (kind, geometry) => {
                const center = anchor ?? centerOf(kind, geometry, deps.projection());
                return scaleGeometry(kind, geometry, factor, center, deps.projection(), deps.sides);
            });
        },
        setTransform,
        setRadius(id, meters) {
            return geometric(id, (kind, geometry) => {
                if (kind !== 'circle' || !(meters > 0)) return false;
                setCircle(geometry, centerOf(kind, geometry, deps.projection()), meters, deps.projection(), deps.sides);
                return true;
            });
        },
    };
}
