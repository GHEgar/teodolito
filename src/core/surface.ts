import { DEFAULT_RADIUS } from 'ol/sphere.js';
import type { LonLat } from './sampling.js';

export type Ring = readonly LonLat[];

export interface Spot {
    readonly elevation: number;
    readonly lonLat: LonLat;
}

export interface HypsometryStep {
    readonly share: number;
    readonly elevation: number;
}

export interface Surface {
    readonly planarArea: number;
    readonly surfaceArea: number;
    readonly min: Spot | null;
    readonly max: Spot | null;
    readonly mean: number | null;
    readonly hypsometry: readonly HypsometryStep[];
    readonly samples: number;
    readonly missing: number;
}

export interface Grid {
    readonly cells: number;
    readonly nodes: readonly LonLat[];
    readonly inside: readonly boolean[];
    readonly extra: readonly LonLat[];
}

export interface SurfaceOptions {
    cells?: number;
    hypsometrySteps?: number;
}

function inRing([x, y]: LonLat, ring: Ring): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const [xi, yi] = ring[i] as LonLat;
        const [xj, yj] = ring[j] as LonLat;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

export function inPolygon(point: LonLat, rings: readonly Ring[]): boolean {
    const [outer, ...holes] = rings;
    return !!outer && inRing(point, outer) && !holes.some((hole) => inRing(point, hole));
}

const open = (ring: Ring): Ring => {
    const first = ring[0];
    const last = ring[ring.length - 1];
    return first && last && ring.length > 1 && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
};

export function buildGrid(rings: readonly Ring[], cells = 60): Grid {
    const outer = open(rings[0] ?? []);
    if (outer.length === 0) return { cells: 0, nodes: [], inside: [], extra: [] };
    const lons = outer.map((p) => p[0]);
    const lats = outer.map((p) => p[1]);
    const [west, east, south, north] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
    const n = Math.max(1, Math.round(cells));
    const nodes: LonLat[] = [];
    for (let row = 0; row <= n; row += 1) {
        for (let col = 0; col <= n; col += 1) {
            nodes.push([west + ((east - west) * col) / n, south + ((north - south) * row) / n]);
        }
    }
    return { cells: n, nodes, inside: nodes.map((node) => inPolygon(node, rings)), extra: outer };
}

type Vector = [number, number, number];

function triangle(a: Vector, b: Vector, c: Vector): number {
    const [ux, uy, uz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const [vx, vy, vz] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
}

const quad = ([p, q, r, s]: Vector[]): number => triangle(p as Vector, q as Vector, r as Vector) + triangle(p as Vector, r as Vector, s as Vector);

function reliefRatio(grid: Grid, rings: readonly Ring[], elevations: readonly (number | null)[]): number {
    const { cells, nodes } = grid;
    const origin = nodes[0] as LonLat;
    const scale = (Math.PI / 180) * DEFAULT_RADIUS;
    const cos = Math.cos((((nodes[nodes.length - 1] as LonLat)[1] + origin[1]) / 2) * (Math.PI / 180));
    const at = (index: number, flat: boolean): Vector | null => {
        const node = nodes[index] as LonLat;
        const z = elevations[index];
        if (z === null || z === undefined) return null;
        return [(node[0] - origin[0]) * scale * cos, (node[1] - origin[1]) * scale, flat ? 0 : z];
    };
    let relief = 0;
    let plane = 0;
    for (let row = 0; row < cells; row += 1) {
        for (let col = 0; col < cells; col += 1) {
            const sw = row * (cells + 1) + col;
            const corners = [sw, sw + 1, sw + cells + 2, sw + cells + 1];
            const [a, b, , d] = corners.map((index) => nodes[index] as LonLat) as [LonLat, LonLat, LonLat, LonLat];
            if (!inPolygon([(a[0] + b[0]) / 2, (a[1] + d[1]) / 2], rings)) continue;
            const real = corners.map((index) => at(index, false));
            if (real.some((corner) => corner === null)) continue;
            relief += quad(real as Vector[]);
            plane += quad(corners.map((index) => at(index, true)) as Vector[]);
        }
    }
    return plane > 0 ? relief / plane : 1;
}

export function buildSurface(
    grid: Grid,
    rings: readonly Ring[],
    elevations: readonly (number | null)[],
    planarArea: number,
    options: SurfaceOptions = {},
): Surface {
    const expected = grid.nodes.length + grid.extra.length;
    if (elevations.length !== expected) {
        throw new Error(`teodolito: ${elevations.length} alturas para ${expected} muestras.`);
    }
    const clean = elevations.map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : null));
    const points = [...grid.nodes, ...grid.extra];
    const used = points.map((_, i) => i >= grid.nodes.length || grid.inside[i] === true);
    const spots: Spot[] = [];
    let missing = 0;
    points.forEach((lonLat, i) => {
        if (!used[i]) return;
        const elevation = clean[i];
        if (elevation === null || elevation === undefined) missing += 1;
        else spots.push({ elevation, lonLat });
    });
    const sorted = [...spots].sort((a, b) => b.elevation - a.elevation);
    const steps = Math.max(1, Math.round(options.hypsometrySteps ?? 50));
    const hypsometry = sorted.length ? Array.from({ length: steps + 1 }, (_, k): HypsometryStep => ({
        share: k / steps,
        elevation: (sorted[Math.round((k / steps) * (sorted.length - 1))] as Spot).elevation,
    })) : [];
    return {
        planarArea,
        surfaceArea: planarArea * reliefRatio(grid, rings, clean.slice(0, grid.nodes.length)),
        max: sorted[0] ?? null,
        min: sorted[sorted.length - 1] ?? null,
        mean: spots.length ? spots.reduce((sum, spot) => sum + spot.elevation, 0) / spots.length : null,
        hypsometry,
        samples: spots.length + missing,
        missing,
    };
}
