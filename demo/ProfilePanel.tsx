import { useState } from 'react';
import { formatElevation, formatLength, type Profile } from 'teodolito';
import { useTeodolito, useProfile } from 'teodolito/react';
import { syntheticElevation } from './elevation';

const width = 360;
const height = 120;
const pad = 4;

function Chart({ profile }: { profile: Profile }) {
    const [hover, setHover] = useState<number | null>(null);
    const known = profile.points.filter((p) => p.elevation !== null);
    const low = profile.min?.elevation ?? 0;
    const span = Math.max(1, (profile.max?.elevation ?? 1) - low);
    const x = (distance: number) => pad + (distance / Math.max(1, profile.length)) * (width - 2 * pad);
    const y = (elevation: number) => height - pad - ((elevation - low) / span) * (height - 2 * pad);
    const line = known.map((p) => `${x(p.distance).toFixed(1)},${y(p.elevation as number).toFixed(1)}`).join(' ');
    const area = `${x(known[0]?.distance ?? 0)},${height} ${line} ${x(known[known.length - 1]?.distance ?? 0)},${height}`;
    const point = hover === null ? null : known[hover];
    const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        const target = ((event.clientX - box.left) / box.width) * profile.length;
        let best = 0;
        known.forEach((p, i) => { if (Math.abs(p.distance - target) < Math.abs((known[best]?.distance ?? 0) - target)) best = i; });
        setHover(best);
    };
    return (
        <div className="chart">
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Perfil de alturas"
                onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
                <polygon points={area} className="chart-area" />
                <polyline points={line} className="chart-line" />
                {point && <line x1={x(point.distance)} x2={x(point.distance)} y1={0} y2={height} className="chart-cursor" />}
            </svg>
            <p className="chart-readout" data-testid="profile-readout">
                {point
                    ? `${formatLength(point.distance, { locale: 'es-MX' }).text} · ${formatElevation(point.elevation as number, { locale: 'es-MX' })}`
                    : 'Pasa el cursor sobre la gráfica'}
            </p>
        </div>
    );
}

export function ProfilePanel() {
    const { selectedId, items } = useTeodolito();
    const item = items.find((candidate) => candidate.id === selectedId);
    const target = item && (item.kind === 'line' || item.kind === 'freehand') ? item.id : null;
    const { status, profile, error, refresh } = useProfile(target, syntheticElevation);
    if (!target) return null;
    const m = (value: number) => formatElevation(value, { locale: 'es-MX' });
    const len = (value: number) => formatLength(value, { locale: 'es-MX' }).text;
    return (
        <section className="profile" data-testid="profile" aria-busy={status === 'loading'}>
            <header>
                <h2>Perfil de alturas</h2>
                <span className="status">{status === 'loading' ? 'Calculando…' : ''}</span>
            </header>
            {status === 'error' && (
                <p className="empty">No se pudo calcular: {String((error as Error)?.message ?? error)}{' '}
                    <button type="button" onClick={refresh}>Reintentar</button></p>
            )}
            {profile && (
                <>
                    <Chart profile={profile} />
                    <dl className="stats">
                        <div><dt>Longitud</dt><dd>{len(profile.length)}</dd></div>
                        <div><dt>Sobre el relieve</dt><dd>{len(profile.surfaceLength)}</dd></div>
                        <div><dt>Subida</dt><dd data-testid="ascent">{m(profile.ascent)}</dd></div>
                        <div><dt>Bajada</dt><dd>{m(profile.descent)}</dd></div>
                        <div><dt>Desnivel</dt><dd>{profile.netChange === null ? '—' : m(profile.netChange)}</dd></div>
                        <div><dt>Máxima</dt><dd data-testid="max">{profile.max ? m(profile.max.elevation) : '—'}</dd></div>
                        <div><dt>Mínima</dt><dd>{profile.min ? m(profile.min.elevation) : '—'}</dd></div>
                    </dl>
                </>
            )}
        </section>
    );
}
