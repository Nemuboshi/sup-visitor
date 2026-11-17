# Supview

A fast, client-side web application for previewing image-based subtitle files directly in your browser.

Supview operates entirely in the browser with zero server dependencies or telemetry. All parsing and rendering execute locally on your device.

## Supported Formats

| Format          | Extension       | Description                                                |
| :-------------- | :-------------- | :--------------------------------------------------------- |
| **Blu-ray PGS** | `.sup`          | High-definition Presentation Graphic Stream subtitle files |
| **VobSub**      | `.idx` + `.sub` | DVD subtitle pair (index metadata + binary packet streams) |

## Key Features

- **100% Private & In-Browser**: Files never leave your local device. Parsing runs entirely inside Web Workers to ensure a responsive UI.
- **Pixel-Exact Cue Merging**: Formally verified logic merges contiguous, identical subtitle frames without visual artifacts while preserving source indexes.
- **Zed-Inspired Design**: Calm, distraction-free editor interface with neutral surfaces, thin borders, and persistent light/dark themes.
- **Keyboard Navigation & Quick Jump**: Navigate cues with `↑` / `↓` arrow keys or press `Ctrl+G` / `Cmd+G` to open the accessible jump dialog (jump by timestamp or cue number).
- **Formally Verified Algorithms**: Core domain rules (cue boundary contiguity and time arithmetic) are formally proven in Lean 4 via [leanfran](https://github.com/conao3/lean-leanfran).

## Tech Stack

- **Framework**: [Svelte 5](https://svelte.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **UI & Primitives**: [Bits UI](https://bits-ui.com/)
- **Bundler & Tooling**: [Vite](https://vitejs.dev/) & [pnpm](https://pnpm.io/)
- **Formal Verification**: [Lean 4](https://lean-lang.org/) (v4.35.0) via `leanfran`
- **Testing**: [Vitest](https://vitest.dev/) (Unit) & [Playwright](https://playwright.dev/) (E2E)

## Getting Started

### Prerequisites

- **Node.js**: v22 or newer
- **pnpm**: v9 or newer
- _(Optional, for formal verification)_: **Lean 4.35.0** and `lake`

### Development

```sh
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Quality & Testing

```sh
# Type check Svelte and TypeScript
pnpm check

# Run unit tests
pnpm test

# Run end-to-end tests
pnpm test:e2e

# Build production bundle
pnpm build

# Check code formatting
pnpm format:check
```

### Formal Verification with Leanfran

The project formally verifies critical mathematical invariants and cue merge rules using Lean 4.

```sh
# Check whether generated Lean modules are synchronized
pnpm lean:status

# Regenerate Lean verification modules
pnpm lean:sync

# Validate formal proofs
pnpm lean:check
```

## Documentation

Comprehensive architecture, design, and product specifications are maintained in [`docs/`](file:///D:/project/supview/docs/README.md):

- [Product Requirements](file:///D:/project/supview/docs/product.md): Goals, supported inputs, and functional behavior.
- [Architecture Guide](file:///D:/project/supview/docs/architecture.md): System layers, parser design, worker boundaries, and data flow.
- [UI Design Guidelines](file:///D:/project/supview/docs/ui.md): Visual hierarchy, theme tokens, dialog design, and accessibility.
- [Lean Verification](file:///D:/project/supview/docs/lean.md): Formal verification setup, proven theorems, and Leanfran workflow.
- [Testing Guide](file:///D:/project/supview/docs/testing.md): Unit testing, browser testing, and quality standards.
