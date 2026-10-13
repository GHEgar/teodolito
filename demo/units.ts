import { formatArea, formatElevation, formatLength } from 'teodolito';

export const m = (value: number): string => formatElevation(value, { locale: 'es-MX' });
export const len = (value: number): string => formatLength(value, { locale: 'es-MX' }).text;
export const area = (value: number): string => formatArea(value, { locale: 'es-MX' }).text;
