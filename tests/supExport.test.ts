import { describe, expect, it } from 'vitest';
import type { SubtitleCue } from '../src/lib/model/cue';
import { encodeSup } from '../src/lib/export/sup';
import { parseSup } from '../src/lib/parser/sup/parser';

it('encodes a SUP that the parser can render again', () => {
  const cue: SubtitleCue = {
    index: 1,
    startMs: 1000,
    endMs: 3000,
    image: { width: 1, height: 1, pixels: new Uint8Array([255, 255, 255, 255]) },
  };
  const result = parseSup(encodeSup([cue]));
  expect(result).toHaveLength(1);
  expect(result[0].startMs).toBe(1000);
  expect(result[0].image.width).toBe(1);
  expect([...result[0].image.pixels]).toEqual([255, 255, 255, 255]);
});
