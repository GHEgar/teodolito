import type { ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
    pointer: <path d="M6 3l13 7-5.5 1.8L11.7 18z" />,
    line: <><path d="M4 18l6-8 4 4 6-8" /><circle cx="4" cy="18" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="14" cy="14" r="1.6" /><circle cx="20" cy="6" r="1.6" /></>,
    polygon: <><path d="M5 8l7-4 7 5-3 10-9-1z" /><circle cx="5" cy="8" r="1.4" /><circle cx="19" cy="9" r="1.4" /></>,
    point: <><path d="M12 21s-6-6.2-6-11a6 6 0 1 1 12 0c0 4.8-6 11-6 11z" /><circle cx="12" cy="10" r="2" /></>,
    freehand: <path d="M3 16c2.5-5 4.5-6 6-3s3 4 5 0 4-5 7-1" />,
    text: <path d="M6 6h12M12 6v13M9 19h6" />,
    circle: <><circle cx="12" cy="12" r="8" /><path d="M12 12h8" /><circle cx="12" cy="12" r="1.2" /></>,
    rectangle: <><rect x="4" y="6" width="16" height="12" rx="1" /><circle cx="4" cy="6" r="1.4" /><circle cx="20" cy="18" r="1.4" /></>,
    symbol: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z" />,
    rotateCw: <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />,
    rotateCcw: <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5" />,
    grow: <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />,
    shrink: <path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7" />,
    angle: <><path d="M4 19h16M4 19l11-13" /><path d="M10 19a6 6 0 0 0-2-4.5" /></>,
    undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
    redo: <path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />,
    trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3 3.6M6.6 6.6C3.8 8.3 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 4.4-1" />,
    download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {paths[name]}
        </svg>
    );
}
