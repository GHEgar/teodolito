import type Geometry from 'ol/geom/Geometry.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeElevation, type Elevation, type ElevationProvider } from '../core/index.js';
import { useTeodolitoInstance } from './context.js';
import { useMeasurement } from './hooks.js';

export type ElevationStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ElevationKind = Elevation['kind'];

export interface UseElevationOptions {
    step?: number;
    maxSamples?: number;
    cells?: number;
    hypsometrySteps?: number;
    debounce?: number;
    kinds?: readonly ElevationKind[];
}

export interface ElevationResult {
    status: ElevationStatus;
    elevation: Elevation | null;
    error: unknown;
    refresh(): void;
}

const kindOf: Record<string, ElevationKind> = { Point: 'point', LineString: 'profile', Polygon: 'surface' };
const allKinds: readonly ElevationKind[] = ['point', 'profile', 'surface'];

interface Request {
    id: string;
    geometry: Geometry;
    options: { step?: number; maxSamples?: number; cells?: number; hypsometrySteps?: number };
    nonce: number;
}

interface Settled {
    request: Request;
    ok: boolean;
    elevation: Elevation | null;
    error: unknown;
}

const defined = (value: Record<keyof Request['options'], number | undefined>): Request['options'] => Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
);

export function useElevation(
    id: string | null,
    provider: ElevationProvider | null,
    options: UseElevationOptions = {},
): ElevationResult {
    const instance = useTeodolitoInstance();
    const item = useMeasurement(id);
    const [nonce, setNonce] = useState(0);
    const [settled, setSettled] = useState<Settled | null>(null);
    const { step, maxSamples, cells, hypsometrySteps, debounce = 250, kinds = allKinds } = options;
    const measure = item?.measure;
    const accepted = kinds.join(',');

    const request = useMemo((): Request | null => {
        const geometry = id && measure && provider ? instance.getFeature(id)?.getGeometry() : undefined;
        const kind = geometry ? kindOf[geometry.getType()] : undefined;
        if (!id || !geometry || !kind || !accepted.split(',').includes(kind)) return null;
        return { id, geometry, options: defined({ step, maxSamples, cells, hypsometrySteps }), nonce };
    }, [instance, id, measure, provider, step, maxSamples, cells, hypsometrySteps, accepted, nonce]);

    useEffect(() => {
        if (!request || !provider) return undefined;
        const controller = new AbortController();
        const run = (): void => {
            computeElevation(request.geometry, provider, {
                ...request.options,
                projection: instance.map.getView().getProjection(),
                signal: controller.signal,
            }).then(
                (elevation) => setSettled({ request, ok: true, elevation, error: null }),
                (error: unknown) => { if (!controller.signal.aborted) setSettled({ request, ok: false, elevation: null, error }); },
            );
        };
        const timer = setTimeout(run, debounce);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [instance, request, provider, debounce]);

    const refresh = useCallback(() => setNonce((value) => value + 1), []);
    if (!request) return { status: 'idle', elevation: null, error: null, refresh };
    if (settled?.request === request) {
        return { status: settled.ok ? 'ready' : 'error', elevation: settled.elevation, error: settled.error, refresh };
    }
    const stale = settled?.request.id === request.id ? settled.elevation : null;
    return { status: 'loading', elevation: stale, error: null, refresh };
}
