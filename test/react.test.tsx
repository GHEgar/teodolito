import { act, render, renderHook, screen } from '@testing-library/react';
import Point from 'ol/geom/Point.js';
import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { TeodolitoProvider, useCreateTeodolito, useMeasurement, useTeodolito, useTextEditor } from '../src/react/index.js';
import { draw, setup } from './helpers.js';

describe('teodolito/react', () => {
    it('useTeodolito refleja herramienta, items y deshacer', () => {
        const t = setup();
        const wrapper = ({ children }: { children: ReactNode }) => <TeodolitoProvider value={t}>{children}</TeodolitoProvider>;
        const { result } = renderHook(() => useTeodolito(), { wrapper });
        expect(result.current.tool).toBeNull();
        act(() => { draw(t, 'point', new Point([0, 0])); });
        expect(result.current.tool).toBe('point');
        expect(result.current.items).toHaveLength(1);
        expect(result.current.canUndo).toBe(true);
        act(() => { result.current.undo(); });
        expect(result.current.items).toHaveLength(0);
    });

    it('useTeodolito renombra y cambia las marcas', () => {
        const t = setup();
        const id = draw(t, 'point', new Point([0, 0]));
        const wrapper = ({ children }: { children: ReactNode }) => <TeodolitoProvider value={t}>{children}</TeodolitoProvider>;
        const { result } = renderHook(() => useTeodolito(), { wrapper });
        act(() => { result.current.rename(id, 'Well'); });
        expect(result.current.items[0]?.name).toBe('Well');
        act(() => { result.current.setMarks({ segmentLabels: true }); });
        expect(result.current.marks.segmentLabels).toBe(true);
    });

    it('useMeasurement conserva la referencia mientras el item no cambia', () => {
        const t = setup();
        const id = draw(t, 'point', new Point([0, 0]));
        const wrapper = ({ children }: { children: ReactNode }) => <TeodolitoProvider value={t}>{children}</TeodolitoProvider>;
        const { result } = renderHook(() => useMeasurement(id), { wrapper });
        const first = result.current;
        act(() => { draw(t, 'point', new Point([1, 1])); });
        expect(result.current).toBe(first);
        act(() => { t.setProps(id, { color: 'blue' }); });
        expect(result.current?.props).toEqual({ color: 'blue' });
    });

    it('useTextEditor expone el texto en edición', () => {
        const t = setup();
        function Editor() {
            const editor = useTextEditor();
            return editor ? <button onClick={() => editor.commit('Hola')}>{editor.id}</button> : <span>nada</span>;
        }
        render(<TeodolitoProvider value={t}><Editor /></TeodolitoProvider>);
        expect(screen.getByText('nada')).toBeTruthy();
        let id = '';
        act(() => { id = draw(t, 'text', new Point([0, 0])); });
        act(() => { screen.getByText(id).click(); });
        expect(t.getSnapshot().items[0]?.text).toBe('Hola');
        expect(screen.getByText('nada')).toBeTruthy();
    });

    it('useCreateTeodolito crea y destruye con el mapa', () => {
        const map = new OlMap({ view: new View({ center: [0, 0], zoom: 2 }) });
        const { result, unmount } = renderHook(() => useCreateTeodolito(map, { keyboard: false }));
        expect(result.current).not.toBeNull();
        expect(map.getLayers().getLength()).toBe(2);
        unmount();
        expect(map.getLayers().getLength()).toBe(0);
    });
});
