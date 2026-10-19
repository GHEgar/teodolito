import LineString from 'ol/geom/LineString.js';
import { describe, expect, it, vi } from 'vitest';
import type { ToolArbiter } from '../src/core/index.js';
import { draw, setup } from './helpers.js';

const fakeArbiter = () => {
    const claims: { tool: string; escape: (() => void) | undefined }[] = [];
    const release = vi.fn();
    const arbiter: ToolArbiter = {
        claim(tool, handlers) {
            claims.push({ tool, escape: handlers.escape });
            return release;
        },
    };
    return { arbiter, claims, release };
};

describe('árbitro', () => {
    it('reclama el clic al activar, lo conserva al cambiar de herramienta y lo suelta al apagar', () => {
        const { arbiter, claims, release } = fakeArbiter();
        const t = setup({ arbiter });
        expect(claims).toHaveLength(0);
        t.setTool('line');
        t.setTool('polygon');
        expect(claims.map(claim => claim.tool)).toEqual(['measure']);
        expect(release).not.toHaveBeenCalled();
        t.setTool(null);
        expect(release).toHaveBeenCalledTimes(1);
        t.setTool('point');
        expect(claims).toHaveLength(2);
    });

    it('usa el nombre de herramienta que se le pase', () => {
        const { arbiter, claims } = fakeArbiter();
        setup({ arbiter, tool: 'draw' }).setTool('line');
        expect(claims[0]?.tool).toBe('draw');
    });

    it('el escape del árbitro apaga la herramienta sin soltar otra vez', () => {
        const { arbiter, claims, release } = fakeArbiter();
        const events: unknown[] = [];
        const t = setup({ arbiter, onEvent: event => events.push(event) });
        draw(t, 'line', new LineString([[0, 0], [1000, 0]]));
        t.select(t.getSnapshot().items[0]?.id ?? null);
        claims[0]?.escape?.();
        expect(t.getSnapshot().tool).toBeNull();
        expect(t.getSnapshot().selectedId).toBeNull();
        expect(events.at(-1)).toEqual({ type: 'tool', tool: null });
        expect(release).not.toHaveBeenCalled();
        t.setTool('line');
        expect(claims).toHaveLength(2);
    });

    it('suelta el clic al destruirse', () => {
        const { arbiter, release } = fakeArbiter();
        const t = setup({ arbiter });
        t.setTool('line');
        t.destroy();
        expect(release).toHaveBeenCalledTimes(1);
    });
});

describe('zIndex', () => {
    it('queda en 1000 por omisión y acepta la banda de herramientas', () => {
        expect(setup().layer.getZIndex()).toBe(1000);
        expect(setup({ zIndex: 950 }).layer.getZIndex()).toBe(950);
    });
});
