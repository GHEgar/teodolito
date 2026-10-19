import type { Measure } from './measure.js';
import { elevationUnit, resolveAreaUnit, resolveLengthUnit, resolveUnitSystem, unitFactors, unitSymbols, type FixedUnit, type Units, type UnitSystem } from './units.js';

export { defaultUnits, localeSystem, resolveAreaUnit, resolveLengthUnit, resolveUnitSystem } from './units.js';
export type { AreaUnit, LengthUnit, Units, UnitSystem } from './units.js';

export interface FormatOptions {
    units?: Partial<Units>;
    locale?: string;
    maximumFractionDigits?: number;
    coordinateDigits?: number;
}

export interface Quantity {
    value: number;
    unit: FixedUnit;
    text: string;
}

function number(value: number, options: FormatOptions): string {
    return new Intl.NumberFormat(options.locale, { maximumFractionDigits: options.maximumFractionDigits ?? 2 }).format(value);
}

function quantity(meters: number, unit: FixedUnit, options: FormatOptions): Quantity {
    const value = meters / unitFactors[unit];
    return { value, unit, text: `${number(value, options)} ${unitSymbols[unit]}` };
}

const systemOf = (options: FormatOptions): UnitSystem => resolveUnitSystem(options.units?.system, options.locale);

export function formatLength(meters: number, options: FormatOptions = {}): Quantity {
    return quantity(meters, resolveLengthUnit(meters, options.units?.length, systemOf(options)), options);
}

export function formatArea(squareMeters: number, options: FormatOptions = {}): Quantity {
    return quantity(squareMeters, resolveAreaUnit(squareMeters, options.units?.area, systemOf(options)), options);
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
        case 'angle':
            return formatAngle(measure.degrees, options);
        case 'point':
            return formatLonLat(measure.lonLat, options);
        default:
            return '';
    }
}

export function formatElevation(meters: number, options: FormatOptions = {}): string {
    const unit = elevationUnit(options.units?.length, systemOf(options));
    return `${number(meters / unitFactors[unit], { ...options, maximumFractionDigits: options.maximumFractionDigits ?? 0 })} ${unit}`;
}

export interface AngleFormatOptions {
    locale?: string;
    maximumFractionDigits?: number;
}

const degreesText = (value: number, options: AngleFormatOptions): string => `${number(value, {
    ...options, maximumFractionDigits: options.maximumFractionDigits ?? 1,
})}°`;

export function formatAngle(degrees: number, options: AngleFormatOptions = {}): string {
    return degreesText(degrees, options);
}

export function formatBearing(degrees: number, options: AngleFormatOptions & { style?: 'degrees' | 'quadrant' } = {}): string {
    const value = ((degrees % 360) + 360) % 360;
    if (options.style !== 'quadrant') return degreesText(value, options);
    if (value <= 90) return `N ${degreesText(value, options)} E`;
    if (value <= 180) return `S ${degreesText(180 - value, options)} E`;
    if (value <= 270) return `S ${degreesText(value - 180, options)} W`;
    return `N ${degreesText(360 - value, options)} W`;
}
