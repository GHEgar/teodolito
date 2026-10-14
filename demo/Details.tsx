import { formatAngle, formatBearing, type Item } from 'teodolito';
import { useTeodolito } from 'teodolito/react';
import { Icon } from './icons';
import { len } from './units';

const locale = 'en-US';
const STEP = Math.PI / 4;

function Transform({ item }: { item: Item }) {
    const t = useTeodolito();
    if (item.kind === 'point' || item.kind === 'freehand') return null;
    return (
        <div className="transform" role="group" aria-label="Transform">
            {item.kind !== 'circle' && <>
                <button type="button" className="icon" aria-label="Rotate left" onClick={() => t.rotate(item.id, -STEP)}>
                    <Icon name="rotateCcw" />
                </button>
                <button type="button" className="icon" aria-label="Rotate right" onClick={() => t.rotate(item.id, STEP)}>
                    <Icon name="rotateCw" />
                </button>
            </>}
            <button type="button" className="icon" aria-label="Enlarge" onClick={() => t.scale(item.id, 1.25)}>
                <Icon name="grow" />
            </button>
            <button type="button" className="icon" aria-label="Shrink" onClick={() => t.scale(item.id, 0.8)}>
                <Icon name="shrink" />
            </button>
            {(item.kind === 'text' || item.kind === 'symbol') && (
                <span data-testid="transform-state">
                    {formatAngle((((item.rotation * 180) / Math.PI) % 360 + 360) % 360, { locale, maximumFractionDigits: 0 })}
                    {' · ×'}{item.scale.toFixed(2)}
                </span>
            )}
        </div>
    );
}

export function Details({ item }: { item: Item }) {
    const { measure } = item;
    const shape = measure.kind === 'area' ? measure.shape : undefined;
    const segments = measure.kind === 'length' || measure.kind === 'area' ? measure : null;
    return (
        <div className="details" data-testid="details">
            <Transform item={item} />
            {shape?.type === 'circle' && <p data-testid="radius">Radius {len(shape.radius)}</p>}
            {shape?.type === 'rectangle' && <p data-testid="sides">{len(shape.width)} × {len(shape.height)}</p>}
            {segments && segments.segments.length > 0 && (
                <ol className="segments" data-testid="segments">
                    {segments.segments.map((segment, i) => {
                        const angle = segments.angles.find((candidate) => candidate.vertex === i);
                        return (
                            <li key={i}>
                                <span>{len(segment.length)}</span>
                                <span>{formatBearing(segment.bearing, { locale, style: 'quadrant', maximumFractionDigits: 0 })}</span>
                                {angle && <span>∠ {formatAngle(angle.degrees, { locale })}</span>}
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}
