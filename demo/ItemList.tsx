import type { AreaUnit, Item, LengthUnit } from 'teodolito';
import { useTeodolito } from 'teodolito/react';
import { Icon } from './icons';
import { swatches } from './style';

const names: Record<Item['kind'], string> = {
    line: 'Distancia', polygon: 'Área', point: 'Punto', freehand: 'Trazo', text: 'Texto',
};

function download(data: unknown): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'mediciones.geojson' });
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
                    <select aria-label="Unidad de longitud" value={t.units.length}
                        onChange={(e) => t.setUnits({ length: e.target.value as LengthUnit })}>
                        <option value="auto">auto</option><option value="m">m</option><option value="km">km</option>
                    </select>
                    <select aria-label="Unidad de área" value={t.units.area}
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
                            <span className="kind">{names[item.kind]}</span>
                            <span className="value">{item.kind === 'text' ? item.text : t.format(item.measure)}</span>
                        </button>
                        <span className="swatches">
                            {swatches.map((color) => (
                                <button key={color} type="button" aria-label={`Color ${color}`} style={{ background: color }}
                                    onClick={(e) => { e.stopPropagation(); t.setProps(item.id, { color }); }} />
                            ))}
                        </span>
                        <button type="button" className="icon" aria-label={item.visible ? 'Ocultar' : 'Mostrar'}
                            onClick={(e) => { e.stopPropagation(); t.setVisible(item.id, !item.visible); }}>
                            <Icon name={item.visible ? 'eye' : 'eyeOff'} />
                        </button>
                        <button type="button" className="icon" aria-label="Borrar"
                            onClick={(e) => { e.stopPropagation(); t.remove(item.id); }}>
                            <Icon name="trash" />
                        </button>
                    </li>
                ))}
            </ul>
            {t.items.length === 0 && <p className="empty">Elige una herramienta y traza sobre el mapa.</p>}
            <footer>
                <button type="button" disabled={t.items.length === 0} onClick={() => download(t.toGeoJSON())}>
                    <Icon name="download" /> GeoJSON
                </button>
                <button type="button" disabled={t.items.length === 0} onClick={() => t.clear()}>
                    <Icon name="trash" /> Borrar todo
                </button>
            </footer>
        </aside>
    );
}
