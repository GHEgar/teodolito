export interface KeyHandlers {
    escape(): boolean;
    undo(): boolean;
    redo(): boolean;
    remove(): boolean;
}

function typing(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function route(event: KeyboardEvent, handlers: KeyHandlers): boolean {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (key === 'escape') return handlers.escape();
    if (mod && key === 'z') return event.shiftKey ? handlers.redo() : handlers.undo();
    if (mod && key === 'y') return handlers.redo();
    if (key === 'delete' || key === 'backspace') return handlers.remove();
    return false;
}

export function listenKeys(target: Window, handlers: KeyHandlers): () => void {
    const onKeyDown = (event: KeyboardEvent): void => {
        if (event.defaultPrevented || typing(event.target)) return;
        if (route(event, handlers)) event.preventDefault();
    };
    target.addEventListener('keydown', onKeyDown);
    return () => target.removeEventListener('keydown', onKeyDown);
}
