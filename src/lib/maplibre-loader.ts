/**
 * SSR-safe wrapper for maplibre-gl.
 * During server-side rendering, maplibre-gl is a browser-only package and cannot
 * be imported. We stub it out as null on the server and dynamically load it on
 * the client. This module is imported by HexMap.tsx.
 */

let maplibreModule: typeof import("maplibre-gl") | null = null;

export async function loadMaplibre(): Promise<typeof import("maplibre-gl")> {
  if (maplibreModule) return maplibreModule;
  maplibreModule = await import("maplibre-gl");
  await import("maplibre-gl/dist/maplibre-gl.css");
  return maplibreModule;
}
