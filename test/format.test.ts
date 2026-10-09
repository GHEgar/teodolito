import { describe, expect, it } from 'vitest';
import { formatArea, formatLength, formatLonLat, formatMeasure } from '../src/core/format.js';

describe('format', () => {
    it('cambia a km desde 1000 m en automático', () => {
        expect(formatLength(999, { locale: 'es-MX' }).text).toBe('999 m');
        expect(formatLength(1234.5, { locale: 'es-MX' }).text).toBe('1.23 km');
    });

    it('pasa por hectáreas en automático', () => {
        expect(formatArea(9_999, { locale: 'es-MX' }).unit).toBe('m2');
        expect(formatArea(25_000, { locale: 'es-MX' }).text).toBe('2.5 ha');
        expect(formatArea(3_000_000, { locale: 'es-MX' }).text).toBe('3 km²');
    });

    it('respeta la unidad fija', () => {
        expect(formatLength(500, { units: { length: 'km' }, locale: 'es-MX' }).text).toBe('0.5 km');
        expect(formatArea(500, { units: { area: 'ha' }, locale: 'es-MX' }).text).toBe('0.05 ha');
    });

    it('formatea coordenadas como lat, lon', () => {
        expect(formatLonLat([-103.35, 20.67], { locale: 'es-MX' })).toBe('20.67000, -103.35000');
    });

    it('formatea una medida sin geometría como vacía', () => {
        expect(formatMeasure({ kind: 'none' })).toBe('');
    });
});
