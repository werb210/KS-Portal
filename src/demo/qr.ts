// KS_PORTAL_v8_DEMO - a small QR code encoder for the demo's "scan with your phone" link (byte mode, error correction
// level M, versions 1-10: up to 213 bytes). Follows ISO/IEC 18004 the way Project Nayuki's reference encoder does
// (MIT); written out here so the portal needs no new dependency. Output: a square matrix of booleans (true = dark).

const ECC_PER_BLOCK_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;

function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(ver: number): number {
  return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK_M[ver]! * BLOCKS_M[ver]!;
}

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j]!, root);
      if (j + 1 < result.length) result[j] = result[j]! ^ result[j + 1]!;
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    divisor.forEach((coef, i) => { result[i] = result[i]! ^ gfMul(coef, factor); });
  }
  return result;
}

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const size = ver * 4 + 17;
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

type Grid = { size: number; dark: boolean[][]; fn: boolean[][] };

function setFn(g: Grid, x: number, y: number, dark: boolean) {
  g.dark[y]![x] = dark;
  g.fn[y]![x] = true;
}

function drawFormatBits(g: Grid, mask: number) {
  const data = (0 << 3) | mask; // level M = 0b00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) setFn(g, 8, i, bit(i));
  setFn(g, 8, 7, bit(6));
  setFn(g, 8, 8, bit(7));
  setFn(g, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) setFn(g, 14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) setFn(g, g.size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setFn(g, 8, g.size - 15 + i, bit(i));
  setFn(g, 8, g.size - 8, true);
}

function drawVersion(g: Grid, ver: number) {
  if (ver < 7) return;
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (ver << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) !== 0;
    const a = g.size - 11 + (i % 3), b = Math.floor(i / 3);
    setFn(g, a, b, dark);
    setFn(g, b, a, dark);
  }
}

function drawFunctionPatterns(g: Grid, ver: number) {
  for (let i = 0; i < g.size; i++) {
    setFn(g, 6, i, i % 2 === 0);
    setFn(g, i, 6, i % 2 === 0);
  }
  const finder = (x: number, y: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < g.size && yy >= 0 && yy < g.size) setFn(g, xx, yy, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(g.size - 4, 3);
  finder(3, g.size - 4);
  const pos = alignmentPositions(ver);
  const n = pos.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) setFn(g, pos[i]! + dx, pos[j]! + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }
  drawFormatBits(g, 0); // reserves the area; drawn for real once the mask is chosen
  drawVersion(g, ver);
}

function addEcc(data: number[], ver: number): number[] {
  const numBlocks = BLOCKS_M[ver]!;
  const eccLen = ECC_PER_BLOCK_M[ver]!;
  const rawCodewords = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= numShort) result.push(b[i]!); });
  }
  return result;
}

function drawCodewords(g: Grid, codewords: number[]) {
  let i = 0;
  for (let right = g.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < g.size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? g.size - 1 - vert : vert;
        if (!g.fn[y]![x] && i < codewords.length * 8) {
          g.dark[y]![x] = ((codewords[i >>> 3]! >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
}

const MASKS: Array<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(g: Grid, mask: number) {
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (!g.fn[y]![x] && MASKS[mask]!(x, y)) g.dark[y]![x] = !g.dark[y]![x];
    }
  }
}

/** The standard's penalty score (lower reads better): runs, 2x2 blocks, finder-like patterns, dark balance. */
export function penalty(m: boolean[][]): number {
  const size = m.length;
  let score = 0;
  const lines: boolean[][] = [];
  for (let y = 0; y < size; y++) lines.push(m[y]!);
  for (let x = 0; x < size; x++) lines.push(m.map((row) => row[x]!));
  const p1 = [true, false, true, true, true, false, true, false, false, false, false];
  const p2 = [false, false, false, false, true, false, true, true, true, false, true];
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else { if (run >= 5) score += 3 + (run - 5); run = 1; }
    }
    for (let i = 0; i + 11 <= size; i++) {
      if (p1.every((v, k) => line[i + k] === v) || p2.every((v, k) => line[i + k] === v)) score += 40;
    }
  }
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = m[y]![x];
      if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1]) score += 3;
    }
  }
  const dark = m.reduce((a, row) => a + row.filter(Boolean).length, 0);
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}

/** Encodes text (UTF-8) as a QR code. forceMask is for tests; normally the mask with the lowest penalty is used. */
export function encodeQr(text: string, opts: { forceMask?: number; minVersion?: number } = {}): { version: number; mask: number; modules: boolean[][] } {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = Math.max(1, opts.minVersion ?? 1);
  const bitsNeeded = (v: number) => 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
  while (ver <= MAX_VERSION && bitsNeeded(ver) > dataCodewords(ver) * 8) ver++;
  if (ver > MAX_VERSION) throw new Error("QR: text too long");
  const capacityBits = dataCodewords(ver) * 8;
  const bits: number[] = [];
  const push = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, ver <= 9 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  const size = ver * 4 + 17;
  const blank = (): Grid => ({ size, dark: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)), fn: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)) });
  const base = blank();
  drawFunctionPatterns(base, ver);
  drawCodewords(base, addEcc(data, ver));

  const build = (mask: number) => {
    const g: Grid = { size, dark: base.dark.map((r) => r.slice()), fn: base.fn.map((r) => r.slice()) };
    applyMask(g, mask);
    drawFormatBits(g, mask);
    return g.dark;
  };
  if (opts.forceMask != null) return { version: ver, mask: opts.forceMask, modules: build(opts.forceMask) };
  let best = 0, bestScore = Infinity, bestModules: boolean[][] = [];
  for (let mask = 0; mask < 8; mask++) {
    const m = build(mask);
    const s = penalty(m);
    if (s < bestScore) { best = mask; bestScore = s; bestModules = m; }
  }
  return { version: ver, mask: best, modules: bestModules };
}

/** An SVG path ("M x y h1 v1 h-1 z" per dark module) for a 4-module quiet zone. */
export function qrSvgPath(modules: boolean[][], quiet = 4): { path: string; size: number } {
  let d = "";
  modules.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
  return { path: d, size: modules.length + quiet * 2 };
}
