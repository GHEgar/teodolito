import type { ElevationProvider } from './elevation.js';
import type { LonLat } from './sampling.js';

export interface CacheOptions {
    precision?: number;
    maxEntries?: number;
}

export function cachedElevation(provider: ElevationProvider, options: CacheOptions = {}): ElevationProvider {
    const precision = options.precision ?? 6;
    const maxEntries = options.maxEntries ?? 10_000;
    const cache = new Map<string, number | null>();
    const keyOf = ([lon, lat]: LonLat): string => `${lon.toFixed(precision)},${lat.toFixed(precision)}`;
    const remember = (key: string, value: number | null): void => {
        cache.delete(key);
        cache.set(key, value);
        while (cache.size > maxEntries) cache.delete(cache.keys().next().value as string);
    };
    return {
        ...(provider.maxPoints ? { maxPoints: provider.maxPoints } : {}),
        async getElevations(points, request) {
            const keys = points.map(keyOf);
            const missing = [...new Set(keys.filter((key) => !cache.has(key)))];
            if (missing.length) {
                const firstOf = new Map(keys.map((key, i) => [key, points[i] as LonLat] as const).reverse());
                const asked = missing.map((key) => firstOf.get(key) as LonLat);
                const answers = await provider.getElevations(asked, request);
                if (answers.length !== asked.length) {
                    throw new Error(`teodolito: the provider returned ${answers.length} elevations for ${asked.length} points.`);
                }
                missing.forEach((key, i) => remember(key, answers[i] ?? null));
            }
            return keys.map((key) => {
                const value = cache.get(key) ?? null;
                remember(key, value);
                return value;
            });
        },
    };
}
