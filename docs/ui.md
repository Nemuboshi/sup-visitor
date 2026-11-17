# User Interface & Design System

## Design Philosophy

Supview follows a **Zed-inspired visual aesthetic**: a calm, typography-first, distraction-free editor interface with flat surfaces, subtle borders, and semantic color tokens.

### Visual Foundations

- **Surfaces**: Neutral black, charcoal, warm gray, and off-white tones.
- **Accent**: A restrained brick-red accent (`--accent`) reserved for primary action triggers and active selections.
- **Geometry**:
  - Control radius: `4px` (`--radius-control`)
  - Panel & card radius: `6px` to `8px` (`--radius-panel`)
  - Pill radius: reserved solely for status tags and merge count badges.
- **Borders & Shadows**:
  - Rely on `1px` subtle borders (`--border-subtle`, `--border-strong`) for visual structure.
  - Box shadows are limited strictly to elevated floating surfaces (such as the jump dialog).

### Typography Hierarchy

All typography relies on modern system font stacks:

- **Interface Text**: High-legibility system sans-serif (`system-ui, -apple-system, sans-serif`).
- **Heading Accents**: Controlled system serif fallback where structural hierarchy benefits from editorial warmth.
- **Technical Data**: System monospace (`ui-monospace, monospace`) for timestamps, cue numbers, file sizes, and keyboard shortcuts.

## Theme Architecture

The system supports two synchronized themes managed by `src/lib/theme/theme.ts`:

- **Dark Theme (Default)**: Charcoal canvas, slightly elevated panels, warm white text, low-contrast borders, and controlled brick-red accents.
- **Light Theme**: Warm off-white canvas, crisp white panels, deep charcoal text, light gray borders, and vibrant brick-red accents.

### Theme Mechanics

- Sets `data-theme="light|dark"` on the root `<html>` element.
- Automatically initializes from `localStorage`, falling back to the OS `prefers-color-scheme` query.
- Eliminates theme flickering via early inline attribute resolution.
- All styles consume CSS custom properties declared in `src/lib/theme/theme.css`.

## Desktop Layout Structure

The main interface is divided into four distinct regions:

```text
┌────────────────────────────────────────────────────────┐
│ Top Toolbar: Brand | Theme Toggle | Jump Key | Open    │
├──────────────┬─────────────────────────────────────────┤
│ Cue Rail     │ Preview Area                            │
│              │ ┌─────────────────────────────────────┐ │
│ • Cue 01     │ │ Active Subtitle Image               │ │
│ • Cue 02 2×  │ │ (Rendered on checkerboard canvas)   │ │
│ • Cue 03     │ └─────────────────────────────────────┘ │
│ (Independently│ Metadata: Resolution | Timing | Frames │
│  scrollable) │                                         │
├──────────────┴─────────────────────────────────────────┤
│ Status Bar: File status | Format | Filename | Cues     │
└────────────────────────────────────────────────────────┘
```

1. **Top Toolbar**: Displays application branding, theme switcher, keyboard shortcut hint, and primary file opening trigger.
2. **Cue Navigation Rail**:
   - Scrollable sidebar showing the chronological cue sequence.
   - Each item displays the padded cue number, start/end timestamps, and source merge multipliers (`2×`, etc.).
   - Automatically scrolls the active cue into visible range during keyboard browsing and jump operations.
3. **Subtitle Preview Area**:
   - Primary viewport rendering decoded RGBA frames on an optical checkerboard canvas.
   - Displays cue header details, quick navigation buttons (`↑`/`↓`), frame resolution, and millisecond time spans.
4. **Bottom Status Bar**:
   - Unified status readout displaying current parsing state, error diagnostics, active format, file name, and total duration.

## Jump Dialog (`Ctrl+G` / `Cmd+G`)

The jump dialog is an accessible modal component built using **Bits UI** primitives:

- **Activation**: Triggered by `Ctrl+G` (or `Cmd+G` on macOS) or the toolbar button.
- **Dual Mode Radio**:
  - **Time Mode**: Smart, flexible timestamp input supporting multiple standard formats (e.g. `00:01:23.500`, `12:34`, or pure seconds like `85s`), complete with real-time target preview, seamless paste handling, and quick-fill presets.
  - **Cue Number Mode**: Numeric input field accepting 1-based cue indexes.
- **Keyboard Handling**:
  - `Enter` submits the jump and closes the modal.
  - `Escape` dismisses the dialog and returns focus to the initiating element.

## Accessibility Standards

- **Semantic HTML**: Interactive elements use genuine `<button>`, `<input>`, or Bits UI accessible headless wrappers.
- **Focus Rings**: Highly visible, dual-theme keyboard focus indicators (`--focus-ring`).
- **Screen Reader Support**: Appropriate ARIA roles (`role="dialog"`, `role="listbox"`, `aria-selected`, `aria-busy`) throughout the application.
- **Non-color Signals**: Active and selected states combine surface contrast and layout indicators so information is never conveyed by color alone.
