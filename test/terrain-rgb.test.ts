import { afterEach, describe, expect, it, vi } from 'vitest';
import { cachedElevation, createTerrainRgbProvider, decodeImage, decoders, type LonLat, type TerrainRgbOptions } from '../src/core/index.js';

const size = 4;
const latOf = (y: number, span: number): number => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / span))) * 180) / Math.PI;
const at = (px: number, py: number, zoom = 0): LonLat => {
    const span = 2 ** zoom * size;
    return [(px / span) * 360 - 180, latOf(py, span)];
};

function tile(tx: number, ty: number): Uint8ClampedArray {
    const data = new Uint8ClampedArray(size * size * 4);
    for (let iy = 0; iy < size; iy += 1) {
        for (let ix = 0; ix < size; ix += 1) {
            const i = (iy * size + ix) * 4;
            data.set([(tx * size + ix) * 10 + iy, ty, 0, 255], i);
        }
    }
    return data;
}

function setup(extra: Partial<TerrainRgbOptions> = {}) {
    const fetcher = vi.fn(async (url: string) => {
        if (url.includes('404')) return new Response(null, { status: 404 });
        return new Response(url);
    });
    const decode = vi.fn(async (blob: Blob) => {
        const [, x, y] = (await blob.text()).split('/').map(Number);
        return tile(x ?? 0, y ?? 0);
    });
    const provider = createTerrainRgbProvider({
        url: '{z}/{x}/{y}', zoom: 0, tileSize: size, encoding: (r) => r,
        fetch: fetcher as unknown as typeof fetch, decode, ...extra,
    });
    return { provider, fetcher, decode };
}

describe('decoders', () => {
    it('mapbox y terrarium', () => {
        expect(decoders.mapbox(1, 134, 160, 255)).toBeCloseTo(0, 6);
        expect(decoders.terrarium(128, 0, 0, 255)).toBe(0);
        expect(decoders.terrarium(134, 59, 128, 255)).toBe(1595.5);
        expect(decoders.mapbox(1, 134, 160, 0)).toBeNull();
    });
});

describe('createTerrainRgbProvider', () => {
    it('lee el píxel más cercano', async () => {
        const { provider } = setup();
        expect(await provider.getElevations([at(1.5, 2.5), at(3.9, 0.2)], {})).toEqual([12, 30]);
    });

    it('interpola entre píxeles', async () => {
        const { provider } = setup({ interpolate: true });
        const [center, between] = await provider.getElevations([at(1.5, 2.5), at(2, 2.5)], {});
        expect(center).toBeCloseTo(12, 6);
        expect(between).toBeCloseTo(17, 6);
    });

    it('interpola a través del borde de la tesela', async () => {
        const { provider, fetcher } = setup({ zoom: 1, interpolate: true });
        const [value] = await provider.getElevations([at(4, 2.5, 1)], {});
        expect(value).toBeCloseTo(37, 6);
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('pide cada tesela una vez y la guarda; respeta maxTiles', async () => {
        const { provider, fetcher } = setup({ zoom: 1, maxTiles: 1 });
        await provider.getElevations([at(1, 1, 1), at(2, 2, 1)], {});
        await provider.getElevations([at(1, 1, 1)], {});
        expect(fetcher).toHaveBeenCalledTimes(1);
        await provider.getElevations([at(5, 1, 1)], {});
        await provider.getElevations([at(1, 1, 1)], {});
        expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it('una tesela que no existe da null', async () => {
        const { provider } = setup({ url: '404/{x}/{y}' });
        expect(await provider.getElevations([at(1, 1)], {})).toEqual([null]);
    });

    it('abortar no envenena la caché', async () => {
        const { provider, fetcher } = setup();
        const controller = new AbortController();
        const first = provider.getElevations([at(1.5, 2.5)], { signal: controller.signal });
        controller.abort();
        await expect(first).rejects.toThrow();
        expect(await provider.getElevations([at(1.5, 2.5)], {})).toEqual([12]);
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
});

describe('cachedElevation', () => {
    it('no repite puntos ya pedidos ni duplicados', async () => {
        const getElevations = vi.fn(async (points: readonly LonLat[]) => points.map(([lon]) => lon));
        const cached = cachedElevation({ getElevations, maxPoints: 7 }, { precision: 3 });
        expect(cached.maxPoints).toBe(7);
        expect(await cached.getElevations([[1, 0], [1, 0], [2, 0]], {})).toEqual([1, 1, 2]);
        expect(getElevations).toHaveBeenLastCalledWith([[1, 0], [2, 0]], {});
        expect(await cached.getElevations([[1.0001, 0], [3, 0]], {})).toEqual([1, 3]);
        expect(getElevations).toHaveBeenLastCalledWith([[3, 0]], {});
    });
});

describe('decodeImage', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('lee los píxeles de un contexto creado con willReadFrequently', async () => {
        const data = new Uint8ClampedArray(16);
        const context = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data })) };
        const getContext = vi.fn(() => context);
        const close = vi.fn();
        vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close })));
        vi.stubGlobal('OffscreenCanvas', vi.fn(function OffscreenCanvas() {
            return { getContext };
        }));
        await expect(decodeImage(new Blob(), 2)).resolves.toBe(data);
        expect(getContext).toHaveBeenCalledWith('2d', { willReadFrequently: true });
        expect(close).toHaveBeenCalled();
    });

    it('sin OffscreenCanvas usa un canvas del documento con willReadFrequently', async () => {
        const data = new Uint8ClampedArray(16);
        const context = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data })) };
        vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close: vi.fn() })));
        vi.stubGlobal('OffscreenCanvas', undefined);
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
        await expect(decodeImage(new Blob(), 2)).resolves.toBe(data);
        expect(getContext).toHaveBeenCalledWith('2d', { willReadFrequently: true });
        getContext.mockRestore();
    });
});
