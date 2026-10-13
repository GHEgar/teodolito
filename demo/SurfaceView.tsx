import type { Surface } from 'teodolito';
import { area, m } from './units';

const width = 360;
const height = 120;
const pad = 4;

function Hypsometry({ surface }: { surface: Surface }) {
    const low = surface.min?.elevation ?? 0;
    const span = Math.max(1, (surface.max?.elevation ?? 1) - low);
    const x = (share: number) => pad + share * (width - 2 * pad);
    const y = (elevation: number) => height - pad - ((elevation - low) / span) * (height - 2 * pad);
    const line = surface.hypsometry.map((s) => `${x(s.share).toFixed(1)},${y(s.elevation).toFixed(1)}`).join(' ');
    return (
        <div className="chart">
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Curva hipsométrica">
                <polygon points={`${x(0)},${height} ${line} ${x(1)},${height}`} className="chart-area" />
                <polyline points={line} className="chart-line" />
            </svg>
            <p className="chart-readout">Porcentaje del área por encima de cada altura</p>
        </div>
    );
}

export function SurfaceView({ surface }: { surface: Surface }) {
    return (
        <>
            {surface.hypsometry.length > 0 && <Hypsometry surface={surface} />}
            <dl className="stats">
                <div><dt>Área plana</dt><dd>{area(surface.planarArea)}</dd></div>
                <div><dt>Sobre el relieve</dt><dd data-testid="surface-area">{area(surface.surfaceArea)}</dd></div>
                <div><dt>Media</dt><dd>{surface.mean === null ? '—' : m(surface.mean)}</dd></div>
                <div><dt>Muestras</dt><dd>{surface.samples - surface.missing}</dd></div>
                <div><dt>Máxima</dt><dd data-testid="surface-max">{surface.max ? m(surface.max.elevation) : '—'}</dd></div>
                <div><dt>Mínima</dt><dd>{surface.min ? m(surface.min.elevation) : '—'}</dd></div>
            </dl>
        </>
    );
}
