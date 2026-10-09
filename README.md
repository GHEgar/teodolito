# teodolito

Headless measuring and drawing tools for OpenLayers. teodolito owns the state — tools, geodesic
measures, vertex editing, undo/redo, GeoJSON — and you own every pixel: it ships no styles, only the
measure and state of each feature for your own style function.

```bash
npm install teodolito ol
```

```ts
import { createTeodolito } from 'teodolito';
import { Stroke, Style, Text } from 'ol/style.js';

const t = createTeodolito(map, {
    locale: 'es-MX',
    style: (feature, { kind, label, selected, sketch }) => new Style({
        stroke: new Stroke({ color: '#0f766e', width: selected ? 4 : 2, lineDash: sketch ? [8, 6] : undefined }),
        text: new Text({ text: label }),
    }),
});

t.setTool('line');
t.subscribe(() => console.log(t.getSnapshot().items));
```

## What it does

| Feature | API |
|---|---|
| Tools: line, polygon, point, freehand, text | `setTool(tool \| null)`, `once` option |
| Geodesic measures (length, area, perimeter, lon/lat) | `item.measure`, `measureGeometry()` |
| Units `auto`/m/km and `auto`/m²/ha/km² with `Intl` | `setUnits()`, `format()`, `formatMeasure()` |
| Live measure while drawing | `snapshot.drawing`, `snapshot.sketch` |
| Select, move (Translate), edit vertices (Modify), snap | click on the map, `select(id)`, `snap` option |
| Measures follow edits | recomputed on every geometry change |
| Undo/redo of add, remove, clear, move, vertex edits, text, props | `undo()`, `redo()`, `canUndo`, `canRedo` |
| Text as state: you render the input | `editingTextId`, `commitText()`, `cancelText()` |
| Your own style props per item | `defaultProps`, `setProps(id, patch)` |
| Visibility | `setVisible(id, visible)` |
| GeoJSON in EPSG:4326 | `toGeoJSON()`, `fromGeoJSON()` |
| Keyboard: Esc, Ctrl+Z, Ctrl+Shift+Z/Ctrl+Y, Delete | `keyboard: false` to opt out, `escape()` to wire your own stack |
| Events | `onEvent({ type, ... })` |

Escape unwinds one step at a time: abort the sketch, cancel the text, clear the selection, drop the tool.
While drawing, Ctrl+Z and Delete remove the last vertex.

## Style context

Your style function gets `(feature, context)`:

| Field | Meaning |
|---|---|
| `kind` | `line`, `polygon`, `point`, `freehand` or `text` |
| `measure`, `label` | the raw measure and its formatted text (the text itself for `text`) |
| `text`, `props` | the item's text and your own props |
| `selected`, `editing` | selection and text editing state |
| `sketch`, `vertex` | the feature belongs to the drawing in progress; `vertex` is the sketch cursor point |
| `resolution` | the map resolution |

Without a style function teodolito falls back to OpenLayers' default styles.

## React

```tsx
import { TeodolitoProvider, useCreateTeodolito, useTeodolito, useTextEditor } from 'teodolito/react';

const teodolito = useCreateTeodolito(map, { style });

<TeodolitoProvider value={teodolito}>
    <Toolbar />
</TeodolitoProvider>

function Toolbar() {
    const { tool, setTool, items, canUndo, undo, format } = useTeodolito();
    ...
}
```

`useMeasurement(id)` reads one item and keeps its reference while it does not change. `useTextEditor()`
returns the text being edited with its map coordinate, `commit` and `cancel`.

## License

AGPL-3.0-only.
