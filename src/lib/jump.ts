import { lean } from 'leanfran';
import * as jumpRules from './_lean/jump';
import type { MergedCue } from './model/cue';

export const jumpRulesBlock = lean(
  'jumpRules',
  String.raw`
def timeToMilliseconds (hours minutes seconds millis : Nat) : Nat :=
  ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis

def atOrBefore (start target : Nat) : Bool := start ≤ target

def clampCueIndex (cueNumber cueCount : Nat) : Nat :=
  if cueCount = 0 then 0 else min (cueCount - 1) (cueNumber - 1)

theorem timeToMilliseconds_nonnegative (hours minutes seconds millis : Nat) :
    0 ≤ timeToMilliseconds hours minutes seconds millis := by
  omega

theorem atOrBefore_iff (start target : Nat) :
    atOrBefore start target = true ↔ start ≤ target := by
  simp [atOrBefore]

theorem clampCueIndex_empty (cueNumber : Nat) :
    clampCueIndex cueNumber 0 = 0 := by
  simp [clampCueIndex]

theorem clampCueIndex_nonempty (cueNumber cueCount : Nat) (h : cueCount > 0) :
    clampCueIndex cueNumber cueCount ≤ cueCount - 1 := by
  simp only [clampCueIndex, Nat.ne_of_gt h, ↓reduceIte]
  exact Nat.min_le_left _ _
`,
);

export function formatTime(milliseconds: number): string {
  const value = Math.max(0, Math.floor(milliseconds));
  const hours = Math.floor(value / 3_600_000);
  const minutes = Math.floor((value % 3_600_000) / 60_000);
  const seconds = Math.floor((value % 60_000) / 1000);
  const millis = value % 1000;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function formatFullTime(milliseconds: number): string {
  const value = Math.max(0, Math.floor(milliseconds));
  const hours = Math.floor(value / 3_600_000);
  const minutes = Math.floor((value % 3_600_000) / 60_000);
  const seconds = Math.floor((value % 60_000) / 1000);
  const millis = value % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function parseTime(value: string): number | undefined {
  const raw = value.trim();
  const parts = raw.split(':');
  if (parts.length > 3 || raw.length === 0) return undefined;
  const secondsPart = parts.at(-1) ?? '';
  const seconds = Number(secondsPart.replace(',', '.'));
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  const minutes = parts.length >= 2 ? Number(parts.at(-2)) : 0;
  const hours = parts.length === 3 ? Number(parts[0]) : 0;
  if (![minutes, hours].every(Number.isFinite) || minutes < 0 || hours < 0) return undefined;
  const wholeSeconds = Math.floor(seconds);
  const millis = Math.round((seconds - wholeSeconds) * 1000);
  const partsAreSafe = [hours, minutes, wholeSeconds, millis].every(Number.isSafeInteger);
  if (partsAreSafe) {
    return Number(jumpRules.timeToMilliseconds(BigInt(hours), BigInt(minutes), BigInt(wholeSeconds), BigInt(millis)));
  }
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

export function formatTimeInput(digits: string): string {
  const normalized = digits.replace(/\D/g, '').slice(-9).padStart(9, '0');
  return `${normalized.slice(0, 2)}:${normalized.slice(2, 4)}:${normalized.slice(4, 6)}.${normalized.slice(6)}`;
}

export function parseTimeInput(value: string): number | undefined {
  const raw = value.trim();
  if (!raw) return undefined;

  // Case 1: 9 raw digits like "000123500" -> format as 00:01:23.500
  if (/^\d{9}$/.test(raw)) {
    return parseTimeInput(`${raw.slice(0, 2)}:${raw.slice(2, 4)}:${raw.slice(4, 6)}.${raw.slice(6)}`);
  }

  // Case 2: Contains colons (e.g. "01:23.500", "12:34", "01:23:45.678", "1:23:45")
  if (raw.includes(':')) {
    const parts = raw.split(':');
    if (parts.length > 3) return undefined;

    const secondsPart = parts.at(-1) ?? '';
    const seconds = Number(secondsPart.replace(',', '.'));
    if (!Number.isFinite(seconds) || seconds < 0 || seconds >= 60) return undefined;

    if (parts.length >= 2) {
      const minutes = Number(parts.at(-2));
      if (!Number.isFinite(minutes) || minutes < 0 || minutes >= 60) return undefined;
    }

    if (parts.length === 3) {
      const hours = Number(parts[0]);
      if (!Number.isFinite(hours) || hours < 0) return undefined;
    }

    return parseTime(raw);
  }

  // Case 3: Pure seconds with optional 's' suffix, e.g. "83.456", "90", "45.5s"
  const cleanSeconds = raw.replace(/s$/i, '').trim();
  const seconds = Number(cleanSeconds.replace(',', '.'));
  if (Number.isFinite(seconds) && seconds >= 0) {
    return parseTime(cleanSeconds);
  }

  return undefined;
}

export function parseCueNumber(value: string): number | undefined {
  const raw = value.trim().replace(/^#/, '');
  const cueNumber = Number(raw);
  return /^\d+$/.test(raw) && Number.isInteger(cueNumber) && cueNumber > 0 ? cueNumber : undefined;
}

export type JumpTarget = { kind: 'time'; milliseconds: number } | { kind: 'cue'; cueNumber: number };

export function parseJumpTarget(value: string): JumpTarget | undefined {
  if (!value.includes(':')) return undefined;
  const milliseconds = parseTime(value);
  return milliseconds === undefined ? undefined : { kind: 'time', milliseconds };
}

export function findCueIndex(cues: readonly MergedCue[], target: JumpTarget): number {
  if (cues.length === 0) return -1;
  if (target.kind === 'cue') return Number(jumpRules.clampCueIndex(BigInt(target.cueNumber), BigInt(cues.length)));
  let result = 0;
  for (let index = 0; index < cues.length; index += 1) {
    if (!jumpRules.atOrBefore(BigInt(cues[index].startMs), BigInt(target.milliseconds))) break;
    result = index;
  }
  return result;
}
