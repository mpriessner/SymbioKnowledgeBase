import { describe, it, expect } from "vitest";
import { encodeQr } from "@/lib/qrcode/qrEncoder";

describe("encodeQr", () => {
  it("produces a square matrix sized 4*version+17, per the QR spec", () => {
    const matrix = encodeQr("https://kb.example.com/shared/abc123def456");
    expect(matrix.size).toBeGreaterThanOrEqual(21); // version 1 minimum
    expect((matrix.size - 17) % 4).toBe(0);
  });

  it("is deterministic: encoding the same text twice yields an identical matrix", () => {
    const text = "https://kb.example.com/shared/abc123def456";
    const a = encodeQr(text);
    const b = encodeQr(text);
    expect(b.size).toBe(a.size);
    for (let row = 0; row < a.size; row++) {
      for (let col = 0; col < a.size; col++) {
        expect(b.isDark(row, col)).toBe(a.isDark(row, col));
      }
    }
  });

  it("draws the standard finder pattern (7x7 concentric squares) in the top-left corner", () => {
    const matrix = encodeQr("https://kb.example.com/shared/abc123");
    // Outer ring dark
    for (let i = 0; i < 7; i++) {
      expect(matrix.isDark(0, i)).toBe(true);
      expect(matrix.isDark(6, i)).toBe(true);
      expect(matrix.isDark(i, 0)).toBe(true);
      expect(matrix.isDark(i, 6)).toBe(true);
    }
    // Inner ring (row/col 1..5) light border around the center
    expect(matrix.isDark(1, 1)).toBe(false);
    expect(matrix.isDark(1, 5)).toBe(false);
    // Center 3x3 dark
    for (let r = 2; r <= 4; r++) {
      for (let c = 2; c <= 4; c++) {
        expect(matrix.isDark(r, c)).toBe(true);
      }
    }
  });

  it("draws the same finder pattern in all three corners (top-left, top-right, bottom-left)", () => {
    const matrix = encodeQr("https://kb.example.com/shared/abc123");
    const n = matrix.size;
    // Top-right finder center module
    expect(matrix.isDark(3, n - 4)).toBe(true);
    // Bottom-left finder center module
    expect(matrix.isDark(n - 4, 3)).toBe(true);
  });

  it("draws an alternating timing pattern between the finder patterns", () => {
    const matrix = encodeQr("https://kb.example.com/shared/abc123");
    for (let c = 8; c < matrix.size - 8; c++) {
      expect(matrix.isDark(6, c)).toBe(c % 2 === 0);
    }
  });

  it("produces different output for different input text", () => {
    const a = encodeQr("https://kb.example.com/shared/aaaaaaaaaaaaaaaa");
    const b = encodeQr("https://kb.example.com/shared/bbbbbbbbbbbbbbbb");
    const size = Math.min(a.size, b.size);
    const cells = Array.from({ length: size * size }, (_, idx) => idx);
    const anyDifferent = cells.some((idx) => {
      const row = Math.floor(idx / size);
      const col = idx % size;
      return a.isDark(row, col) !== b.isDark(row, col);
    });
    expect(anyDifferent).toBe(true);
  });

  it("selects a larger or equal version for a higher error-correction level with the same data", () => {
    const text = "https://kb.example.com/shared/" + "a".repeat(60);
    const lowEc = encodeQr(text, "L");
    const highEc = encodeQr(text, "H");
    expect(highEc.size).toBeGreaterThanOrEqual(lowEc.size);
  });

  it("keeps the dark-module ratio roughly balanced (mask selection is working)", () => {
    const matrix = encodeQr("https://kb.example.com/shared/abc123def456ghi789");
    let dark = 0;
    for (let row = 0; row < matrix.size; row++) {
      for (let col = 0; col < matrix.size; col++) {
        if (matrix.isDark(row, col)) dark++;
      }
    }
    const ratio = dark / (matrix.size * matrix.size);
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
  });

  it("throws a clear error rather than silently truncating data that doesn't fit", () => {
    const hugeText = "a".repeat(5000);
    expect(() => encodeQr(hugeText)).toThrow(/too long/i);
  });
});
