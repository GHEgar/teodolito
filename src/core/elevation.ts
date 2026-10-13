import type { Coordinate } from 'ol/coordinate.js';
import type Geometry from 'ol/geom/Geometry.js';
import type LineString from 'ol/geom/LineString.js';
import type Point from 'ol/geom/Point.js';
import type Polygon from 'ol/geom/Polygon.js';
import { toLonLat, type ProjectionLike } from 'ol/proj.js';
import { getArea } from 'ol/sphere.js';
import { buildProfile, type Profile } from './profile.js';
import { sampleLine, type LonLat, type SampleOptions } from './sampling.js';
import { buildGrid, buildSurface, type Surface, type SurfaceOptions } from './surface.js';

export interface ElevationRequest {
    signal?: AbortSignal;
}

export interface ElevationProvider {
    getElevations(points: readonly LonLat[], request: ElevationRequest): Promise<readonly (number | null)[]>;
    readonly maxPoints?: number;
}

export interface ElevationOptions {
    projection?: ProjectionLike;
    signal?: AbortSignal;
}

export interface ProfileOptions extends SampleOptions, ElevationOptions {}

export interface SurfaceComputeOptions extends SurfaceOptions, ElevationOptions {}

export type Elevation =
    | { readonly kind: 'point'; readonly elevation: number | null }
    | { readonly kind: 'profile'; readonly profile: Profile }
    | { readonly kind: 'surface'; readonly surface: Surface };

const lonLat = (coordinate: Coordinate, projection: ProjectionLike): LonLat => {
    const [lon = 0, lat = 0] = toLonLat(coordinate, projection);
    return [lon, lat];
};
const requestOf = (options: ElevationOptions): ElevationRequest => (options.signal ? { signal: options.signal } : {});

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
    const samples = sampleLine(geometry.getCoordinates().map((c) => lonLat(c, projection)), options);
    return buildProfile(samples, await requestElevations(provider, samples.map((sample) => sample.lonLat), requestOf(options)));
}

export async function getPointElevation(
    geometry: Point,
    provider: ElevationProvider,
    options: ElevationOptions = {},
): Promise<number | null> {
    const point = lonLat(geometry.getCoordinates(), options.projection ?? 'EPSG:3857');
    const [elevation = null] = await requestElevations(provider, [point], requestOf(options));
    return typeof elevation === 'number' && Number.isFinite(elevation) ? elevation : null;
}

export async function computeSurface(
    geometry: Polygon,
    provider: ElevationProvider,
    options: SurfaceComputeOptions = {},
): Promise<Surface> {
    const projection = options.projection ?? 'EPSG:3857';
    const rings = geometry.getCoordinates().map((ring) => ring.map((c) => lonLat(c, projection)));
    const grid = buildGrid(rings, options.cells);
    const elevations = await requestElevations(provider, [...grid.nodes, ...grid.extra], requestOf(options));
    return buildSurface(grid, rings, elevations, getArea(geometry, { projection }), options);
}

export async function computeElevation(
    geometry: Geometry,
    provider: ElevationProvider,
    options: ProfileOptions & SurfaceComputeOptions = {},
): Promise<Elevation | null> {
    switch (geometry.getType()) {
        case 'Point':
            return { kind: 'point', elevation: await getPointElevation(geometry as Point, provider, options) };
        case 'LineString':
            return { kind: 'profile', profile: await computeProfile(geometry as LineString, provider, options) };
        case 'Polygon':
            return { kind: 'surface', surface: await computeSurface(geometry as Polygon, provider, options) };
        default:
            return null;
    }
}
