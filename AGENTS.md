# Agent Guidelines for Supview

Supview is a client-side static web application for previewing Blu-ray PGS (`.sup`) and VobSub (`.idx` + `.sub`) subtitle files.

## Core Principles & Boundaries

- **100% Client-side**: All parsing and rendering happen locally in the browser. Never introduce a server, cloud upload, analytics, or remote backend dependency.
- **Modern Web Stack**: Svelte 5, TypeScript (strict), Vite, and pnpm.
- **Non-blocking Worker Architecture**: All binary parsing and image decoding execute inside a Web Worker (`src/lib/worker/parser.worker.ts`) to keep the UI smooth and responsive.
- **Formal Verification (Leanfran)**: Pure, critical domain algorithms (exact cue merge rules and jump time arithmetic) are formally verified using Lean 4 via `leanfran`. Never bypass or break Lean verification invariants.
- **UI Abstraction**: Use the project UI component layer (`src/lib/ui`, built on Bits UI) instead of direct raw HTML controls. Style with semantic design tokens defined in `src/lib/theme/theme.css`.

## Documentation Hub (Single Source of Truth)

Detailed specifications and architectural decisions live in `docs/`:

- [docs/product.md](file:///D:/project/supview/docs/product.md): Product scope, supported file formats, cue merge rules, and jump navigation specifications.
- [docs/architecture.md](file:///D:/project/supview/docs/architecture.md): Application layering, parser design, Web Worker messaging contracts, and data flow.
- [docs/ui.md](file:///D:/project/supview/docs/ui.md): Zed-inspired design system, theme tokens, component layout, and accessibility standards.
- [docs/lean.md](file:///D:/project/supview/docs/lean.md): Lean 4 verification workflow, synchronization (`pnpm lean:sync`), and proof management.
- [docs/testing.md](file:///D:/project/supview/docs/testing.md): Unit tests (Vitest), end-to-end tests (Playwright), and quality verification commands.

## Code Standards

- **Strict TypeScript**: Avoid `any` unless strictly required by an external API (document the reason if used).
- **Decoupled Layers**: Keep parsers completely independent of Svelte components and the DOM.
- **Accessibility (a11y)**: Every interactive element must have an accessible name, visible focus indicators in both light and dark themes, and support keyboard navigation.
- **Deterministic Pure Logic**: Core calculations (such as `mergeAdjacentCues` and `findCueIndex`) must remain pure, side-effect-free functions covered by unit tests.

## Verification Checklist

Before completing any task, ensure the following checks pass:

```sh
pnpm check           # Type check with svelte-check and tsc
pnpm test            # Run Vitest unit tests
pnpm test:e2e        # Run Playwright end-to-end tests
pnpm format:check    # Check Prettier formatting
pnpm lean:status     # Verify Lean blocks remain fresh and synchronized
```
