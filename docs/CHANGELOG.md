# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado con
[SemVer](https://semver.org/lang/es/).

## [No publicado]

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
