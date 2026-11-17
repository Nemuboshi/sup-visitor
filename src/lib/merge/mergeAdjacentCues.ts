import { lean } from 'leanfran';
import * as mergeRules from './_lean/mergeAdjacentCues';
import type { MergedCue, RgbaImage, SubtitleCue } from '../model/cue';

export const mergeRulesBlock = lean(
  'mergeRules',
  String.raw`
def contiguous (leftEnd rightStart : Int) : Bool := leftEnd == rightStart

def sameImage (sameWidth sameHeight sameLength samePixels : Bool) : Bool :=
  sameWidth && sameHeight && sameLength && samePixels

def canMerge (leftEnd rightStart : Int) (sameWidth sameHeight sameLength samePixels : Bool) : Bool :=
  contiguous leftEnd rightStart && sameImage sameWidth sameHeight sameLength samePixels

theorem contiguous_iff (leftEnd rightStart : Int) :
    contiguous leftEnd rightStart = true ↔ leftEnd = rightStart := by
  simp [contiguous]

theorem sameImage_iff (sameWidth sameHeight sameLength samePixels : Bool) :
    sameImage sameWidth sameHeight sameLength samePixels = true ↔
      sameWidth = true ∧ sameHeight = true ∧ sameLength = true ∧ samePixels = true := by
  simp [sameImage, Bool.and_eq_true, and_assoc]

theorem canMerge_iff (leftEnd rightStart : Int)
    (sameWidth sameHeight sameLength samePixels : Bool) :
    canMerge leftEnd rightStart sameWidth sameHeight sameLength samePixels = true ↔
      leftEnd = rightStart ∧ sameWidth = true ∧ sameHeight = true ∧
        sameLength = true ∧ samePixels = true := by
  simp [canMerge, contiguous, sameImage, Bool.and_eq_true, and_assoc]
`,
);

export function imagesEqual(left: RgbaImage, right: RgbaImage): boolean {
  if (left.width !== right.width || left.height !== right.height) return false;
  if (left.pixels.length !== right.pixels.length) return false;
  for (let index = 0; index < left.pixels.length; index += 1) {
    if (left.pixels[index] !== right.pixels[index]) return false;
  }
  return true;
}

function canMerge(left: SubtitleCue, right: SubtitleCue): boolean {
  return mergeRules.canMerge(
    left.endMs,
    right.startMs,
    left.image.width === right.image.width,
    left.image.height === right.image.height,
    left.image.pixels.length === right.image.pixels.length,
    imagesEqual(left.image, right.image),
  );
}

export function mergeAdjacentCues(cues: readonly SubtitleCue[]): MergedCue[] {
  const merged: MergedCue[] = [];
  for (const cue of cues) {
    const previous = merged.at(-1);
    if (previous && canMerge(previous, cue)) {
      merged[merged.length - 1] = {
        ...previous,
        endMs: cue.endMs,
        sourceIndexes: [...previous.sourceIndexes, cue.index],
      };
      continue;
    }
    merged.push({ ...cue, sourceIndexes: [cue.index] });
  }
  return merged;
}
