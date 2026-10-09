# teodolito

Headless measuring and drawing tools for OpenLayers. teodolito owns the state — tools, geodesic
measures, vertex editing, undo/redo, GeoJSON — and you own every pixel: it ships no styles, only the
measure and state of each feature for your own style function.

```bash
npm install teodolito ol
```

```ts
import { measureGeometry, formatMeasure } from 'teodolito';

const measure = measureGeometry(feature.getGeometry());
formatMeasure(measure, { units: { length: 'auto', area: 'ha' }, locale: 'es-MX' });
```

Work in progress: see `docs/CHANGELOG.md`.

## License

AGPL-3.0-only.
