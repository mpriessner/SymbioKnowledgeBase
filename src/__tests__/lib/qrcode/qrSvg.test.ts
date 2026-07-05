import { describe, it, expect } from "vitest";
import { encodeQr } from "@/lib/qrcode/qrEncoder";
import { matrixToSvgString, svgToDataUrl, matrixToSvgDataUrl } from "@/lib/qrcode/qrSvg";

describe("matrixToSvgString", () => {
  it("sizes the viewBox to the module count plus the default 4-module quiet zone on each side", () => {
    const matrix = encodeQr("https://kb.example.com/shared/abc123");
    const svg = matrixToSvgString(matrix);
    expect(svg).toContain(`viewBox="0 0 ${matrix.size + 8} ${matrix.size + 8}"`);
  });

  it("respects a custom quiet zone size", () => {
    const matrix = encodeQr("https://kb.example.com/shared/abc123");
    const svg = matrixToSvgString(matrix, { quietZoneModules: 2 });
    expect(svg).toContain(`viewBox="0 0 ${matrix.size + 4} ${matrix.size + 4}"`);
  });

  it("draws at least one dark-module path segment", () => {
    const matrix = encodeQr("https://kb.example.com/shared/abc123");
    const svg = matrixToSvgString(matrix);
    expect(svg).toMatch(/<path d="M\d/);
  });

  it("is a well-formed standalone SVG element", () => {
    const matrix = encodeQr("https://kb.example.com/shared/abc123");
    const svg = matrixToSvgString(matrix);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });
});

describe("svgToDataUrl / matrixToSvgDataUrl", () => {
  it("wraps the SVG as a data URL an <img src> can consume", () => {
    const svg = "<svg></svg>";
    const url = svgToDataUrl(svg);
    expect(url).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  });

  it("round-trips a QR matrix straight to a decodable data URL", () => {
    const matrix = encodeQr("https://kb.example.com/shared/abc123");
    const url = matrixToSvgDataUrl(matrix);
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    const decoded = decodeURIComponent(url.replace("data:image/svg+xml;charset=utf-8,", ""));
    expect(decoded).toContain("<svg");
  });
});
