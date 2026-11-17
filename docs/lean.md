# Formal Verification with Leanfran

## Overview

Supview uses **Lean 4** alongside the [leanfran](https://github.com/conao3/lean-leanfran) package to formally specify and mathematically prove correctness properties for core domain invariants.

Formal proofs ensure that foundational algorithms—such as cue boundary arithmetic and image equality criteria—behave deterministically without edge-case regressions.

## Verified Modules & Theorems

Currently, two key modules embed Lean verification blocks:

### 1. Adjacent Cue Merge (`src/lib/merge/mergeAdjacentCues.ts`)

- **Block Name**: `mergeRules`
- **Verified Definitions**:
  - `contiguous (leftEnd rightStart : Int) : Bool`: Millisecond contiguity (`leftEnd == rightStart`).
  - `sameImage (sameWidth sameHeight sameLength samePixels : Bool) : Bool`: Multi-property byte equivalence.
  - `canMerge`: Conjunction of contiguity and image byte identity.
- **Theorems Proven**:
  - `contiguous_iff`: Two cues are contiguous if and only if their timestamps match exactly.
  - `sameImage_iff`: Images are equivalent if and only if width, height, length, and pixel bytes match.
  - `canMerge_iff`: Safe merge condition is equivalent to exact timestamp match and pixel identity.

### 2. Time & Cue Jump Calculation (`src/lib/jump.ts`)

- **Block Name**: `jumpRules`
- **Verified Definitions**:
  - `timeToMilliseconds (hours minutes seconds millis : Nat) : Nat`: Invertible time arithmetic.
  - `atOrBefore (start target : Nat) : Bool`: Temporal ordering for interval checking.
  - `clampCueIndex (cueNumber cueCount : Nat) : Nat`: Bound-safe index clamping.
- **Theorems Proven**:
  - `timeToMilliseconds_nonnegative`: Guarantees non-negative millisecond results.
  - `clampCueIndex_empty`: Clamps safely to 0 when cue list is empty.
  - `clampCueIndex_nonempty`: Proves clamped cue indexes never exceed `cueCount - 1`.

## Toolchain Requirements

To edit or re-verify Lean blocks, the following tools must be available in your environment:

- **Lean**: Version `4.35.0`
- **Lake**: Version `5.0.0` (bundled with Lean 4)
- **Node.js**: `v22.18` or newer

## Development Workflow

1. **Embedding Lean**:
   Declare Lean blocks directly inside TypeScript source files using the `lean()` template tag from `leanfran`.
2. **Synchronization**:
   When a Lean block is added or modified, run:
   ```sh
   pnpm lean:sync
   ```
   This invokes `leanfran sync --package .`, updating the generated TypeScript wrapper modules in `_lean/` directories.
3. **Verification**:
   Confirm that all proof obligations are discharged:
   ```sh
   pnpm lean:check
   ```
4. **Status Check**:
   Verify that generated artifacts are fresh and match the source code:
   ```sh
   pnpm lean:status
   ```

## Tracked Artifacts

The following generated files are committed to version control:

- `src/lib/_lean/`
- `src/lib/merge/_lean/`
- `.leanfran/blocks.json`
- `leanfran.lock`

> [!NOTE]
> The internal build directory `.leanfran/workspace/` is ephemeral and should never be committed to git.
