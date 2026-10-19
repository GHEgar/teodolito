import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatArea, formatElevation, formatLength, formatMeasure } from '../src/core/format.js';
import { localeSystem, resolveUnitSystem } from '../src/core/units.js';

const imperial = { system: 'imperial' } as const;
const auto = { system: 'auto' } as const;

describe('unidades', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('formatea en métrico por omisión aunque el locale sea en-US', () => {
        expect(formatLength(1234.5, { locale: 'en-US' }).text).toBe('1.23 km');
        expect(formatArea(25_000, { locale: 'en-US' }).text).toBe('2.5 ha');
        expect(formatElevation(1523, { locale: 'en-US' })).toBe('1,523 m');
    });

    it('escala pies y millas en imperial', () => {
        expect(formatLength(100, { units: imperial, locale: 'en-US' }).text).toBe('328.08 ft');
        expect(formatLength(1609.344 * 2.5, { units: imperial, locale: 'en-US' }).text).toBe('2.5 mi');
        expect(formatLength(1609, { units: imperial, locale: 'en-US' }).unit).toBe('ft');
    });

    it('escala pies cuadrados, acres y millas cuadradas en imperial', () => {
        expect(formatArea(100, { units: imperial, locale: 'en-US' }).text).toBe('1,076.39 ft²');
        expect(formatArea(4046.8564224 * 3, { units: imperial, locale: 'en-US' }).text).toBe('3 ac');
        expect(formatArea(2_589_988.110336 * 4, { units: imperial, locale: 'en-US' }).text).toBe('4 mi²');
    });

    it('respeta la unidad fija en cualquier sistema', () => {
        expect(formatLength(1609.344, { units: { length: 'ft' }, locale: 'en-US' }).text).toBe('5,280 ft');
        expect(formatLength(5000, { units: { system: 'imperial', length: 'km' }, locale: 'en-US' }).text).toBe('5 km');
        expect(formatArea(2_589_988.110336, { units: { area: 'ac' }, locale: 'en-US' }).text).toBe('640 ac');
        expect(formatMeasure({ kind: 'area', area: 10_000, perimeter: 400, segments: [], angles: [] }, { units: { area: 'mi2' }, locale: 'en-US' })).toBe('0 mi²');
    });

    it('da la elevación en pies con el sistema imperial o una unidad imperial', () => {
        expect(formatElevation(1000, { units: imperial, locale: 'en-US' })).toBe('3,281 ft');
        expect(formatElevation(1000, { units: { length: 'mi' }, locale: 'en-US' })).toBe('3,281 ft');
        expect(formatElevation(1000, { units: { system: 'imperial', length: 'm' }, locale: 'en-US' })).toBe('1,000 m');
    });

    it('en automático elige el sistema por el locale', () => {
        expect(localeSystem('en-US')).toBe('imperial');
        expect(localeSystem('en')).toBe('imperial');
        expect(localeSystem('en-GB')).toBe('metric');
        expect(localeSystem('es-MX')).toBe('metric');
        expect(localeSystem('no es un locale')).toBe('metric');
        expect(formatLength(100, { units: auto, locale: 'en-US' }).text).toBe('328.08 ft');
        expect(formatLength(100, { units: auto, locale: 'es-MX' }).text).toBe('100 m');
        expect(formatElevation(1000, { units: auto, locale: 'en-US' })).toBe('3,281 ft');
    });

    it('en automático sin locale usa navigator.language', () => {
        vi.stubGlobal('navigator', { language: 'en-US' });
        expect(resolveUnitSystem('auto')).toBe('imperial');
        expect(formatArea(4046.8564224 * 2, { units: auto }).unit).toBe('ac');
        vi.stubGlobal('navigator', { language: 'fr-FR' });
        expect(resolveUnitSystem('auto')).toBe('metric');
        vi.stubGlobal('navigator', undefined);
        expect(resolveUnitSystem('auto')).toBe('metric');
    });
});
