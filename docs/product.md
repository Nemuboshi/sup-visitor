# Product Requirements

## Overview & Goal

**Supview** is a client-side static web application designed for fast, local-first inspection and preview of image-based subtitle streams. Subtitle files are parsed and rendered directly in the user's browser without uploading data to external servers.

## Supported Formats

| Format          | File Requirements    | Notes                                                            |
| :-------------- | :------------------- | :--------------------------------------------------------------- |
| **Blu-ray PGS** | `.sup`               | Full Presentation Graphic Stream container parsing               |
| **VobSub**      | `.idx` + `.sub` pair | Both files required; `.sub` must share the base name with `.idx` |

- Standalone `.sub` files without a matching `.idx` index file are not supported.
- Text-based subtitle formats (SRT, ASS/SSA, VTT) are explicitly out of scope.

## Core User Capabilities

1. **File Ingestion**: Open files via system file picker or drag-and-drop into the browser window.
2. **Cue Navigation**:
   - Scrollable cue rail showing cue number, start time, end time, duration, and merge count.
   - Keyboard navigation via `↑` and `↓` arrow keys with auto-scrolling to the active cue.
   - Quick jump dialog triggered by `Ctrl+G` or `Cmd+G`.
3. **Subtitle Inspection**:
   - High-fidelity canvas preview on a neutral checkerboard background.
   - Dimensions (`width × height`), timing boundaries, duration, and merge provenance.
4. **Theme Customization**:
   - Toggle between dark and light themes with persistence in `localStorage`.
5. **Non-blocking Execution**:
   - The UI remains completely interactive and responsive while large files are being parsed.

## Adjacent Cue Merge Rules

Subtitle formats often split continuous captions across multiple adjacent packets or display sets. Supview automatically merges contiguous, identical cues into a single logical cue row.

### Merge Criteria

Two adjacent cues merge if and only if **both** of the following conditions are strictly satisfied:

1. **Time Contiguity**: `previous.endMs === current.startMs` (exact millisecond match; no tolerance threshold).
2. **Pixel-Identical Image**:
   - `left.width === right.width`
   - `left.height === right.height`
   - Byte-for-byte identity across all RGBA pixels (`left.pixels[i] === right.pixels[i]`).

### Merged Cue Properties

When contiguous cues merge:

- **Start Time**: Start time of the first cue in the chain.
- **End Time**: End time of the final cue in the chain.
- **Image**: Reuses the decoded pixel buffer from the first cue (zero extra allocation).
- **Traceability**: Retains all original source cue indexes (displayed as a badge, e.g., `2×`, in the cue list and detail header).

Chains of three or more contiguous identical cues are collapsed into a single merged cue. If there is a millisecond gap, timestamp overlap, dimension difference, or a single altered pixel, the cues remain separate.

## Jump Navigation Behavior

Pressing `Ctrl+G` (or `Cmd+G` on macOS) opens the accessible jump dialog with two input modes:

1. **Time Jump**:
   - Supports fixed `00:00:00.000` segmented input, seconds with fractional milliseconds (e.g. `83.456`), and standard `HH:MM:SS.mmm` formats.
   - **Selection Logic**:
     - Selects the cue whose active interval `[startMs, endMs]` contains the requested time.
     - If the target timestamp falls into a gap between cues, selects the next chronological cue.
     - If before the first cue, clamps to cue 1; if after the last cue, clamps to the final cue.
2. **Cue Number Jump**:
   - Accepts a 1-based cue index (e.g., `42` or `#42`).
   - Clamps safely within `[1, totalCues]`.

## Explicitly Out of Scope

The following capabilities are deliberately out of scope:

- Optical Character Recognition (OCR).
- Synchronized video playback.
- Subtitle text editing or timing adjustment.
- Subtitle translation.
- File export or format conversion.
- Backend services, user accounts, or cloud storage.
