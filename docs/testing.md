# Testing & Verification Strategy

## Overview

Supview maintains a multi-tiered verification pipeline to ensure correctness across binary parsing, state transformations, user interactions, and formal proofs.

```text
┌────────────────────────────────────────────────────────┐
│ Verification Layers                                    │
├────────────────────────────────────────────────────────┤
│ 1. Formal Proofs:     Lean 4 / leanfran                │
│ 2. Unit Tests:        Vitest                           │
│ 3. Type Checking:     Svelte-check + TypeScript        │
│ 4. End-to-End Tests:  Playwright                       │
│ 5. Code Style:        Prettier                         │
└────────────────────────────────────────────────────────┘
```

## Test Suites

### 1. Unit Tests (`pnpm test`)

Unit tests are managed via **Vitest** (`tests/*.test.ts`) and execute rapidly in Node:

- **Parser Validation (`tests/supParser.test.ts`)**:
  - Valid and malformed Presentation Graphic Stream packets.
  - Multi-segment objects, palette updates, and timestamp calculations.
  - RLE byte sequence decoding into RGBA buffers.
- **Merge Engine (`tests/mergeAdjacentCues.test.ts`)**:
  - Exact contiguous timestamp matching.
  - Time gaps, overlaps, and single-pixel differences.
  - Multi-frame merge chains and empty/single cue lists.
- **Jump Mechanics (`tests/jump.test.ts`)**:
  - Timestamp formatting and reverse parsing.
  - Interval containment search and boundary clamping.

### 2. End-to-End Tests (`pnpm test:e2e`)

Browser integration tests use **Playwright** (`tests/e2e/app.spec.ts`) against the bundled Chromium browser:

- Initial empty state rendering and accessible ARIA attributes.
- Theme switching (dark/light) and persistent `localStorage` preservation.
- Keyboard shortcuts and Bits UI Jump Dialog interaction (both time mode and cue mode).
- Real Web Worker file parsing and canvas rendering using synthetic SUP streams.

To install browser binaries if running in a new environment:

```sh
pnpm exec playwright install chromium
```

### 3. Type Safety (`pnpm check`)

Runs `svelte-check` across Svelte 5 components and `tsc` across Node / config targets in strict mode.

```sh
pnpm check
```

### 4. Formal Verification (`pnpm lean:status`)

Verifies that compiled Lean modules in `_lean/` directories accurately reflect the source Lean blocks.

```sh
pnpm lean:status
```

## Standard Verification Pipeline

Before committing features or declaring tasks complete, run the verification scripts:

```sh
# 1. Check code formatting
pnpm format:check

# 2. Type check
pnpm check

# 3. Unit test suite
pnpm test

# 4. E2E browser suite
pnpm test:e2e

# 5. Production build
pnpm build

# 6. Lean synchronization check
pnpm lean:status
```

## Performance & Memory Checks

- Ensure large subtitle files (< 100 MB) parse without freezing the UI thread.
- Verify that cue rail rendering remains smooth with hundreds of cues.
- Confirm that Web Worker buffers are released after parsing completes.
