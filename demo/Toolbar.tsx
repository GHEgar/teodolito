import { useState } from 'react';
import { useTeodolito } from 'teodolito/react';
import type { Tool } from 'teodolito';
import { Icon, type IconName } from './icons';
import { showDetails, setShowDetails } from './style';

export const symbols = ['🌳', '⛰️', '🏠', '🚩', '⚠️', '💧', '🚌', '⭐'];

const tools: { tool: Tool | null; icon: IconName; label: string }[] = [
    { tool: null, icon: 'pointer', label: 'Seleccionar' },
    { tool: 'line', icon: 'line', label: 'Distancia' },
    { tool: 'polygon', icon: 'polygon', label: 'Área' },
    { tool: 'circle', icon: 'circle', label: 'Círculo' },
    { tool: 'rectangle', icon: 'rectangle', label: 'Rectángulo' },
    { tool: 'point', icon: 'point', label: 'Punto' },
    { tool: 'symbol', icon: 'symbol', label: 'Símbolo' },
    { tool: 'freehand', icon: 'freehand', label: 'Mano alzada' },
    { tool: 'text', icon: 'text', label: 'Texto' },
];

export function Toolbar() {
    const t = useTeodolito();
    const [details, setDetails] = useState(showDetails);
    const toggleDetails = () => {
        setShowDetails(!details);
        setDetails(!details);
        t.instance.layer.changed();
    };
    return (
        <div className="toolbar" role="toolbar" aria-label="Herramientas">
            {tools.map(({ tool, icon, label }) => (
                <button key={label} type="button" className="tool" title={label} aria-label={label}
                    aria-pressed={t.tool === tool} onClick={() => t.setTool(tool)}>
                    <Icon name={icon} />
                </button>
            ))}
            <span className="sep" />
            <button type="button" className="tool" title="Segmentos y ángulos" aria-label="Segmentos y ángulos"
                aria-pressed={details} onClick={toggleDetails}>
                <Icon name="angle" />
            </button>
            <button type="button" className="tool" title="Deshacer" aria-label="Deshacer"
                disabled={!t.canUndo} onClick={() => t.undo()}>
                <Icon name="undo" />
            </button>
            <button type="button" className="tool" title="Rehacer" aria-label="Rehacer"
                disabled={!t.canRedo} onClick={() => t.redo()}>
                <Icon name="redo" />
            </button>
            {t.drawing && <span className="live" data-testid="sketch">{t.sketch ? t.format(t.sketch) : ''}</span>}
            {t.tool === 'symbol' && (
                <div className="symbols" role="radiogroup" aria-label="Símbolos">
                    {symbols.map((symbol) => (
                        <button key={symbol} type="button" role="radio" aria-checked={t.symbol === symbol}
                            aria-label={`Símbolo ${symbol}`} onClick={() => t.setSymbol(symbol)}>{symbol}</button>
                    ))}
                </div>
            )}
        </div>
    );
}
