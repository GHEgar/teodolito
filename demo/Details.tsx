import { formatAngle, formatBearing, type Item } from 'teodolito';
import { len } from './units';

const locale = 'es-MX';

export function Details({ item }: { item: Item }) {
    const { measure } = item;
    if (measure.kind !== 'length' && measure.kind !== 'area') return null;
    const shape = measure.kind === 'area' ? measure.shape : undefined;
    return (
        <div className="details" data-testid="details">
            {shape?.type === 'circle' && <p data-testid="radius">Radio {len(shape.radius)}</p>}
            {shape?.type === 'rectangle' && <p data-testid="sides">{len(shape.width)} × {len(shape.height)}</p>}
            {measure.segments.length > 0 && (
                <ol className="segments" data-testid="segments">
                    {measure.segments.map((segment, i) => {
                        const angle = measure.angles.find((candidate) => candidate.vertex === i);
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
