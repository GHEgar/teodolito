import type { Elevation } from 'teodolito';
import { useElevation, useTeodolito } from 'teodolito/react';
import { providers, type ProviderKey } from './elevation';
import { ProfileView } from './ProfileView';
import { SurfaceView } from './SurfaceView';
import { m } from './units';

const titles: Record<Elevation['kind'], string> = {
    point: 'Altura del punto', profile: 'Perfil de alturas', surface: 'Relieve del área',
};

function Body({ elevation }: { elevation: Elevation }) {
    switch (elevation.kind) {
        case 'point':
            return <p className="point-elevation" data-testid="point-elevation">
                {elevation.elevation === null ? 'Sin dato' : m(elevation.elevation)}
            </p>;
        case 'profile':
            return <ProfileView profile={elevation.profile} />;
        case 'surface':
            return <SurfaceView surface={elevation.surface} />;
    }
}

export function ElevationPanel({ source, onSource }: { source: ProviderKey; onSource(source: ProviderKey): void }) {
    const { selectedId, items } = useTeodolito();
    const item = items.find((candidate) => candidate.id === selectedId);
    const target = item && item.kind !== 'text' ? item.id : null;
    const { status, elevation, error, refresh } = useElevation(target, providers[source].provider);
    if (!target || !item) return null;
    const kind: Elevation['kind'] = item.kind === 'point' || item.kind === 'symbol' ? 'point'
        : item.kind === 'line' || item.kind === 'freehand' ? 'profile' : 'surface';
    return (
        <section className="profile" data-testid={kind === 'profile' ? 'profile' : kind} aria-busy={status === 'loading'}>
            <header>
                <h2>{titles[kind]}</h2>
                <span className="status">{status === 'loading' ? 'Calculando…' : ''}</span>
                <select aria-label="Fuente de elevación" value={source}
                    onChange={(e) => onSource(e.target.value as ProviderKey)}>
                    {Object.entries(providers).map(([key, { name }]) => <option key={key} value={key}>{name}</option>)}
                </select>
            </header>
            {status === 'error' && (
                <p className="empty">No se pudo calcular: {String((error as Error)?.message ?? error)}{' '}
                    <button type="button" onClick={refresh}>Reintentar</button></p>
            )}
            {elevation && <Body elevation={elevation} />}
        </section>
    );
}
