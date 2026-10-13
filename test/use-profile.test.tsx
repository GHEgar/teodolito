import { act, renderHook, waitFor } from '@testing-library/react';
import LineString from 'ol/geom/LineString.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ElevationProvider, LonLat, Teodolito } from '../src/core/index.js';
import { TeodolitoProvider, useProfile } from '../src/react/index.js';
import { draw, move, setup } from './helpers.js';

const byLongitude: ElevationProvider = {
    getElevations: async (points: readonly LonLat[]) => points.map(([lon]) => lon * 10_000),
};

function line(t: Teodolito, to = 0.01): string {
    return draw(t, 'line', new LineString([fromLonLat([0, 0]), fromLonLat([to, 0])]));
}

function wrap(t: Teodolito) {
    return ({ children }: { children: ReactNode }) => <TeodolitoProvider value={t}>{children}</TeodolitoProvider>;
}

describe('useProfile', () => {
    it('queda en idle sin proveedor, sin id o con geometrías que no son línea', () => {
        const t = setup();
        const id = line(t);
        const point = draw(t, 'point', new Point([0, 0]));
        const { result, rerender } = renderHook(
            ({ target, provider }: { target: string | null; provider: ElevationProvider | null }) => useProfile(target, provider),
            { wrapper: wrap(t), initialProps: { target: id as string | null, provider: null as ElevationProvider | null } },
        );
        expect(result.current.status).toBe('idle');
        rerender({ target: null, provider: byLongitude });
        expect(result.current.status).toBe('idle');
        rerender({ target: point, provider: byLongitude });
        expect(result.current.status).toBe('idle');
    });

    it('calcula el perfil y lo recalcula al editar y al deshacer', async () => {
        const t = setup();
        const id = line(t);
        const { result } = renderHook(() => useProfile(id, byLongitude, { debounce: 0 }), { wrapper: wrap(t) });
        expect(result.current.status).toBe('loading');
        await waitFor(() => expect(result.current.status).toBe('ready'));
        expect(result.current.profile?.max?.elevation).toBeCloseTo(100, 6);
        const geometry = t.getFeature(id)?.getGeometry() as LineString;
        act(() => { move(t, id, () => geometry.setCoordinates([fromLonLat([0, 0]), fromLonLat([0.02, 0])])); });
        expect(result.current.status).toBe('loading');
        expect(result.current.profile?.max?.elevation).toBeCloseTo(100, 6);
        await waitFor(() => expect(result.current.profile?.max?.elevation).toBeCloseTo(200, 6));
        act(() => { t.undo(); });
        await waitFor(() => expect(result.current.profile?.max?.elevation).toBeCloseTo(100, 6));
    });

    it('agrupa cambios seguidos con el debounce y aborta lo anterior', async () => {
        vi.useFakeTimers();
        try {
            const t = setup();
            const id = line(t);
            const getElevations = vi.fn(byLongitude.getElevations);
            const provider = { getElevations };
            const geometry = t.getFeature(id)?.getGeometry() as LineString;
            renderHook(() => useProfile(id, provider, { debounce: 100 }), { wrapper: wrap(t) });
            for (const to of [0.02, 0.03, 0.04]) {
                act(() => { geometry.setCoordinates([fromLonLat([0, 0]), fromLonLat([to, 0])]); });
                await act(async () => { await vi.advanceTimersByTimeAsync(50); });
            }
            expect(getElevations).not.toHaveBeenCalled();
            await act(async () => { await vi.advanceTimersByTimeAsync(100); });
            expect(getElevations).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('reporta el error del proveedor y refresh vuelve a intentar', async () => {
        const t = setup();
        const id = line(t);
        let fail = true;
        const provider: ElevationProvider = {
            getElevations: async (points) => {
                if (fail) throw new Error('sin DEM');
                return points.map(() => 1);
            },
        };
        const { result } = renderHook(() => useProfile(id, provider, { debounce: 0 }), { wrapper: wrap(t) });
        await waitFor(() => expect(result.current.status).toBe('error'));
        expect((result.current.error as Error).message).toBe('sin DEM');
        fail = false;
        act(() => { result.current.refresh(); });
        await waitFor(() => expect(result.current.status).toBe('ready'));
        expect(result.current.profile?.netChange).toBe(0);
    });

    it('no reutiliza el perfil de otra medición mientras carga', async () => {
        const t = setup();
        const first = line(t);
        const second = line(t, 0.02);
        const { result, rerender } = renderHook(({ target }) => useProfile(target, byLongitude, { debounce: 0 }), {
            wrapper: wrap(t), initialProps: { target: first },
        });
        await waitFor(() => expect(result.current.status).toBe('ready'));
        rerender({ target: second });
        expect(result.current).toMatchObject({ status: 'loading', profile: null });
        await waitFor(() => expect(result.current.profile?.max?.elevation).toBeCloseTo(200, 6));
    });
});
