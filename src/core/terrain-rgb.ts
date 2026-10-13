import type { ElevationProvider } from './elevation.js';
import type { LonLat } from './sampling.js';

export type Decoder = (r: number, g: number, b: number, a: number) => number | null;
export type TileData = Uint8ClampedArray | Uint8Array;

export interface TerrainRgbOptions {
    url: string | ((z: number, x: number, y: number) => string);
    zoom: number;
    encoding: 'mapbox' | 'terrarium' | Decoder;
    tileSize?: number;
    interpolate?: boolean;
    maxTiles?: number;
    fetch?: typeof fetch;
    decode?: (blob: Blob, tileSize: number) => Promise<TileData | null>;
}

export const decoders: Record<'mapbox' | 'terrarium', Decoder> = {
    mapbox: (r, g, b, a) => (a < 250 ? null : -10_000 + (r * 65_536 + g * 256 + b) * 0.1),
    terrarium: (r, g, b, a) => (a < 250 ? null : r * 256 + g + b / 256 - 32_768),
};

export async function decodeImage(blob: Blob, tileSize: number): Promise<TileData | null> {
    const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const canvas = typeof OffscreenCanvas === 'function'
        ? new OffscreenCanvas(tileSize, tileSize)
        : Object.assign(document.createElement('canvas'), { width: tileSize, height: tileSize });
    const context = canvas.getContext('2d', { willReadFrequently: true }) as
        CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, tileSize, tileSize);
    bitmap.close();
    return context.getImageData(0, 0, tileSize, tileSize).data;
}

function raced<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
    if (!signal) return promise;
    signal.throwIfAborted();
    return new Promise<T>((resolve, reject) => {
        const abort = (): void => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
}

export function createTerrainRgbProvider(options: TerrainRgbOptions): ElevationProvider {
    const size = options.tileSize ?? 256;
    const zoom = options.zoom;
    const tiles = 2 ** zoom;
    const span = tiles * size;
    const decoder = typeof options.encoding === 'function' ? options.encoding : decoders[options.encoding];
    const maxTiles = options.maxTiles ?? 64;
    const cache = new Map<string, Promise<TileData | null>>();
    const url = (x: number, y: number): string => (typeof options.url === 'function'
        ? options.url(zoom, x, y)
        : options.url.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y)));

    const load = (x: number, y: number): Promise<TileData | null> => {
        const key = `${x}/${y}`;
        const cached = cache.get(key);
        if (cached) {
            cache.delete(key);
            cache.set(key, cached);
            return cached;
        }
        const request = (options.fetch ?? fetch)(url(x, y))
            .then((response) => (response.ok ? response.blob() : null))
            .then((blob) => (blob ? (options.decode ?? decodeImage)(blob, size) : null));
        request.catch(() => { if (cache.get(key) === request) cache.delete(key); });
        cache.set(key, request);
        while (cache.size > maxTiles) cache.delete(cache.keys().next().value as string);
        return request;
    };

    const pixel = ([lon, lat]: LonLat): [number, number] => {
        const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
        const x = ((lon + 180) / 360) * span;
        const y = ((1 - Math.asinh(Math.tan((clamped * Math.PI) / 180)) / Math.PI) / 2) * span;
        return [x, y];
    };
    const locate = (px: number, py: number): { key: string; tx: number; ty: number; ix: number; iy: number } => {
        const gx = ((Math.floor(px) % span) + span) % span;
        const gy = Math.max(0, Math.min(span - 1, Math.floor(py)));
        const tx = Math.floor(gx / size);
        const ty = Math.floor(gy / size);
        return { key: `${tx}/${ty}`, tx, ty, ix: gx - tx * size, iy: gy - ty * size };
    };
    const neighbours = ([x, y]: [number, number]): [number, number][] => {
        if (!options.interpolate) return [[x, y]];
        const fx = Math.floor(x - 0.5);
        const fy = Math.floor(y - 0.5);
        return [[fx, fy], [fx + 1, fy], [fx, fy + 1], [fx + 1, fy + 1]];
    };

    return {
        async getElevations(points, { signal } = {}) {
            const positions = points.map(pixel);
            const needed = new Map<string, { tx: number; ty: number }>();
            positions.forEach((position) => neighbours(position).forEach(([px, py]) => {
                const { key, tx, ty } = locate(px, py);
                needed.set(key, { tx, ty });
            }));
            const loaded = new Map<string, TileData | null>();
            await raced(Promise.all([...needed].map(async ([key, { tx, ty }]) => {
                loaded.set(key, await load(tx, ty));
            })), signal);
            const read = (px: number, py: number): number | null => {
                const { key, ix, iy } = locate(px, py);
                const data = loaded.get(key);
                if (!data) return null;
                const i = (iy * size + ix) * 4;
                return decoder(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, data[i + 3] ?? 0);
            };
            return positions.map(([x, y]) => {
                const nearest = read(x, y);
                if (!options.interpolate) return nearest;
                const fx = Math.floor(x - 0.5);
                const fy = Math.floor(y - 0.5);
                const [a, b, c, d] = [read(fx, fy), read(fx + 1, fy), read(fx, fy + 1), read(fx + 1, fy + 1)];
                if (a === null || b === null || c === null || d === null) return nearest;
                const tx = x - 0.5 - fx;
                const ty = y - 0.5 - fy;
                return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
            });
        },
    };
}
