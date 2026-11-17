# System Architecture

## Overview

Supview is structured as a decoupled, zero-backend static client. Computationally heavy binary parsing and image decompression run in background Web Workers, while the main thread manages reactive UI state, theme management, and rendering.

```text
File Input (Drag/Drop or Picker)
    │
    ▼
Web Worker (src/lib/worker/parser.worker.ts)
    ├── Binary Stream Reader (SUP / VobSub)
    ├── RLE Image Decompressor
    ├── Raw Cue Extraction
    └── Adjacent Cue Merge Engine (Lean-verified)
    │
    ▼ Transferable Result
Main Thread (Svelte 5 Store / App.svelte)
    ├── View Model & State
    ├── Cue Rail & Keyboard Navigation
    ├── Canvas Subtitle Renderer
    └── Bits UI Jump Dialog
```

## Application Layers

```text
src/
├── lib/
│   ├── parser/         # Binary decoders for PGS (.sup) and VobSub (.idx/.sub)
│   ├── model/          # Core domain models (SubtitleCue, MergedCue, RgbaImage)
│   ├── merge/          # Pure adjacent cue merge algorithm + Leanfran bridge
│   ├── worker/         # Web Worker entrypoint and message dispatcher
│   ├── jump.ts         # Jump calculation, time parsing, and Leanfran bridge
│   ├── ui/             # Accessible UI abstraction layer built on Bits UI
│   ├── theme/          # Theme store, system preference detection, CSS variables
│   ├── components/     # High-level UI widgets (JumpDialog, RgbaCanvas)
│   └── */_lean/        # Auto-generated Lean verification artifacts
└── App.svelte          # Root workspace orchestrator
```

### Layer Constraints

1. **Parser Decoupling**: Parsers operate strictly on `Uint8Array` / `ArrayBuffer` data structures and never import Svelte, DOM APIs, or UI components.
2. **UI Abstraction**: Application pages must consume design primitives through `src/lib/ui` rather than instantiating raw HTML controls directly.
3. **Formal Verification Integration**: Pure business invariants (merge criteria in `src/lib/merge` and jump mechanics in `src/lib/jump.ts`) are formally specified and proved with Lean 4 via `leanfran`.
4. **Theme Isolation**: All theme-specific colors and surface styles are defined via CSS custom properties in `src/lib/theme/theme.css`. Components must never hard-code hex color literals.

## Parser Architecture

Parsers decode raw binary packets into typed `SubtitleCue` models:

```typescript
interface RgbaImage {
  width: number;
  height: number;
  pixels: Uint8ClampedArray | Uint8Array;
}

interface SubtitleCue {
  startMs: number;
  endMs: number;
  image: RgbaImage;
}
```

- **Blu-ray PGS Parser (`src/lib/parser/sup`)**:
  - Parses Presentation Composition Segments (PCS), Window Definition Segments (WDS), Palette Definition Segments (PDS), and Object Definition Segments (ODS).
  - Decompresses run-length encoded (RLE) bitstreams into raw RGBA pixel arrays.
- **VobSub Parser (`src/lib/parser/idxsub`)**:
  - Parses index timestamp offsets from the text `.idx` file.
  - Slices MPEG packetized elementary streams (PES) from the `.sub` binary file and decodes 2-bit RLE pixel data against the embedded 16-color palette.

## Web Worker Boundary

To prevent UI thread stuttering when processing files up to 100 MB:

1. **Main -> Worker**: Sends file buffers as `ArrayBuffer` using transferable object semantics where possible.
2. **Worker -> Main**:
   - Streams progress notifications during long operations.
   - Emits structured results containing the merged cue list and file metadata, or descriptive error payloads.
   - Terminates gracefully or on explicit cancellation.

## Memory Management

- **Virtual / Targeted Rendering**: Canvas rendering is restricted to the active cue. The cue rail renders lightweight metadata items rather than full image canvases.
- **Buffer Reuse**: Merged cues reuse the pixel buffer reference of the initial cue rather than cloning memory.
- **Local Garbage Collection**: Intermediate parsing buffers in the Web Worker are cleared immediately once cue extraction completes.
