import type { SubtitleCue } from '../model/cue';

const SEGMENT_PDS = 0x14;
const SEGMENT_ODS = 0x15;
const SEGMENT_PCS = 0x16;
const SEGMENT_END = 0x80;

interface PaletteColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

function segment(type: number, pts90k: number, body: readonly number[]): number[] {
  const result = [
    0x50,
    0x47,
    (pts90k >>> 24) & 0xff,
    (pts90k >>> 16) & 0xff,
    (pts90k >>> 8) & 0xff,
    pts90k & 0xff,
    0,
    0,
    0,
    0,
    type,
    (body.length >>> 8) & 0xff,
    body.length & 0xff,
  ];
  return result.concat(body);
}

function ycbcr(color: PaletteColor): [number, number, number] {
  const y = Math.round(0.257 * color.r + 0.504 * color.g + 0.098 * color.b + 16);
  const cb = Math.round(-0.148 * color.r - 0.291 * color.g + 0.439 * color.b + 128);
  const cr = Math.round(0.439 * color.r - 0.368 * color.g - 0.071 * color.b + 128);
  return [Math.max(0, Math.min(255, y)), Math.max(0, Math.min(255, cb)), Math.max(0, Math.min(255, cr))];
}

function makePalette(cues: readonly SubtitleCue[]): PaletteColor[] {
  const palette: PaletteColor[] = [{ r: 0, g: 0, b: 0, a: 0 }];
  const seen = new Set<string>(['0,0,0,0']);
  for (const cue of cues) {
    for (let offset = 0; offset < cue.image.pixels.length; offset += 4) {
      const color: PaletteColor = {
        r: cue.image.pixels[offset],
        g: cue.image.pixels[offset + 1],
        b: cue.image.pixels[offset + 2],
        a: cue.image.pixels[offset + 3],
      };
      if (color.a === 0) continue;
      const key = `${color.r},${color.g},${color.b},${color.a}`;
      if (!seen.has(key) && palette.length < 256) {
        seen.add(key);
        palette.push(color);
      }
    }
  }
  return palette;
}

function nearestColor(color: PaletteColor, palette: readonly PaletteColor[]): number {
  let best = 1;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < palette.length; index += 1) {
    const candidate = palette[index];
    const score =
      (color.r - candidate.r) ** 2 +
      (color.g - candidate.g) ** 2 +
      (color.b - candidate.b) ** 2 +
      (color.a - candidate.a) ** 2;
    if (score < distance) {
      distance = score;
      best = index;
    }
  }
  return best;
}

function indexedPixels(cue: SubtitleCue, palette: readonly PaletteColor[]): number[] {
  const indexes: number[] = [];
  const lookup = new Map<string, number>();
  palette.forEach((color, index) => lookup.set(`${color.r},${color.g},${color.b},${color.a}`, index));
  for (let offset = 0; offset < cue.image.pixels.length; offset += 4) {
    const color: PaletteColor = {
      r: cue.image.pixels[offset],
      g: cue.image.pixels[offset + 1],
      b: cue.image.pixels[offset + 2],
      a: cue.image.pixels[offset + 3],
    };
    indexes.push(
      color.a === 0 ? 0 : (lookup.get(`${color.r},${color.g},${color.b},${color.a}`) ?? nearestColor(color, palette)),
    );
  }
  return indexes;
}

function encodeRle(cue: SubtitleCue, palette: readonly PaletteColor[]): number[] {
  const indexes = indexedPixels(cue, palette);
  const output: number[] = [];
  for (let y = 0; y < cue.image.height; y += 1) {
    const row = indexes.slice(y * cue.image.width, (y + 1) * cue.image.width);
    for (let x = 0; x < row.length;) {
      const value = row[x];
      let run = 1;
      while (x + run < row.length && row[x + run] === value) run += 1;
      const runLength = run;
      if (value === 0) {
        while (run > 0) {
          const size = Math.min(run, 0x3f);
          output.push(0, size);
          run -= size;
        }
      } else {
        for (let index = 0; index < runLength; index += 1) output.push(value);
      }
      x += runLength;
    }
    output.push(0, 0);
  }
  return output;
}

function pts(milliseconds: number): number {
  return Math.max(0, Math.round(milliseconds * 90));
}

export function encodeSup(cues: readonly SubtitleCue[]): Uint8Array {
  if (cues.length === 0) return new Uint8Array();
  const palette = makePalette(cues);
  const output: number[] = [];
  cues.forEach((cue, cueIndex) => {
    const objectId = cueIndex + 1;
    const objectIdHigh = (objectId >>> 8) & 0xff;
    const objectIdLow = objectId & 0xff;
    const timestamp = pts(cue.startMs);
    const rle = encodeRle(cue, palette);
    const pcs = [
      cue.image.width >>> 8,
      cue.image.width & 0xff,
      cue.image.height >>> 8,
      cue.image.height & 0xff,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      objectIdHigh,
      objectIdLow,
      0,
      0,
      0,
      0,
      0,
      0,
    ];
    output.push(...segment(SEGMENT_PCS, timestamp, pcs));
    const pds = [
      0,
      0,
      ...palette.flatMap((color, index) => {
        const [y, cb, cr] = ycbcr(color);
        return [index, y, cr, cb, color.a];
      }),
    ];
    output.push(...segment(SEGMENT_PDS, timestamp, pds));
    const firstSize = Math.min(rle.length, 65535 - 11);
    const header = [
      objectIdHigh,
      objectIdLow,
      0,
      rle.length <= firstSize ? 0xc0 : 0x80,
      (rle.length + 4) >>> 16,
      ((rle.length + 4) >>> 8) & 0xff,
      (rle.length + 4) & 0xff,
      cue.image.width >>> 8,
      cue.image.width & 0xff,
      cue.image.height >>> 8,
      cue.image.height & 0xff,
    ];
    output.push(...segment(SEGMENT_ODS, timestamp, header.concat(rle.slice(0, firstSize))));
    for (let offset = firstSize; offset < rle.length; offset += 65531) {
      const chunk = rle.slice(offset, offset + 65531);
      const sequence = offset + chunk.length >= rle.length ? 0x40 : 0;
      output.push(...segment(SEGMENT_ODS, timestamp, [objectIdHigh, objectIdLow, 0, sequence, ...chunk]));
    }
    output.push(...segment(SEGMENT_END, timestamp, []));
  });
  return new Uint8Array(output);
}
