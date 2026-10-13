import type LineString from 'ol/geom/LineString.js';
import { toLonLat, type ProjectionLike } from 'ol/proj.js';
import { buildProfile, type Profile } from './profile.js';
import { sampleLine, type LonLat, type SampleOptions } from './sampling.js';

export interface ElevationRequest {
    signal?: AbortSignal;
}

export interface ElevationProvider {
    getElevations(points: readonly LonLat[], request: ElevationRequest): Promise<readonly (number | null)[]>;
    readonly maxPoints?: number;
}

export interface ProfileOptions extends SampleOptions {
    projection?: ProjectionLike;
    signal?: AbortSignal;
}

export async function requestElevations(
    provider: ElevationProvider,
    points: readonly LonLat[],
    request: ElevationRequest = {},
): Promise<(number | null)[]> {
    const size = provider.maxPoints && provider.maxPoints > 0 ? provider.maxPoints : points.length || 1;
    const result: (number | null)[] = [];
    for (let start = 0; start < points.length; start += size) {
        request.signal?.throwIfAborted();
        const batch = points.slice(start, start + size);
        const elevations = await provider.getElevations(batch, request);
        if (elevations.length !== batch.length) {
            throw new Error(`teodolito: el proveedor devolvió ${elevations.length} alturas para ${batch.length} puntos.`);
        }
        result.push(...elevations);
    }
    request.signal?.throwIfAborted();
    return result;
}

export async function computeProfile(
    geometry: LineString,
    provider: ElevationProvider,
    options: ProfileOptions = {},
): Promise<Profile> {
    const projection = options.projection ?? 'EPSG:3857';
    const lonLats = geometry.getCoordinates().map((coordinate) => toLonLat(coordinate, projection) as unknown as LonLat);
    const samples = sampleLine(lonLats, options);
    const request = options.signal ? { signal: options.signal } : {};
    return buildProfile(samples, await requestElevations(provider, samples.map((sample) => sample.lonLat), request));
}
