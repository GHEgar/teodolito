import type { Measure } from './measure.js';

export type LengthUnit = 'auto' | 'm' | 'km';
export type AreaUnit = 'auto' | 'm2' | 'ha' | 'km2';

export interface Units {
    length: LengthUnit;
    area: AreaUnit;
}

export interface FormatOptions {
    units?: Partial<Units>;
    locale?: string;
    maximumFractionDigits?: number;
    coordinateDigits?: number;
}

export interface Quantity {
    value: number;
    unit: Exclude<LengthUnit, 'auto'> | Exclude<AreaUnit, 'auto'>;
    text: string;
}

export const defaultUnits: Units = { length: 'auto', area: 'auto' };

const symbols: Record<Quantity['unit'], string> = { m: 'm', km: 'km', m2: 'm²', ha: 'ha', km2: 'km²' };
const factors: Record<Quantity['unit'], number> = { m: 1, km: 1000, m2: 1, ha: 10_000, km2: 1_000_000 };

function number(value: number, options: FormatOptions): string {
    return new Intl.NumberFormat(options.locale, { maximumFractionDigits: options.maximumFractionDigits ?? 2 }).format(value);
}

function quantity(meters: number, unit: Quantity['unit'], options: FormatOptions): Quantity {
    const value = meters / factors[unit];
    return { value, unit, text: `${number(value, options)} ${symbols[unit]}` };
}

export function resolveLengthUnit(meters: number, unit: LengthUnit = 'auto'): Exclude<LengthUnit, 'auto'> {
    if (unit !== 'auto') return unit;
    return meters < 1000 ? 'm' : 'km';
}

export function resolveAreaUnit(squareMeters: number, unit: AreaUnit = 'auto'): Exclude<AreaUnit, 'auto'> {
    if (unit !== 'auto') return unit;
    if (squareMeters < 10_000) return 'm2';
    return squareMeters < 1_000_000 ? 'ha' : 'km2';
}

export function formatLength(meters: number, options: FormatOptions = {}): Quantity {
    return quantity(meters, resolveLengthUnit(meters, options.units?.length), options);
}

export function formatArea(squareMeters: number, options: FormatOptions = {}): Quantity {
    return quantity(squareMeters, resolveAreaUnit(squareMeters, options.units?.area), options);
}

export function formatLonLat(lonLat: [number, number], options: FormatOptions = {}): string {
    const digits = options.coordinateDigits ?? 5;
    const format = new Intl.NumberFormat(options.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return `${format.format(lonLat[1])}, ${format.format(lonLat[0])}`;
}

export function formatMeasure(measure: Measure, options: FormatOptions = {}): string {
    switch (measure.kind) {
        case 'length':
            return formatLength(measure.length, options).text;
        case 'area':
            return formatArea(measure.area, options).text;
        case 'point':
            return formatLonLat(measure.lonLat, options);
        default:
            return '';
    }
}

export function formatElevation(meters: number, options: FormatOptions = {}): string {
    return `${number(meters, { ...options, maximumFractionDigits: options.maximumFractionDigits ?? 0 })} m`;
}
