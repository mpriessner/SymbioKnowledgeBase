import type { QrMatrix } from "./qrEncoder";

/** ISO 18004 recommends a quiet zone of at least 4 modules on every side. */
const DEFAULT_QUIET_ZONE_MODULES = 4;

/**
 * Renders a {@link QrMatrix} as a standalone SVG string. Using SVG (rather
 * than `<canvas>`) means the same markup scales losslessly for on-screen
 * display and print — no async draw call, no `canvas` polyfill dependency in
 * the client bundle, and it's trivially unit-testable as a string.
 */
export function matrixToSvgString(
  matrix: QrMatrix,
  options?: { quietZoneModules?: number }
): string {
  const quietZone = options?.quietZoneModules ?? DEFAULT_QUIET_ZONE_MODULES;
  const dimension = matrix.size + quietZone * 2;

  let path = "";
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.isDark(row, col)) {
        const x = col + quietZone;
        const y = row + quietZone;
        path += `M${x},${y}h1v1h-1z`;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" ` +
    `shape-rendering="crispEdges">` +
    `<rect width="${dimension}" height="${dimension}" fill="#ffffff"/>` +
    `<path d="${path}" fill="#000000"/>` +
    `</svg>`
  );
}

/**
 * Wraps an SVG string as a `data:` URL suitable for an `<img src>`. Uses
 * `encodeURIComponent` (not base64) so no `Buffer`/`btoa` dependency is
 * needed — this works identically in the browser and in tests (jsdom).
 */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Convenience: encode a QR matrix straight to a data URL. */
export function matrixToSvgDataUrl(
  matrix: QrMatrix,
  options?: { quietZoneModules?: number }
): string {
  return svgToDataUrl(matrixToSvgString(matrix, options));
}
