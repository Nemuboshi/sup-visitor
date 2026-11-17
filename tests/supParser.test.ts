import { describe, expect, it } from 'vitest';
import { parseSup } from '../src/lib/parser/sup/parser';

function segment(type: number, body: number[], pts90k = 0): number[] {
  return [
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
    ...body,
  ];
}

describe('parseSup', () => {
  it('renders a minimal one-pixel PGS display set', () => {
    const pcs = [0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const pds = [0, 0, 1, 235, 128, 128, 255];
    const ods = [0, 1, 0, 0xc0, 0, 0, 7, 0, 1, 0, 1, 1, 0, 0];
    const result = parseSup(
      new Uint8Array([...segment(0x16, pcs), ...segment(0x14, pds), ...segment(0x15, ods), ...segment(0x80, [])]),
    );
    expect(result).toHaveLength(1);
    expect(result[0].image.width).toBe(1);
    expect(result[0].image.height).toBe(1);
    expect([...result[0].image.pixels]).toEqual([255, 255, 255, 255]);
    expect(result[0].endMs).toBe(2000);
  });
});
