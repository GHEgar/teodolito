import { useState } from 'react';
import { useTeodolito } from 'teodolito/react';
import type { Tool } from 'teodolito';
import { Icon, type IconName } from './icons';
import { showDetails, setShowDetails } from './style';

export const symbols = ['🌳', '⛰️', '🏠', '🚩', '⚠️', '💧', '🚌', '⭐'];

const tools: { tool: Tool | null; icon: IconName; label: string }[] = [
    { tool: null, icon: 'pointer', label: 'Select' },
    { tool: 'line', icon: 'line', label: 'Distance' },
    { tool: 'polygon', icon: 'polygon', label: 'Area' },
    { tool: 'circle', icon: 'circle', label: 'Circle' },
    { tool: 'rectangle', icon: 'rectangle', label: 'Rectangle' },
    { tool: 'point', icon: 'point', label: 'Point' },
    { tool: 'symbol', icon: 'symbol', label: 'Symbol' },
    { tool: 'freehand', icon: 'freehand', label: 'Freehand' },
    { tool: 'text', icon: 'text', label: 'Text' },
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
        <div className="toolbar" role="toolbar" aria-label="Tools">
            {tools.map(({ tool, icon, label }) => (
                <button key={label} type="button" className="tool" title={label} aria-label={label}
                    aria-pressed={t.tool === tool} onClick={() => t.setTool(tool)}>
                    <Icon name={icon} />
                </button>
            ))}
            <span className="sep" />
            <button type="button" className="tool" title="Segments and angles" aria-label="Segments and angles"
                aria-pressed={details} onClick={toggleDetails}>
                <Icon name="angle" />
            </button>
            <button type="button" className="tool" title="Undo" aria-label="Undo"
                disabled={!t.canUndo} onClick={() => t.undo()}>
                <Icon name="undo" />
            </button>
            <button type="button" className="tool" title="Redo" aria-label="Redo"
                disabled={!t.canRedo} onClick={() => t.redo()}>
                <Icon name="redo" />
            </button>
            {t.drawing && <span className="live" data-testid="sketch">{t.sketch ? t.format(t.sketch) : ''}</span>}
            {t.tool === 'symbol' && (
                <div className="symbols" role="radiogroup" aria-label="Symbols">
                    {symbols.map((symbol) => (
                        <button key={symbol} type="button" role="radio" aria-checked={t.symbol === symbol}
                            aria-label={`Symbol ${symbol}`} onClick={() => t.setSymbol(symbol)}>{symbol}</button>
                    ))}
                </div>
            )}
        </div>
    );
}
