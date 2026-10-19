import type { AreaUnit, Item, LengthUnit } from 'teodolito';
import { useTeodolito } from 'teodolito/react';
import { Details } from './Details';
import { Icon } from './icons';
import { swatches } from './style';

const names: Record<Item['kind'], string> = {
    line: 'Distance', polygon: 'Area', point: 'Point', freehand: 'Stroke', text: 'Text',
    circle: 'Circle', rectangle: 'Rectangle', symbol: 'Symbol', angle: 'Angle',
};

function download(data: unknown): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'measurements.geojson' });
    link.click();
    URL.revokeObjectURL(url);
}

export function ItemList() {
    const t = useTeodolito();
    return (
        <aside className="panel">
            <header>
                <h1>teodolito</h1>
                <div className="units">
                    <select aria-label="Length unit" value={t.units.length}
                        onChange={(e) => t.setUnits({ length: e.target.value as LengthUnit })}>
                        <option value="auto">auto</option><option value="m">m</option><option value="km">km</option>
                    </select>
                    <select aria-label="Area unit" value={t.units.area}
                        onChange={(e) => t.setUnits({ area: e.target.value as AreaUnit })}>
                        <option value="auto">auto</option><option value="m2">m²</option>
                        <option value="ha">ha</option><option value="km2">km²</option>
                    </select>
                </div>
            </header>
            <ul data-testid="items">
                {t.items.map((item) => (
                    <li key={item.id} aria-current={t.selectedId === item.id ? 'true' : undefined}>
                        <button type="button" className="pick" aria-pressed={t.selectedId === item.id}
                            onClick={() => t.select(item.id)}>
                            <span className="kind">{item.name || names[item.kind]}</span>
                            <span className="value">{item.kind === 'text' ? item.text : item.kind === 'symbol' ? `${item.symbol} ${t.format(item.measure)}` : t.format(item.measure)}</span>
                        </button>
                        <span className="swatches">
                            {swatches.map((color) => (
                                <button key={color} type="button" aria-label={`Color ${color}`} style={{ background: color }}
                                    onClick={(e) => { e.stopPropagation(); t.setProps(item.id, { color }); }} />
                            ))}
                        </span>
                        <button type="button" className="icon" aria-label={item.visible ? 'Hide' : 'Show'}
                            onClick={(e) => { e.stopPropagation(); t.setVisible(item.id, !item.visible); }}>
                            <Icon name={item.visible ? 'eye' : 'eyeOff'} />
                        </button>
                        <button type="button" className="icon" aria-label="Delete"
                            onClick={(e) => { e.stopPropagation(); t.remove(item.id); }}>
                            <Icon name="trash" />
                        </button>
                        {t.selectedId === item.id && <Details item={item} />}
                    </li>
                ))}
            </ul>
            {t.items.length === 0 && <p className="empty">Pick a tool and draw on the map.</p>}
            <footer>
                <button type="button" disabled={t.items.length === 0} onClick={() => download(t.toGeoJSON())}>
                    <Icon name="download" /> GeoJSON
                </button>
                <button type="button" disabled={t.items.length === 0} onClick={() => t.clear()}>
                    <Icon name="trash" /> Clear all
                </button>
            </footer>
        </aside>
    );
}
