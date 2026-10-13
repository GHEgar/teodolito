import { cachedElevation, createTerrainRgbProvider, type ElevationProvider, type LonLat } from 'teodolito';

const terrain = ([lon, lat]: LonLat): number => {
    const x = (lon + 103.35) * 60;
    const y = (lat - 20.67) * 60;
    return 1560 + 140 * Math.sin(x) * Math.cos(y * 0.8) + 45 * Math.sin(3.1 * x + 2.3 * y) + 15 * Math.cos(9 * y);
};

const wait = (ms: number, signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
});

export const syntheticElevation: ElevationProvider = {
    maxPoints: 200,
    async getElevations(points, { signal }) {
        await wait(120, signal);
        return points.map(terrain);
    },
};

export const terrarium: ElevationProvider = cachedElevation(createTerrainRgbProvider({
    url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    zoom: 12,
    encoding: 'terrarium',
    interpolate: true,
}));

export const providers = {
    synthetic: { name: 'Sintético', provider: syntheticElevation },
    terrarium: { name: 'Terrarium (AWS)', provider: terrarium },
} as const;

export type ProviderKey = keyof typeof providers;
