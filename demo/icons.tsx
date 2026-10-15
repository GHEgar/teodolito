import {
    Angle, Circle, Collapse, Download, Expand, Eye, EyeOff, Freehand, Point, Pointer, Polygon, Polyline, Rectangle,
    Redo, RotateLeft, RotateRight, Star, Text, Trash, Undo,
} from 'tesela/react';

const icons = {
    pointer: <Pointer size={20} stroke={1.8} />,
    line: <Polyline size={20} stroke={1.8} />,
    polygon: <Polygon size={20} stroke={1.8} />,
    freehand: <Freehand size={20} stroke={1.8} />,
    rectangle: <Rectangle size={20} stroke={1.8} />,
    angle: <Angle size={20} stroke={1.8} />,
    point: <Point size={20} stroke={1.8} />,
    text: <Text size={20} stroke={1.8} />,
    circle: <Circle size={20} stroke={1.8} />,
    symbol: <Star size={20} stroke={1.8} />,
    rotateCw: <RotateRight size={20} stroke={1.8} />,
    rotateCcw: <RotateLeft size={20} stroke={1.8} />,
    grow: <Expand size={20} stroke={1.8} />,
    shrink: <Collapse size={20} stroke={1.8} />,
    undo: <Undo size={20} stroke={1.8} />,
    redo: <Redo size={20} stroke={1.8} />,
    trash: <Trash size={20} stroke={1.8} />,
    eye: <Eye size={20} stroke={1.8} />,
    eyeOff: <EyeOff size={20} stroke={1.8} />,
    download: <Download size={20} stroke={1.8} />,
};

export type IconName = keyof typeof icons;

export function Icon({ name }: { name: IconName }) {
    return icons[name];
}
