import type OlMap from 'ol/Map.js';
import { useEffect, useRef, useState } from 'react';
import { useTextEditor } from 'teodolito/react';

export function TextEditor({ map }: { map: OlMap }) {
    const editor = useTextEditor();
    const [pixel, setPixel] = useState<number[] | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const coordinate = editor?.coordinate ?? null;

    useEffect(() => {
        if (!coordinate) return undefined;
        const place = (): void => setPixel(map.getPixelFromCoordinate(coordinate));
        place();
        map.on('postrender', place);
        return () => map.un('postrender', place);
    }, [map, coordinate]);

    const editing = editor?.id;
    const placed = pixel !== null;
    useEffect(() => {
        if (editing && placed) input.current?.focus();
    }, [editing, placed]);

    if (!editor || !pixel) return null;
    return (
        <input key={editor.id} className="text-editor" ref={input} aria-label="Texto" defaultValue={editor.value}
            style={{ left: pixel[0], top: pixel[1] }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') editor.commit(e.currentTarget.value);
                if (e.key === 'Escape') editor.cancel();
            }}
            onBlur={(e) => editor.commit(e.currentTarget.value)} />
    );
}
