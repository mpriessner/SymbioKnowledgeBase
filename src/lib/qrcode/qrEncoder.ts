/**
 * Self-contained QR Code (Model 2) encoder — Byte mode only.
 *
 * a71-09 needs to turn a share URL into a QR code image without adding a new
 * npm dependency (SKB's node_modules is a symlink into the main checkout in
 * this worktree, so `npm install` is unavailable). Rather than hand-transcribe
 * the Reed–Solomon block tables from memory — which the ISO 18004 spec defines
 * as literal per-version lookup data with no formula shortcut, and getting a
 * single entry wrong produces a QR code that *looks* right but silently fails
 * to scan — this module is a faithful TypeScript port of Kazuhiko Arase's
 * "qrcode-generator" library (MIT licensed, http://www.d-project.com/,
 * https://github.com/kazuhikoarase/qrcode-generator), found already vendored
 * (unmodified) inside `qrcode-terminal`'s `vendor/QRCode/` directory in a
 * sibling repo's installed node_modules on this machine. That source is a
 * long-used, real-world implementation (not hand-derived), so porting it
 * verbatim — including the full version 1-40 RS block table — carries far
 * less correctness risk than re-deriving the tables from memory.
 *
 * Only Byte mode is implemented (sufficient for ASCII share URLs); numeric/
 * alphanumeric/kanji mode optimization from the original library is dropped
 * since it is not needed here and would add surface area without benefit.
 *
 * Original copyright notice (preserved per the MIT license):
 *   QRCode for JavaScript
 *   Copyright (c) 2009 Kazuhiko Arase
 *   Licensed under the MIT license: http://www.opensource.org/licenses/mit-license.php
 *   The word "QR Code" is registered trademark of DENSO WAVE INCORPORATED
 *   http://www.denso-wave.com/qrcode/faqpatent-e.html
 */

export type QrErrorCorrectionLevel = "L" | "M" | "Q" | "H";

/** Matches the ISO 18004 format-info EC-level bit values (L=01, M=00, Q=11, H=10). */
const EC_LEVEL_VALUE: Record<QrErrorCorrectionLevel, number> = {
  M: 0,
  L: 1,
  H: 2,
  Q: 3,
};

const MODE_8BIT_BYTE = 1 << 2;

export interface QrMatrix {
  /** Number of modules per side. */
  size: number;
  /** True when the module at (row, col) is dark. */
  isDark(row: number, col: number): boolean;
}

/* ─── Galois field arithmetic (GF(256), generator 0x11D) ──────────────── */

const EXP_TABLE = new Array<number>(256);
const LOG_TABLE = new Array<number>(256);

for (let i = 0; i < 8; i++) {
  EXP_TABLE[i] = 1 << i;
}
for (let i = 8; i < 256; i++) {
  EXP_TABLE[i] =
    EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
}
for (let i = 0; i < 255; i++) {
  LOG_TABLE[EXP_TABLE[i]] = i;
}

function glog(n: number): number {
  if (n < 1) throw new Error(`glog(${n})`);
  return LOG_TABLE[n];
}

function gexp(n: number): number {
  let x = n;
  while (x < 0) x += 255;
  while (x >= 256) x -= 255;
  return EXP_TABLE[x];
}

/* ─── Polynomials over GF(256), used for Reed-Solomon ECC generation ───── */

class QrPolynomial {
  private readonly num: number[];

  constructor(num: number[], shift: number) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array<number>(num.length - offset + shift).fill(0);
    for (let i = 0; i < num.length - offset; i++) {
      this.num[i] = num[i + offset];
    }
  }

  get(index: number): number {
    return this.num[index];
  }

  getLength(): number {
    return this.num.length;
  }

  multiply(e: QrPolynomial): QrPolynomial {
    const num = new Array<number>(this.getLength() + e.getLength() - 1).fill(0);
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) {
        num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
      }
    }
    return new QrPolynomial(num, 0);
  }

  mod(e: QrPolynomial): QrPolynomial {
    if (this.getLength() - e.getLength() < 0) return this;

    const ratio = glog(this.get(0)) - glog(e.get(0));
    const num = new Array<number>(this.getLength());
    for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
    for (let x = 0; x < e.getLength(); x++) {
      num[x] ^= gexp(glog(e.get(x)) + ratio);
    }

    return new QrPolynomial(num, 0).mod(e);
  }
}

function getErrorCorrectPolynomial(errorCorrectLength: number): QrPolynomial {
  let a = new QrPolynomial([1], 0);
  for (let i = 0; i < errorCorrectLength; i++) {
    a = a.multiply(new QrPolynomial([1, gexp(i)], 0));
  }
  return a;
}

/* ─── Reed-Solomon block table (ISO 18004, versions 1-40, all 4 EC levels).
 * Copied verbatim from the vendored qrcode-generator source (see file
 * header) — each row is [count, totalCount, dataCount] repeated for a
 * version's blocks; rows come in groups of 4 (L, M, Q, H) per version. ── */

const RS_BLOCK_TABLE: number[][] = [
  // 1
  [1, 26, 19],
  [1, 26, 16],
  [1, 26, 13],
  [1, 26, 9],
  // 2
  [1, 44, 34],
  [1, 44, 28],
  [1, 44, 22],
  [1, 44, 16],
  // 3
  [1, 70, 55],
  [1, 70, 44],
  [2, 35, 17],
  [2, 35, 13],
  // 4
  [1, 100, 80],
  [2, 50, 32],
  [2, 50, 24],
  [4, 25, 9],
  // 5
  [1, 134, 108],
  [2, 67, 43],
  [2, 33, 15, 2, 34, 16],
  [2, 33, 11, 2, 34, 12],
  // 6
  [2, 86, 68],
  [4, 43, 27],
  [4, 43, 19],
  [4, 43, 15],
  // 7
  [2, 98, 78],
  [4, 49, 31],
  [2, 32, 14, 4, 33, 15],
  [4, 39, 13, 1, 40, 14],
  // 8
  [2, 121, 97],
  [2, 60, 38, 2, 61, 39],
  [4, 40, 18, 2, 41, 19],
  [4, 40, 14, 2, 41, 15],
  // 9
  [2, 146, 116],
  [3, 58, 36, 2, 59, 37],
  [4, 36, 16, 4, 37, 17],
  [4, 36, 12, 4, 37, 13],
  // 10
  [2, 86, 68, 2, 87, 69],
  [4, 69, 43, 1, 70, 44],
  [6, 43, 19, 2, 44, 20],
  [6, 43, 15, 2, 44, 16],
  // 11
  [4, 101, 81],
  [1, 80, 50, 4, 81, 51],
  [4, 50, 22, 4, 51, 23],
  [3, 36, 12, 8, 37, 13],
  // 12
  [2, 116, 92, 2, 117, 93],
  [6, 58, 36, 2, 59, 37],
  [4, 46, 20, 6, 47, 21],
  [7, 42, 14, 4, 43, 15],
  // 13
  [4, 133, 107],
  [8, 59, 37, 1, 60, 38],
  [8, 44, 20, 4, 45, 21],
  [12, 33, 11, 4, 34, 12],
  // 14
  [3, 145, 115, 1, 146, 116],
  [4, 64, 40, 5, 65, 41],
  [11, 36, 16, 5, 37, 17],
  [11, 36, 12, 5, 37, 13],
  // 15
  [5, 109, 87, 1, 110, 88],
  [5, 65, 41, 5, 66, 42],
  [5, 54, 24, 7, 55, 25],
  [11, 36, 12],
  // 16
  [5, 122, 98, 1, 123, 99],
  [7, 73, 45, 3, 74, 46],
  [15, 43, 19, 2, 44, 20],
  [3, 45, 15, 13, 46, 16],
  // 17
  [1, 135, 107, 5, 136, 108],
  [10, 74, 46, 1, 75, 47],
  [1, 50, 22, 15, 51, 23],
  [2, 42, 14, 17, 43, 15],
  // 18
  [5, 150, 120, 1, 151, 121],
  [9, 69, 43, 4, 70, 44],
  [17, 50, 22, 1, 51, 23],
  [2, 42, 14, 19, 43, 15],
  // 19
  [3, 141, 113, 4, 142, 114],
  [3, 70, 44, 11, 71, 45],
  [17, 47, 21, 4, 48, 22],
  [9, 39, 13, 16, 40, 14],
  // 20
  [3, 135, 107, 5, 136, 108],
  [3, 67, 41, 13, 68, 42],
  [15, 54, 24, 5, 55, 25],
  [15, 43, 15, 10, 44, 16],
  // 21
  [4, 144, 116, 4, 145, 117],
  [17, 68, 42],
  [17, 50, 22, 6, 51, 23],
  [19, 46, 16, 6, 47, 17],
  // 22
  [2, 139, 111, 7, 140, 112],
  [17, 74, 46],
  [7, 54, 24, 16, 55, 25],
  [34, 37, 13],
  // 23
  [4, 151, 121, 5, 152, 122],
  [4, 75, 47, 14, 76, 48],
  [11, 54, 24, 14, 55, 25],
  [16, 45, 15, 14, 46, 16],
  // 24
  [6, 147, 117, 4, 148, 118],
  [6, 73, 45, 14, 74, 46],
  [11, 54, 24, 16, 55, 25],
  [30, 46, 16, 2, 47, 17],
  // 25
  [8, 132, 106, 4, 133, 107],
  [8, 75, 47, 13, 76, 48],
  [7, 54, 24, 22, 55, 25],
  [22, 45, 15, 13, 46, 16],
  // 26
  [10, 142, 114, 2, 143, 115],
  [19, 74, 46, 4, 75, 47],
  [28, 50, 22, 6, 51, 23],
  [33, 46, 16, 4, 47, 17],
  // 27
  [8, 152, 122, 4, 153, 123],
  [22, 73, 45, 3, 74, 46],
  [8, 53, 23, 26, 54, 24],
  [12, 45, 15, 28, 46, 16],
  // 28
  [3, 147, 117, 10, 148, 118],
  [3, 73, 45, 23, 74, 46],
  [4, 54, 24, 31, 55, 25],
  [11, 45, 15, 31, 46, 16],
  // 29
  [7, 146, 116, 7, 147, 117],
  [21, 73, 45, 7, 74, 46],
  [1, 53, 23, 37, 54, 24],
  [19, 45, 15, 26, 46, 16],
  // 30
  [5, 145, 115, 10, 146, 116],
  [19, 75, 47, 10, 76, 48],
  [15, 54, 24, 25, 55, 25],
  [23, 45, 15, 25, 46, 16],
  // 31
  [13, 145, 115, 3, 146, 116],
  [2, 74, 46, 29, 75, 47],
  [42, 54, 24, 1, 55, 25],
  [23, 45, 15, 28, 46, 16],
  // 32
  [17, 145, 115],
  [10, 74, 46, 23, 75, 47],
  [10, 54, 24, 35, 55, 25],
  [19, 45, 15, 35, 46, 16],
  // 33
  [17, 145, 115, 1, 146, 116],
  [14, 74, 46, 21, 75, 47],
  [29, 54, 24, 19, 55, 25],
  [11, 45, 15, 46, 46, 16],
  // 34
  [13, 145, 115, 6, 146, 116],
  [14, 74, 46, 23, 75, 47],
  [44, 54, 24, 7, 55, 25],
  [59, 46, 16, 1, 47, 17],
  // 35
  [12, 151, 121, 7, 152, 122],
  [12, 75, 47, 26, 76, 48],
  [39, 54, 24, 14, 55, 25],
  [22, 45, 15, 41, 46, 16],
  // 36
  [6, 151, 121, 14, 152, 122],
  [6, 75, 47, 34, 76, 48],
  [46, 54, 24, 10, 55, 25],
  [2, 45, 15, 64, 46, 16],
  // 37
  [17, 152, 122, 4, 153, 123],
  [29, 74, 46, 14, 75, 47],
  [49, 54, 24, 10, 55, 25],
  [24, 45, 15, 46, 46, 16],
  // 38
  [4, 152, 122, 18, 153, 123],
  [13, 74, 46, 32, 75, 47],
  [48, 54, 24, 14, 55, 25],
  [42, 45, 15, 32, 46, 16],
  // 39
  [20, 147, 117, 4, 148, 118],
  [40, 75, 47, 7, 76, 48],
  [43, 54, 24, 22, 55, 25],
  [10, 45, 15, 67, 46, 16],
  // 40
  [19, 148, 118, 6, 149, 119],
  [18, 75, 47, 31, 76, 48],
  [34, 54, 24, 34, 55, 25],
  [20, 45, 15, 61, 46, 16],
];

interface RsBlock {
  totalCount: number;
  dataCount: number;
}

function getRsBlockTableRow(
  typeNumber: number,
  ecLevel: QrErrorCorrectionLevel
): number[] {
  const offset = { L: 0, M: 1, Q: 2, H: 3 }[ecLevel];
  const row = RS_BLOCK_TABLE[(typeNumber - 1) * 4 + offset];
  if (!row) {
    throw new Error(
      `bad rs block @ typeNumber:${typeNumber}/errorCorrectLevel:${ecLevel}`
    );
  }
  return row;
}

function getRSBlocks(
  typeNumber: number,
  ecLevel: QrErrorCorrectionLevel
): RsBlock[] {
  const row = getRsBlockTableRow(typeNumber, ecLevel);
  const length = row.length / 3;
  const list: RsBlock[] = [];
  for (let i = 0; i < length; i++) {
    const count = row[i * 3 + 0];
    const totalCount = row[i * 3 + 1];
    const dataCount = row[i * 3 + 2];
    for (let j = 0; j < count; j++) {
      list.push({ totalCount, dataCount });
    }
  }
  return list;
}

/* ─── Bit buffer ────────────────────────────────────────────────────── */

class QrBitBuffer {
  buffer: number[] = [];
  length = 0;

  put(num: number, length: number): void {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }

  getLengthInBits(): number {
    return this.length;
  }

  putBit(bit: boolean): void {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= 0x80 >>> this.length % 8;
    this.length++;
  }
}

/* ─── Position/format/version constant tables ──────────────────────── */

const PATTERN_POSITION_TABLE: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
];

const G15 =
  (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
const G18 =
  (1 << 12) |
  (1 << 11) |
  (1 << 10) |
  (1 << 9) |
  (1 << 8) |
  (1 << 5) |
  (1 << 2) |
  (1 << 0);
const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

function getBCHDigit(data: number): number {
  let digit = 0;
  let d = data;
  while (d !== 0) {
    digit++;
    d >>>= 1;
  }
  return digit;
}

function getBCHTypeInfo(data: number): number {
  let d = data << 10;
  while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
    d ^= G15 << (getBCHDigit(d) - getBCHDigit(G15));
  }
  return ((data << 10) | d) ^ G15_MASK;
}

function getBCHTypeNumber(data: number): number {
  let d = data << 12;
  while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
    d ^= G18 << (getBCHDigit(d) - getBCHDigit(G18));
  }
  return (data << 12) | d;
}

function getPatternPosition(typeNumber: number): number[] {
  return PATTERN_POSITION_TABLE[typeNumber - 1];
}

function getMask(maskPattern: number, i: number, j: number): boolean {
  switch (maskPattern) {
    case 0:
      return (i + j) % 2 === 0;
    case 1:
      return i % 2 === 0;
    case 2:
      return j % 3 === 0;
    case 3:
      return (i + j) % 3 === 0;
    case 4:
      return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
    case 5:
      return ((i * j) % 2) + ((i * j) % 3) === 0;
    case 6:
      return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
    case 7:
      return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
    default:
      throw new Error(`bad maskPattern:${maskPattern}`);
  }
}

/** Byte-mode length-indicator width in bits, by version range. */
function getLengthInBits(typeNumber: number): number {
  if (typeNumber < 1 || typeNumber > 40) {
    throw new Error(`type:${typeNumber}`);
  }
  return typeNumber < 10 ? 8 : 16;
}

/* ─── The QR symbol builder ────────────────────────────────────────── */

class QrSymbol {
  typeNumber: number;
  errorCorrectLevel: QrErrorCorrectionLevel;
  moduleCount = 0;
  modules: (boolean | null)[][] = [];
  private dataCache: number[] | null = null;
  private readonly text: string;

  constructor(typeNumber: number, errorCorrectLevel: QrErrorCorrectionLevel, text: string) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.text = text;
  }

  isDark(row: number, col: number): boolean {
    if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
      throw new Error(`${row},${col}`);
    }
    return this.modules[row][col] === true;
  }

  make(): void {
    if (this.typeNumber < 1) {
      let typeNumber = 1;
      for (; typeNumber < 40; typeNumber++) {
        const rsBlocks = getRSBlocks(typeNumber, this.errorCorrectLevel);
        const totalDataCount = rsBlocks.reduce((sum, b) => sum + b.dataCount, 0);

        const buffer = new QrBitBuffer();
        buffer.put(MODE_8BIT_BYTE, 4);
        buffer.put(this.text.length, getLengthInBits(typeNumber));
        for (let i = 0; i < this.text.length; i++) {
          buffer.put(this.text.charCodeAt(i), 8);
        }

        if (buffer.getLengthInBits() <= totalDataCount * 8) break;
      }
      this.typeNumber = typeNumber;
    }
    this.makeImpl(false, this.getBestMaskPattern());
  }

  private makeImpl(test: boolean, maskPattern: number): void {
    this.moduleCount = this.typeNumber * 4 + 17;
    this.modules = new Array(this.moduleCount);
    for (let row = 0; row < this.moduleCount; row++) {
      this.modules[row] = new Array(this.moduleCount).fill(null);
    }

    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(this.moduleCount - 7, 0);
    this.setupPositionProbePattern(0, this.moduleCount - 7);
    this.setupPositionAdjustPattern();
    this.setupTimingPattern();
    this.setupTypeInfo(test, maskPattern);

    if (this.typeNumber >= 7) {
      this.setupTypeNumber(test);
    }

    if (this.dataCache === null) {
      this.dataCache = createData(this.typeNumber, this.errorCorrectLevel, this.text);
    }

    this.mapData(this.dataCache, maskPattern);
  }

  private setupPositionProbePattern(row: number, col: number): void {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue;
        const dark =
          (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4);
        this.modules[row + r][col + c] = dark;
      }
    }
  }

  private getBestMaskPattern(): number {
    let minLostPoint = 0;
    let pattern = 0;
    for (let i = 0; i < 8; i++) {
      this.makeImpl(true, i);
      const lostPoint = getLostPoint(this);
      if (i === 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint;
        pattern = i;
      }
    }
    return pattern;
  }

  private setupTimingPattern(): void {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] !== null) continue;
      this.modules[r][6] = r % 2 === 0;
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] !== null) continue;
      this.modules[6][c] = c % 2 === 0;
    }
  }

  private setupPositionAdjustPattern(): void {
    const pos = getPatternPosition(this.typeNumber);
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i];
        const col = pos[j];
        if (this.modules[row][col] !== null) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const dark = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
            this.modules[row + r][col + c] = dark;
          }
        }
      }
    }
  }

  private setupTypeNumber(test: boolean): void {
    const bits = getBCHTypeNumber(this.typeNumber);
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod;
    }
    for (let x = 0; x < 18; x++) {
      const mod = !test && ((bits >> x) & 1) === 1;
      this.modules[(x % 3) + this.moduleCount - 8 - 3][Math.floor(x / 3)] = mod;
    }
  }

  private setupTypeInfo(test: boolean, maskPattern: number): void {
    const data = (EC_LEVEL_VALUE[this.errorCorrectLevel] << 3) | maskPattern;
    const bits = getBCHTypeInfo(data);

    for (let v = 0; v < 15; v++) {
      const mod = !test && ((bits >> v) & 1) === 1;
      if (v < 6) {
        this.modules[v][8] = mod;
      } else if (v < 8) {
        this.modules[v + 1][8] = mod;
      } else {
        this.modules[this.moduleCount - 15 + v][8] = mod;
      }
    }

    for (let h = 0; h < 15; h++) {
      const mod = !test && ((bits >> h) & 1) === 1;
      if (h < 8) {
        this.modules[8][this.moduleCount - h - 1] = mod;
      } else if (h < 9) {
        this.modules[8][15 - h - 1 + 1] = mod;
      } else {
        this.modules[8][15 - h - 1] = mod;
      }
    }

    this.modules[this.moduleCount - 8][8] = !test;
  }

  private mapData(data: number[], maskPattern: number): void {
    let inc = -1;
    let row = this.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;

    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--;

      for (;;) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            }
            if (getMask(maskPattern, row, col - c)) dark = !dark;
            this.modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }

        row += inc;
        if (row < 0 || this.moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }
}

const PAD0 = 0xec;
const PAD1 = 0x11;

function createData(
  typeNumber: number,
  errorCorrectLevel: QrErrorCorrectionLevel,
  text: string
): number[] {
  const rsBlocks = getRSBlocks(typeNumber, errorCorrectLevel);
  const buffer = new QrBitBuffer();

  buffer.put(MODE_8BIT_BYTE, 4);
  buffer.put(text.length, getLengthInBits(typeNumber));
  for (let i = 0; i < text.length; i++) {
    buffer.put(text.charCodeAt(i), 8);
  }

  const totalDataCount = rsBlocks.reduce((sum, b) => sum + b.dataCount, 0);

  if (buffer.getLengthInBits() > totalDataCount * 8) {
    throw new Error(
      `Text is too long for a QR code (even at version 40): ${buffer.getLengthInBits()} bits > ${totalDataCount * 8} bits available.`
    );
  }

  if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
    buffer.put(0, 4);
  }

  while (buffer.getLengthInBits() % 8 !== 0) {
    buffer.putBit(false);
  }

  for (;;) {
    if (buffer.getLengthInBits() >= totalDataCount * 8) break;
    buffer.put(PAD0, 8);
    if (buffer.getLengthInBits() >= totalDataCount * 8) break;
    buffer.put(PAD1, 8);
  }

  return createBytes(buffer, rsBlocks);
}

function createBytes(buffer: QrBitBuffer, rsBlocks: RsBlock[]): number[] {
  let offset = 0;
  let maxDcCount = 0;
  let maxEcCount = 0;

  const dcdata: number[][] = new Array(rsBlocks.length);
  const ecdata: number[][] = new Array(rsBlocks.length);

  for (let r = 0; r < rsBlocks.length; r++) {
    const dcCount = rsBlocks[r].dataCount;
    const ecCount = rsBlocks[r].totalCount - dcCount;

    maxDcCount = Math.max(maxDcCount, dcCount);
    maxEcCount = Math.max(maxEcCount, ecCount);

    dcdata[r] = new Array(dcCount);
    for (let i = 0; i < dcdata[r].length; i++) {
      dcdata[r][i] = 0xff & buffer.buffer[i + offset];
    }
    offset += dcCount;

    const rsPoly = getErrorCorrectPolynomial(ecCount);
    const rawPoly = new QrPolynomial(dcdata[r], rsPoly.getLength() - 1);
    const modPoly = rawPoly.mod(rsPoly);

    ecdata[r] = new Array(rsPoly.getLength() - 1);
    for (let x = 0; x < ecdata[r].length; x++) {
      const modIndex = x + modPoly.getLength() - ecdata[r].length;
      ecdata[r][x] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
    }
  }

  const totalCodeCount = rsBlocks.reduce((sum, b) => sum + b.totalCount, 0);
  const data = new Array<number>(totalCodeCount);
  let index = 0;

  for (let z = 0; z < maxDcCount; z++) {
    for (let s = 0; s < rsBlocks.length; s++) {
      if (z < dcdata[s].length) data[index++] = dcdata[s][z];
    }
  }
  for (let z = 0; z < maxEcCount; z++) {
    for (let s = 0; s < rsBlocks.length; s++) {
      if (z < ecdata[s].length) data[index++] = ecdata[s][z];
    }
  }

  return data;
}

function getLostPoint(symbol: QrSymbol): number {
  const moduleCount = symbol.moduleCount;
  let lostPoint = 0;

  // Level 1: same-color runs / blocks around each module.
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      let sameCount = 0;
      const dark = symbol.isDark(row, col);
      for (let r = -1; r <= 1; r++) {
        if (row + r < 0 || moduleCount <= row + r) continue;
        for (let c = -1; c <= 1; c++) {
          if (col + c < 0 || moduleCount <= col + c) continue;
          if (r === 0 && c === 0) continue;
          if (dark === symbol.isDark(row + r, col + c)) sameCount++;
        }
      }
      if (sameCount > 5) lostPoint += 3 + sameCount - 5;
    }
  }

  // Level 2: 2x2 same-color blocks.
  for (let row = 0; row < moduleCount - 1; row++) {
    for (let col = 0; col < moduleCount - 1; col++) {
      let count = 0;
      if (symbol.isDark(row, col)) count++;
      if (symbol.isDark(row + 1, col)) count++;
      if (symbol.isDark(row, col + 1)) count++;
      if (symbol.isDark(row + 1, col + 1)) count++;
      if (count === 0 || count === 4) lostPoint += 3;
    }
  }

  // Level 3: finder-like 1:1:3:1:1 ratio runs.
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount - 6; col++) {
      if (
        symbol.isDark(row, col) &&
        !symbol.isDark(row, col + 1) &&
        symbol.isDark(row, col + 2) &&
        symbol.isDark(row, col + 3) &&
        symbol.isDark(row, col + 4) &&
        !symbol.isDark(row, col + 5) &&
        symbol.isDark(row, col + 6)
      ) {
        lostPoint += 40;
      }
    }
  }
  for (let col = 0; col < moduleCount; col++) {
    for (let row = 0; row < moduleCount - 6; row++) {
      if (
        symbol.isDark(row, col) &&
        !symbol.isDark(row + 1, col) &&
        symbol.isDark(row + 2, col) &&
        symbol.isDark(row + 3, col) &&
        symbol.isDark(row + 4, col) &&
        !symbol.isDark(row + 5, col) &&
        symbol.isDark(row + 6, col)
      ) {
        lostPoint += 40;
      }
    }
  }

  // Level 4: overall dark-module ratio vs 50%.
  let darkCount = 0;
  for (let col = 0; col < moduleCount; col++) {
    for (let row = 0; row < moduleCount; row++) {
      if (symbol.isDark(row, col)) darkCount++;
    }
  }
  const ratio = Math.abs((100 * darkCount) / moduleCount / moduleCount - 50) / 5;
  lostPoint += ratio * 10;

  return lostPoint;
}

/**
 * Encodes `text` (ASCII/Latin-1 only — e.g. a share URL) as a QR code,
 * auto-selecting the smallest version (1-40) that fits at the requested
 * error correction level, and the mask pattern with the lowest penalty score.
 *
 * Throws if `text` doesn't fit even at version 40.
 */
export function encodeQr(
  text: string,
  ecLevel: QrErrorCorrectionLevel = "M"
): QrMatrix {
  const symbol = new QrSymbol(0, ecLevel, text);
  symbol.make();
  return {
    size: symbol.moduleCount,
    isDark: (row: number, col: number) => symbol.isDark(row, col),
  };
}
