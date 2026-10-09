import { createContext, useContext, type ReactNode } from 'react';
import type { Teodolito } from '../core/index.js';

const TeodolitoContext = createContext<Teodolito | null>(null);

export interface TeodolitoProviderProps {
    value: Teodolito | null;
    children?: ReactNode;
}

export function TeodolitoProvider({ value, children }: TeodolitoProviderProps) {
    return <TeodolitoContext.Provider value={value}>{children}</TeodolitoContext.Provider>;
}

export function useOptionalTeodolitoInstance(): Teodolito | null {
    return useContext(TeodolitoContext);
}

export function useTeodolitoInstance(): Teodolito {
    const instance = useContext(TeodolitoContext);
    if (!instance) throw new Error('teodolito: falta <TeodolitoProvider value={...}> con una instancia.');
    return instance;
}
