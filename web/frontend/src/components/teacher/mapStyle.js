/**
 * ESA Dark Map Style — Futuristic Navy Theme
 * Uses OpenStreetMap tiles via MapLibre GL JS
 * No API key required
 */
export const ESA_DARK_STYLE = {
  version: 8,
  name: 'ESA Dark',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    // Dark base overlay on top of OSM tiles
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#060d1f' },
    },
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      paint: {
        // Heavy darkening + hue shift to navy
        'raster-opacity': 1,
        'raster-brightness-min': 0,
        'raster-brightness-max': 0.15,
        'raster-saturation': -0.6,
        'raster-contrast': 0.1,
        'raster-hue-rotate': 200,
      },
    },
  ],
}

/**
 * Custom ESA Dark Style using OpenFreeMap vector tiles
 * Falls back to raster approach if vector unavailable
 */
export const ESA_VECTOR_STYLE = {
  version: 8,
  name: 'ESA Dark Vector',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sprite: '',
  sources: {
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    },
  },
  layers: [
    { id: 'background',       type: 'background',   paint: { 'background-color': '#070d20' } },
    { id: 'water',            type: 'fill', source: 'openmaptiles', 'source-layer': 'water',        paint: { 'fill-color': '#0a1a3a' } },
    { id: 'waterway',         type: 'line', source: 'openmaptiles', 'source-layer': 'waterway',     paint: { 'line-color': '#0e2244', 'line-width': 1 } },
    { id: 'landcover',        type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',    paint: { 'fill-color': '#080f22' } },
    { id: 'landuse',          type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',      paint: { 'fill-color': '#0b1228' } },
    { id: 'park',             type: 'fill', source: 'openmaptiles', 'source-layer': 'park',         paint: { 'fill-color': '#0a1825', 'fill-opacity': 0.8 } },
    { id: 'building-shadow',  type: 'fill', source: 'openmaptiles', 'source-layer': 'building',     paint: { 'fill-color': '#050b18', 'fill-opacity': 0.8 }, filter: ['==', '$type', 'Polygon'] },
    { id: 'building',         type: 'fill', source: 'openmaptiles', 'source-layer': 'building',     paint: { 'fill-color': '#0e1930', 'fill-outline-color': '#162040' }, filter: ['==', '$type', 'Polygon'] },
    // Roads — minor
    { id: 'road-path',        type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#18253d', 'line-width': 1 },          filter: ['in', 'class', 'path', 'track', 'service'] },
    { id: 'road-minor',       type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#1c2e50', 'line-width': 1.5 },        filter: ['in', 'class', 'minor', 'residential'] },
    { id: 'road-secondary',   type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#20376a', 'line-width': 2 },           filter: ['in', 'class', 'secondary', 'tertiary'] },
    { id: 'road-primary',     type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#253f80', 'line-width': 3 },           filter: ['in', 'class', 'primary'] },
    { id: 'road-trunk',       type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#1e4090', 'line-width': 4 },           filter: ['in', 'class', 'trunk'] },
    { id: 'road-motorway',    type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#1a3a8a', 'line-width': 5 },           filter: ['==', 'class', 'motorway'] },
    // Road glows
    { id: 'road-primary-glow',  type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#2952c0', 'line-width': 6, 'line-blur': 4, 'line-opacity': 0.25 }, filter: ['in', 'class', 'primary', 'trunk', 'motorway'] },
    // Labels
    { id: 'place-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', layout: { 'text-field': '{name}', 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-max-width': 8 }, paint: { 'text-color': '#4a7cc7', 'text-halo-color': '#060d1f', 'text-halo-width': 1.5 }, filter: ['in', 'class', 'city', 'town', 'village'] },
    { id: 'road-label',  type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', layout: { 'text-field': '{name}', 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'symbol-placement': 'line' }, paint: { 'text-color': '#3a6ab0', 'text-halo-color': '#060d1f', 'text-halo-width': 1 } },
  ],
}
