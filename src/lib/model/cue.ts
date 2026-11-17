export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
}

export interface SubtitleCue {
  readonly index: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly image: RgbaImage;
}

export interface MergedCue extends SubtitleCue {
  readonly sourceIndexes: readonly number[];
}

export type InputFormat = 'sup' | 'vobsub';

export interface ParseResult {
  readonly format: InputFormat;
  readonly cues: readonly MergedCue[];
}
