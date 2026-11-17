import { describe, expect, it } from 'vitest';
import { imagesEqual, mergeAdjacentCues } from '../src/lib/merge/mergeAdjacentCues';
import type { SubtitleCue } from '../src/lib/model/cue';

const image = (pixels: number[], width = 2, height = 1) => ({
  width,
  height,
  pixels: new Uint8Array(pixels),
});

const cue = (index: number, startMs: number, endMs: number, pixels: number[], width = 2, height = 1): SubtitleCue => ({
  index,
  startMs,
  endMs,
  image: image(pixels, width, height),
});

describe('imagesEqual', () => {
  it('compares dimensions and every RGBA byte', () => {
    expect(imagesEqual(image([1, 2, 3, 4]), image([1, 2, 3, 4]))).toBe(true);
    expect(imagesEqual(image([1, 2, 3, 4]), image([1, 2, 3, 5]))).toBe(false);
    expect(imagesEqual(image([1, 2, 3, 4]), image([1, 2, 3, 4], 1, 2))).toBe(false);
  });
});

describe('mergeAdjacentCues', () => {
  it('merges exact contiguous cues', () => {
    const result = mergeAdjacentCues([cue(1, 0, 1000, [1, 2, 3, 4]), cue(2, 1000, 2000, [1, 2, 3, 4])]);
    expect(result).toHaveLength(1);
    expect(result[0].startMs).toBe(0);
    expect(result[0].endMs).toBe(2000);
    expect(result[0].sourceIndexes).toEqual([1, 2]);
  });

  it('does not merge a gap, overlap, pixel change, or dimension change', () => {
    expect(mergeAdjacentCues([cue(1, 0, 999, [1, 2, 3, 4]), cue(2, 1000, 2000, [1, 2, 3, 4])])).toHaveLength(2);
    expect(mergeAdjacentCues([cue(1, 0, 1001, [1, 2, 3, 4]), cue(2, 1000, 2000, [1, 2, 3, 4])])).toHaveLength(2);
    expect(mergeAdjacentCues([cue(1, 0, 1000, [1, 2, 3, 4]), cue(2, 1000, 2000, [1, 2, 3, 5])])).toHaveLength(2);
    expect(mergeAdjacentCues([cue(1, 0, 1000, [1, 2, 3, 4]), cue(2, 1000, 2000, [1, 2, 3, 4], 1, 2)])).toHaveLength(2);
  });

  it('merges a chain and handles empty input', () => {
    expect(mergeAdjacentCues([])).toEqual([]);
    expect(
      mergeAdjacentCues([
        cue(1, 0, 1000, [1, 2, 3, 4]),
        cue(2, 1000, 2000, [1, 2, 3, 4]),
        cue(3, 2000, 3000, [1, 2, 3, 4]),
      ])[0].sourceIndexes,
    ).toEqual([1, 2, 3]);
  });
});
