export type UnitSystem = 'metric' | 'imperial';
export type LengthUnit = 'auto' | 'm' | 'km' | 'ft' | 'mi';
export type AreaUnit = 'auto' | 'm2' | 'ha' | 'km2' | 'ft2' | 'ac' | 'mi2';

export interface Units {
    length: LengthUnit;
    area: AreaUnit;
    system: UnitSystem | 'auto';
}

export type FixedUnit = Exclude<LengthUnit, 'auto'> | Exclude<AreaUnit, 'auto'>;

export const defaultUnits: Units = { length: 'auto', area: 'auto', system: 'metric' };

const FOOT = 0.3048;
const MILE = 1609.344;
const ACRE = 4046.8564224;

export const unitSymbols: Record<FixedUnit, string> = {
    m: 'm', km: 'km', ft: 'ft', mi: 'mi', m2: 'm²', ha: 'ha', km2: 'km²', ft2: 'ft²', ac: 'ac', mi2: 'mi²',
};

export const unitFactors: Record<FixedUnit, number> = {
    m: 1, km: 1000, ft: FOOT, mi: MILE, m2: 1, ha: 10_000, km2: 1_000_000, ft2: FOOT * FOOT, ac: ACRE, mi2: MILE * MILE,
};

const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

function browserLocale(): string | undefined {
    return typeof navigator === 'undefined' ? undefined : navigator.language || undefined;
}

export function localeSystem(locale: string | undefined = browserLocale()): UnitSystem {
    if (!locale) return 'metric';
    try {
        const region = new Intl.Locale(locale).maximize().region;
        return region && IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric';
    } catch {
        return 'metric';
    }
}

export function resolveUnitSystem(system: Units['system'] = 'metric', locale?: string): UnitSystem {
    return system === 'auto' ? localeSystem(locale) : system;
}

export function resolveLengthUnit(meters: number, unit: LengthUnit = 'auto', system: UnitSystem = 'metric'): Exclude<LengthUnit, 'auto'> {
    if (unit !== 'auto') return unit;
    if (system === 'imperial') return meters < MILE ? 'ft' : 'mi';
    return meters < 1000 ? 'm' : 'km';
}

export function resolveAreaUnit(squareMeters: number, unit: AreaUnit = 'auto', system: UnitSystem = 'metric'): Exclude<AreaUnit, 'auto'> {
    if (unit !== 'auto') return unit;
    if (system === 'imperial') {
        if (squareMeters < ACRE) return 'ft2';
        return squareMeters < MILE * MILE ? 'ac' : 'mi2';
    }
    if (squareMeters < 10_000) return 'm2';
    return squareMeters < 1_000_000 ? 'ha' : 'km2';
}

export function elevationUnit(unit: LengthUnit | undefined, system: UnitSystem): 'm' | 'ft' {
    if (unit === 'ft' || unit === 'mi') return 'ft';
    if (unit === 'm' || unit === 'km') return 'm';
    return system === 'imperial' ? 'ft' : 'm';
}
