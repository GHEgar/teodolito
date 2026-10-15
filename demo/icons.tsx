import type { ReactNode } from 'react';
import {
    Circle, Collapse, Download, Expand, Eye, EyeOff, Point, Pointer, Polygon, Polyline, Redo, Refresh, Star, Text,
    Trash, Undo,
} from 'tesela/react';

const own: Record<string, ReactNode> = {
    freehand: <path d="M3 16c2.5-5 4.5-6 6-3s3 4 5 0 4-5 7-1" />,
    rectangle: <><rect x="4" y="6" width="16" height="12" rx="1" /><circle cx="4" cy="6" r="1.4" /><circle cx="20" cy="18" r="1.4" /></>,
    angle: <><path d="M4 19h16M4 19l11-13" /><path d="M10 19a6 6 0 0 0-2-4.5" /></>,
};

const mirrored = { transform: 'scaleX(-1)' };

const tesela = {
    pointer: <Pointer size={20} stroke={1.8} />,
    line: <Polyline size={20} stroke={1.8} />,
    polygon: <Polygon size={20} stroke={1.8} />,
    point: <Point size={20} stroke={1.8} />,
    text: <Text size={20} stroke={1.8} />,
    circle: <Circle size={20} stroke={1.8} />,
    symbol: <Star size={20} stroke={1.8} />,
    rotateCw: <Refresh size={20} stroke={1.8} />,
    rotateCcw: <Refresh size={20} stroke={1.8} style={mirrored} />,
    grow: <Expand size={20} stroke={1.8} />,
    shrink: <Collapse size={20} stroke={1.8} />,
    undo: <Undo size={20} stroke={1.8} />,
    redo: <Redo size={20} stroke={1.8} />,
    trash: <Trash size={20} stroke={1.8} />,
    eye: <Eye size={20} stroke={1.8} />,
    eyeOff: <EyeOff size={20} stroke={1.8} />,
    download: <Download size={20} stroke={1.8} />,
};

export type IconName = keyof typeof tesela | 'freehand' | 'rectangle' | 'angle';

export function Icon({ name }: { name: IconName }) {
    if (name in tesela) return tesela[name as keyof typeof tesela];
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {own[name]}
        </svg>
    );
}
