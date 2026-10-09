import { useTeodolito } from 'teodolito/react';
import type { Tool } from 'teodolito';
import { Icon, type IconName } from './icons';

const tools: { tool: Tool | null; icon: IconName; label: string }[] = [
    { tool: null, icon: 'pointer', label: 'Seleccionar' },
    { tool: 'line', icon: 'line', label: 'Distancia' },
    { tool: 'polygon', icon: 'polygon', label: 'Área' },
    { tool: 'point', icon: 'point', label: 'Punto' },
    { tool: 'freehand', icon: 'freehand', label: 'Mano alzada' },
    { tool: 'text', icon: 'text', label: 'Texto' },
];

export function Toolbar() {
    const t = useTeodolito();
    return (
        <div className="toolbar" role="toolbar" aria-label="Herramientas">
            {tools.map(({ tool, icon, label }) => (
                <button key={label} type="button" className="tool" title={label} aria-label={label}
                    aria-pressed={t.tool === tool} onClick={() => t.setTool(tool)}>
                    <Icon name={icon} />
                </button>
            ))}
            <span className="sep" />
            <button type="button" className="tool" title="Deshacer" aria-label="Deshacer"
                disabled={!t.canUndo} onClick={() => t.undo()}>
                <Icon name="undo" />
            </button>
            <button type="button" className="tool" title="Rehacer" aria-label="Rehacer"
                disabled={!t.canRedo} onClick={() => t.redo()}>
                <Icon name="redo" />
            </button>
            {t.drawing && <span className="live" data-testid="sketch">{t.sketch ? t.format(t.sketch) : ''}</span>}
        </div>
    );
}
