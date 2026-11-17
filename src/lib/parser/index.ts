import type { ParseResult, SubtitleCue } from '../model/cue';
import { mergeAdjacentCues } from '../merge/mergeAdjacentCues';
import { parseIdxSub } from './idxsub/parser';
import { parseSup } from './sup/parser';

export function parseSupFile(data: Uint8Array): ParseResult {
  return { format: 'sup', cues: mergeAdjacentCues(parseSup(data)) };
}

export function parseVobSubFiles(idxText: string, subData: Uint8Array): ParseResult {
  return {
    format: 'vobsub',
    cues: mergeAdjacentCues(parseIdxSub(idxText, subData)),
  };
}

export function getDuration(cues: readonly SubtitleCue[]): number {
  return cues.reduce((duration, cue) => Math.max(duration, cue.endMs), 0);
}
