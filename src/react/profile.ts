import type LineString from 'ol/geom/LineString.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeProfile, type ElevationProvider, type Profile } from '../core/index.js';
import { useTeodolitoInstance } from './context.js';
import { useMeasurement } from './hooks.js';

export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseProfileOptions {
    step?: number;
    maxSamples?: number;
    debounce?: number;
}

export interface ProfileResult {
    status: ProfileStatus;
    profile: Profile | null;
    error: unknown;
    refresh(): void;
}

interface Request {
    id: string;
    geometry: LineString;
    step: number | undefined;
    maxSamples: number | undefined;
    nonce: number;
}

interface Settled {
    request: Request;
    ok: boolean;
    profile: Profile | null;
    error: unknown;
}

export function useProfile(
    id: string | null,
    provider: ElevationProvider | null,
    options: UseProfileOptions = {},
): ProfileResult {
    const instance = useTeodolitoInstance();
    const item = useMeasurement(id);
    const [nonce, setNonce] = useState(0);
    const [settled, setSettled] = useState<Settled | null>(null);
    const { step, maxSamples, debounce = 250 } = options;
    const measure = item?.measure;

    const request = useMemo((): Request | null => {
        const geometry = id && measure && provider ? instance.getFeature(id)?.getGeometry() : undefined;
        if (!id || !geometry || geometry.getType() !== 'LineString') return null;
        return { id, geometry: geometry as LineString, step, maxSamples, nonce };
    }, [instance, id, measure, provider, step, maxSamples, nonce]);

    useEffect(() => {
        if (!request || !provider) return undefined;
        const controller = new AbortController();
        const run = (): void => {
            computeProfile(request.geometry, provider, {
                projection: instance.map.getView().getProjection(),
                signal: controller.signal,
                ...(request.step === undefined ? {} : { step: request.step }),
                ...(request.maxSamples === undefined ? {} : { maxSamples: request.maxSamples }),
            }).then(
                (profile) => setSettled({ request, ok: true, profile, error: null }),
                (error: unknown) => { if (!controller.signal.aborted) setSettled({ request, ok: false, profile: null, error }); },
            );
        };
        const timer = setTimeout(run, debounce);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [instance, request, provider, debounce]);

    const refresh = useCallback(() => setNonce((value) => value + 1), []);
    if (!request) return { status: 'idle', profile: null, error: null, refresh };
    if (settled?.request === request) {
        return { status: settled.ok ? 'ready' : 'error', profile: settled.profile, error: settled.error, refresh };
    }
    const stale = settled?.request.id === request.id ? settled.profile : null;
    return { status: 'loading', profile: stale, error: null, refresh };
}
