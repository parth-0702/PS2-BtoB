/**
 * SSR stub for maplibre-gl.
 * This file is aliased in vite.config.ts during SSR builds so that the server
 * bundle does not try to import the browser-only maplibre-gl package.
 * The real maplibre-gl is loaded dynamically in the client via useEffect().
 */
export default {};
export const Map = class {};
export const NavigationControl = class {};
export const ScaleControl = class {};
export const Marker = class {};
export const GeoJSONSource = class {};
