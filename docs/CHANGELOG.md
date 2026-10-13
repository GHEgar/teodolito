# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado con
[SemVer](https://semver.org/lang/es/).

## [No publicado]

## [0.5.0] - 2026-10-13

### Agregado

- Herramienta `symbol`: un `Point` con `symbol` (string opaco: emoji, id de ícono…); `setSymbol` y
  `snapshot.symbol` eligen el que se pone, `symbol` en las opciones da el inicial.
- `rotate(id, radianes, ancla?)` y `scale(id, factor, ancla?)` para todo: transforman la geometría de
  línea, polígono, rectángulo y círculo (este no rota y escala regenerándose geodésico), y cambian
  `rotation` y `scale` de texto y símbolo. Giros en sentido horario, como el rumbo y los estilos de OL.
- `setTransform(id, { rotation, scale })` y `setRadius(id, metros)`; `scaleLimits` (`[0.25, 4]`).
- Manijas sobre la selección (`handles`, prendidas por defecto): girar, escalar, radio del círculo y
  esquinas del rectángulo, que redimensionan en su propio marco aunque esté rotado. Un arrastre es un
  solo paso de deshacer. Se dibujan con la función de estilo (`context.handle`) o con `handleStyle`.
- `Item` y `StyleContext` suman `symbol`, `rotation` y `scale`; GeoJSON los guarda y lee.
- `teodolito/react`: `useTeodolito` expone `setSymbol`, `rotate`, `scale`, `setTransform` y `setRadius`.
- Demo: símbolos con selector de emojis, manijas propias y botones de girar y escalar.

### Cambiado

- `Tool` y `Kind` suman `symbol`: un `switch` exhaustivo sobre `kind` deja de compilar.
- La instancia agrega una capa y una interacción más para las manijas.

## [0.4.0] - 2026-10-13

### Agregado

- Herramientas `circle` (polígono geodésico desde centro y radio en metros, `circleSides`, 64 por
  defecto) y `rectangle` (dos esquinas, alineado a los ejes del mapa); se guardan como `Polygon`.
- `measure.segments` (longitud, rumbo geodésico y punto medio) y `measure.angles` (ángulo interior en
  polígonos, entre segmentos en líneas) para línea, polígono y rectángulo.
- `measure.shape`: centro y radio del círculo, ancho y alto del rectángulo, recalculados con cada cambio.
- `measureSegments`, `bearing`, `formatAngle` y `formatBearing` (grados o cuadrantes).
- Demo: botones de círculo y rectángulo, etiquetas por segmento y ángulo con interruptor y detalle
  del elemento seleccionado.

### Cambiado

- `Tool` y `Kind` suman `circle` y `rectangle`: un `switch` exhaustivo sobre `kind` deja de compilar.
- `measureGeometry` acepta el `kind` como tercer argumento.
- Círculo y rectángulo se mueven pero no se editan por vértice.

## [0.3.0] - 2026-10-13

### Agregado

- `computeSurface`: relieve de un polígono sobre una rejilla, con agujeros: área plana y sobre el
  relieve, máxima, mínima, media, curva hipsométrica y alturas faltantes.
- `getPointElevation` y `computeElevation`, que despacha según la geometría (punto, línea, polígono).
- `createTerrainRgbProvider`: teselas de elevación en RGB con codificación `mapbox`, `terrarium` o
  propia, interpolación bilineal opcional, una petición por tesela y caché con límite.
- `cachedElevation`: caché de alturas por coordenada para cualquier proveedor.
- `teodolito/react`: `useElevation` para punto, línea, mano alzada y polígono.
- Demo: relieve del área con curva hipsométrica, altura del punto y selector entre el proveedor
  sintético y Terrarium de AWS.

### Cambiado

- `useProfile` se apoya en `useElevation`; su API no cambia.

## [0.2.0] - 2026-10-13

### Agregado

- Perfil de alturas: interfaz `ElevationProvider` inyectable, con lotes según `maxPoints` y cancelación
  con `AbortSignal`.
- `sampleLine`: muestreo geodésico sobre el gran círculo que conserva los vértices y respeta
  `maxSamples`; `interpolate` para puntos intermedios.
- `buildProfile` y `computeProfile`: distancia contra altura, longitud sobre el relieve, subida,
  bajada, desnivel, máximo, mínimo y alturas faltantes.
- `formatElevation`.
- `teodolito/react`: `useProfile` con debounce, abort y recálculo al editar, deshacer o rehacer.
- Demo: panel de perfil con gráfica SVG propia y un proveedor de elevación sintético.

### Cambiado

- El lint usa `@ghegar/eslint-config` (presets `base`, `react` y `ts`) en lugar de una config propia.

### Corregido

- Demo: cada elemento de la lista se selecciona con un botón y marca la selección con `aria-current`,
  en lugar de un `<li>` clickeable con `aria-selected`; el editor de texto toma el foco desde un efecto.

## [0.1.0] - 2026-10-09

### Agregado

- `createTeodolito(map, options)`: herramientas de línea, polígono, punto, mano alzada y texto, con
  medida en vivo mientras se traza y opción `once`.
- Selección con clic, mover con `Translate`, edición de vértices con `Modify` e imán con `Snap`; la
  medida se recalcula con cada cambio de geometría.
- Deshacer y rehacer de altas, bajas, borrar todo, movimientos, vértices, texto y props.
- Texto como estado: `editingTextId`, `commitText` y `cancelText`; el consumidor dibuja el input.
- `setProps`, `setVisible`, `setUnits`, `format`, `toGeoJSON` y `fromGeoJSON` en EPSG:4326.
- Teclado: Esc escalonado, Ctrl+Z, Ctrl+Shift+Z o Ctrl+Y y Supr; `escape()` para conectarlo a otra pila.
- Función de estilo del consumidor con `StyleContext`; sin estilos propios.
- `teodolito/react`: `TeodolitoProvider`, `useCreateTeodolito`, `useTeodolito`, `useSnapshot`,
  `useMeasurement` y `useTextEditor`.
- Demo en Vite con piel e íconos propios, y pruebas e2e con Playwright.

- `measureGeometry`: longitud, área, perímetro y coordenadas geodésicas con `ol/sphere`.
- `formatLength`, `formatArea`, `formatLonLat` y `formatMeasure` con unidades `auto`/m/km y
  `auto`/m²/ha/km², y formato `Intl` por locale.
