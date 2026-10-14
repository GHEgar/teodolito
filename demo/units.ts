import { formatArea, formatElevation, formatLength } from 'teodolito';

export const m = (value: number): string => formatElevation(value, { locale: 'en-US' });
export const len = (value: number): string => formatLength(value, { locale: 'en-US' }).text;
export const area = (value: number): string => formatArea(value, { locale: 'en-US' }).text;
