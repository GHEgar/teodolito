import type Geometry from 'ol/geom/Geometry.js';
import type { ProjectionLike } from 'ol/proj.js';
import { toLonLat } from 'ol/proj.js';
import { getArea, getLength } from 'ol/sphere.js';

export type Measure =
    | { kind: 'length'; length: number }
    | { kind: 'area'; area: number; perimeter: number }
    | { kind: 'point'; lonLat: [number, number] }
    | { kind: 'none' };

export function measureGeometry(geometry: Geometry, projection: ProjectionLike = 'EPSG:3857'): Measure {
    const options = { projection };
    switch (geometry.getType()) {
        case 'LineString':
        case 'MultiLineString':
            return { kind: 'length', length: getLength(geometry, options) };
        case 'Polygon':
        case 'MultiPolygon':
            return { kind: 'area', area: getArea(geometry, options), perimeter: getLength(geometry, options) };
        case 'Point': {
            const flat = (geometry as unknown as { getCoordinates(): number[] }).getCoordinates();
            const [lon = 0, lat = 0] = toLonLat(flat, projection);
            return { kind: 'point', lonLat: [lon, lat] };
        }
        default:
            return { kind: 'none' };
    }
}
