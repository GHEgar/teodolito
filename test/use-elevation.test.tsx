import { act, renderHook, waitFor } from '@testing-library/react';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import { fromLonLat } from 'ol/proj.js';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { ElevationProvider, Teodolito } from '../src/core/index.js';
import { TeodolitoProvider, useElevation } from '../src/react/index.js';
import { draw, setup } from './helpers.js';

const byLongitude: ElevationProvider = { getElevations: async (points) => points.map(([lon]) => lon * 10_000) };
const square = [[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]].map((p) => fromLonLat(p));

function wrap(t: Teodolito) {
    return ({ children }: { children: ReactNode }) => <TeodolitoProvider value={t}>{children}</TeodolitoProvider>;
}

describe('useElevation', () => {
    it('da la superficie de un polígono y la recalcula al deshacer y rehacer', async () => {
        const t = setup();
        const id = draw(t, 'polygon', new Polygon([square]));
        const { result } = renderHook(() => useElevation(id, byLongitude, { debounce: 0, cells: 8 }), { wrapper: wrap(t) });
        await waitFor(() => expect(result.current.status).toBe('ready'));
        const elevation = result.current.elevation;
        expect(elevation?.kind).toBe('surface');
        if (elevation?.kind === 'surface') expect(elevation.surface.max?.elevation).toBeCloseTo(100, 6);
        act(() => { t.undo(); });
        expect(result.current.status).toBe('idle');
        act(() => { t.redo(); });
        await waitFor(() => expect(result.current.status).toBe('ready'));
    });

    it('da la altura de un punto', async () => {
        const t = setup();
        const id = draw(t, 'point', new Point(fromLonLat([0.002, 0])));
        const { result } = renderHook(() => useElevation(id, byLongitude, { debounce: 0 }), { wrapper: wrap(t) });
        await waitFor(() => expect(result.current.elevation).toEqual({ kind: 'point', elevation: expect.closeTo(20, 6) }));
    });

    it('kinds filtra las geometrías aceptadas', () => {
        const t = setup();
        const id = draw(t, 'point', new Point([0, 0]));
        const { result } = renderHook(() => useElevation(id, byLongitude, { kinds: ['surface'] }), { wrapper: wrap(t) });
        expect(result.current.status).toBe('idle');
    });
});
