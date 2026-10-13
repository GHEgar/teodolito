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
| Tools: line, polygon, circle, rectangle, point, symbol, freehand, text | `setTool(tool \| null)`, `once`, `circleSides` options |
| Geodesic measures (length, area, perimeter, lon/lat) | `item.measure`, `measureGeometry()` |
| Per-segment length and bearing, vertex angles | `measure.segments`, `measure.angles` |
| Circle center and radius, rectangle width and height | `measure.shape` |
| Units `auto`/m/km and `auto`/m²/ha/km² with `Intl` | `setUnits()`, `format()`, `formatMeasure()` |
| Live measure while drawing | `snapshot.drawing`, `snapshot.sketch` |
| Select, move (Translate), edit vertices (Modify), snap | click on the map, `select(id)`, `snap` option |
| Measures follow edits | recomputed on every geometry change |
| Undo/redo of add, remove, clear, move, vertex edits, text, props | `undo()`, `redo()`, `canUndo`, `canRedo` |
| Text as state: you render the input | `editingTextId`, `commitText()`, `cancelText()` |
| Your own style props per item | `defaultProps`, `setProps(id, patch)` |
| Visibility | `setVisible(id, visible)` |
| Rotate and scale anything, circle radius | `rotate()`, `scale()`, `setTransform()`, `setRadius()` |
| On-map handles for the selection | `handles`, `handleStyle`, `context.handle` |
| GeoJSON in EPSG:4326 | `toGeoJSON()`, `fromGeoJSON()` |
| Keyboard: Esc, Ctrl+Z, Ctrl+Shift+Z/Ctrl+Y, Delete | `keyboard: false` to opt out, `escape()` to wire your own stack |
| Events | `onEvent({ type, ... })` |

Circles are geodesic polygons built from a center and a radius in meters; rectangles are axis-aligned
boxes from two corners. Both are stored as `Polygon`, so they measure, serialize and take elevation
like any polygon. They can be moved; resizing and rotating are not there yet.

Lines, polygons and rectangles carry `segments` (`length`, geodesic `bearing` 0–360°, `midpoint` in the
map projection) and `angles` (`vertex`, `degrees`, `coordinate`): interior angles for polygons whatever
the ring winding, the angle between both segments for lines. Freehand strokes and circles leave them
empty. `formatAngle()` and `formatBearing(deg, { style: 'quadrant' })` (`N 45° E`) format them.

## Symbols, rotation and scale

`setTool('symbol')` places points that carry `snapshot.symbol` (`setSymbol('🌳')`). The symbol is an
opaque string — an emoji, an icon id — and your style function draws it; teodolito ships no catalog.

`rotate(id, radians)` and `scale(id, factor)` work on every kind. Lines, polygons and rectangles are
transformed around their center (or `anchor`) and their measure follows; circles do not rotate and
scale by regenerating a geodesic circle (`setRadius(id, meters)` too). Text and symbols keep the
geometry and change `item.rotation` and `item.scale` instead, which reach your style; `scale` is clamped
to `scaleLimits` (`[0.25, 4]`). Rotation is clockwise everywhere, like bearings and OpenLayers styles.

With `handles` on (the default) the selection gets handle points your style function draws when
`context.handle` is `'rotate'`, `'scale'`, `'radius'` or `'corner'` (or pass `handleStyle`). Dragging a
handle updates live and lands as a single undo step. Rectangle corners resize in the rectangle's own
frame, so a rotated rectangle stays a rectangle.

Escape unwinds one step at a time: abort the sketch, cancel the text, clear the selection, drop the tool.
While drawing, Ctrl+Z and Delete remove the last vertex.

## Style context

Your style function gets `(feature, context)`:

| Field | Meaning |
|---|---|
| `kind` | `line`, `polygon`, `circle`, `rectangle`, `point`, `symbol`, `freehand` or `text` |
| `measure`, `label` | the raw measure and its formatted text (the text itself for `text`) |
| `text`, `props` | the item's text and your own props |
| `selected`, `editing` | selection and text editing state |
| `symbol`, `rotation`, `scale` | the item's symbol and its clockwise rotation (radians) and scale |
| `handle` | set on handle points: `rotate`, `scale`, `radius` or `corner`; `null` otherwise |
| `sketch`, `vertex` | the feature belongs to the drawing in progress; `vertex` is the sketch cursor point |
| `resolution` | the map resolution |

Without a style function teodolito falls back to OpenLayers' default styles.

## Elevation profile

teodolito samples a line and asks your `ElevationProvider` for the heights; it ships no DEM.

```ts
import { computeProfile, type ElevationProvider } from 'teodolito';

const provider: ElevationProvider = {
    maxPoints: 200,
    async getElevations(points, { signal }) {
        const response = await fetch('/elevation', { method: 'POST', body: JSON.stringify(points), signal });
        return response.json();
    },
};

const profile = await computeProfile(lineString, provider, { projection: 'EPSG:3857' });
profile.points;
profile.ascent;
```

| Piece | What it does |
|---|---|
| `sampleLine(lonLats, { step, maxSamples })` | samples along great circles, always keeping the vertices; never more than `maxSamples` (512) |
| `ElevationProvider` | `getElevations(points, { signal })` returns one height or `null` per point; `maxPoints` splits the request in batches |
| `buildProfile(samples, elevations)` | distance against elevation plus `length`, `surfaceLength`, `ascent`, `descent`, `netChange`, `max`, `min`, `missing` |
| `computeProfile(lineString, provider, options)` | all of the above for a projected `LineString`, abortable with `signal` |
| `formatElevation(meters, { locale })` | `1,523 m` |

Missing heights stay as `null` in `points`; the statistics bridge the gaps between known heights.
Profiles cover lines and freehand strokes.

### Areas and points

| Piece | What it does |
|---|---|
| `computeSurface(polygon, provider, { cells, hypsometrySteps })` | samples a `cells × cells` grid over the polygon (holes respected) plus its vertices: `planarArea`, `surfaceArea`, `min`, `max`, `mean`, `hypsometry`, `samples`, `missing` |
| `getPointElevation(point, provider)` | the height of one point, or `null` |
| `computeElevation(geometry, provider, options)` | `{ kind: 'point' \| 'profile' \| 'surface', ... }` by geometry type |

`surfaceArea` scales the exact geodesic area by the ratio between the 3D and flat area of the grid
cells, so it always agrees with `measure.area` on flat ground. `hypsometry[i].share` is the fraction of
the area above `hypsometry[i].elevation`.

### Terrain-RGB tiles

```ts
import { cachedElevation, createTerrainRgbProvider } from 'teodolito';

const provider = cachedElevation(createTerrainRgbProvider({
    url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    zoom: 12,
    encoding: 'terrarium',
    interpolate: true,
}));
```

`encoding` is `'mapbox'`, `'terrarium'` or your own `(r, g, b, a) => number | null`. Each tile is fetched
once and kept in a bounded cache (`maxTiles`, 64); an aborted request never poisons it. Tiles are decoded
with `createImageBitmap` and a canvas on first use; pass `decode` to run elsewhere, `fetch` to add headers.

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

```tsx
const { status, profile, error, refresh } = useProfile(selectedId, provider, { debounce: 250 });
```

`useElevation(id, provider, options)` does the same for points, lines and polygons and returns
`{ status, elevation, error, refresh }`; `kinds` narrows the geometries it accepts.

`useProfile` follows the item's geometry: edits, undo and redo recompute it after the debounce and abort
the previous request. While loading it keeps the last profile of the same item. Keep `provider` stable.

## License

AGPL-3.0-only.
