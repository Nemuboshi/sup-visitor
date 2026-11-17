import { describe, expect, it } from 'vitest';
import {
  findCueIndex,
  formatFullTime,
  formatTime,
  formatTimeInput,
  parseCueNumber,
  parseJumpTarget,
  parseTime,
  parseTimeInput,
} from '../src/lib/jump';
import type { MergedCue } from '../src/lib/model/cue';

const cues = (starts: number[]): MergedCue[] =>
  starts.map((startMs, index) => ({
    index: index + 1,
    startMs,
    endMs: startMs + 500,
    sourceIndexes: [index + 1],
    image: { width: 1, height: 1, pixels: new Uint8Array(4) },
  }));

describe('jump parsing', () => {
  it('parses clock time and keeps cue numbers separate', () => {
    expect(parseTime('01:02.500')).toBe(62_500);
    expect(parseTime('1:01:02.500')).toBe(3_662_500);
    expect(parseJumpTarget('42')).toBeUndefined();
    expect(parseCueNumber('42')).toBe(42);
    expect(parseCueNumber('#42')).toBe(42);
    expect(parseJumpTarget('01:02')).toEqual({ kind: 'time', milliseconds: 62_000 });
  });

  it('formats and parses the fixed and flexible numeric time input', () => {
    expect(formatTimeInput('0123500')).toBe('00:01:23.500');
    expect(parseTimeInput('00:01:23.500')).toBe(83_500);
    expect(parseTimeInput('00:60:00.000')).toBeUndefined();
    expect(parseTimeInput('12:34')).toBe(754_000);
    expect(parseTimeInput('01:02.500')).toBe(62_500);
    expect(parseTimeInput('1:23:45.678')).toBe(5_025_678);
    expect(parseTimeInput('83.456')).toBe(83_456);
    expect(parseTimeInput('90s')).toBe(90_000);
    expect(parseTimeInput('000123500')).toBe(83_500);
    expect(parseTimeInput('00:01:23,500')).toBe(83_500);
    expect(parseTimeInput('invalid')).toBeUndefined();
    expect(formatFullTime(83_500)).toBe('00:01:23.500');
    expect(formatFullTime(3_662_500)).toBe('01:01:02.500');
  });

  it('finds the cue at or before a time and clamps cue numbers', () => {
    const list = cues([0, 1000, 2500]);
    expect(findCueIndex(list, { kind: 'time', milliseconds: 1900 })).toBe(1);
    expect(findCueIndex(list, { kind: 'time', milliseconds: 99_000 })).toBe(2);
    expect(findCueIndex(list, { kind: 'cue', cueNumber: 0 })).toBe(0);
    expect(findCueIndex(list, { kind: 'cue', cueNumber: 99 })).toBe(2);
  });

  it('formats stable millisecond timestamps', () => {
    expect(formatTime(62_500)).toBe('1:02.500');
    expect(formatTime(3_662_500)).toBe('1:01:02.500');
  });
});
