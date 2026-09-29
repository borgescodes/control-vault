# Control Vault - Source-faithful Visual Redesign

Date: 2026-09-29
Status: Approved by explicit user brief
Branch: `codex/foundation-task-1`

## 1. Purpose

Port the real extension design system from `C:\Users\pedro.borges\vault\lovable-credit-monitor` into the existing Control Vault React application without changing product behavior, local-first persistence, authentication, synchronization or provider schema.

This is a source-to-source port. It is not an Alethe interpretation, a generic dark dashboard or a new design direction.

## 2. Source authority

Reference commit:

`05f9af1ea225ad69ae1b5fe0c2914870fd39b402`

Required source files and audited SHA-256 fingerprints:

| Source | SHA-256 | Authority |
| --- | --- | --- |
| `DESIGN.md` | `2C86171F40FD4A7F5B715E8C2525B78969A7B37FBDF40A09F48468A1056DAC67` | Named visual rules and palette context |
| `src/panel.css` | `1DEE225D143B3881541184ABE65DB7EB14B60C8FE36AA8D97309CF684C3C1589` | Runtime tokens, density, typography, states and motion |
| `src/icons.js` | `572F5F92C6A5E5A4FAAA3B5C803BE3859AA362DBE0A2F971E52C9019ED130A34` | Exact SVG paths |
| `src/content.js` | `4FD244E846293B17FEA0468E5CA2F5D1FDB8516701213FD6361ECD5E05AB42A6` | Runtime composition and animation helpers |
| `src/brand.js` | `6845D28AC77F82D70CE88082FEE774197C1099F3FBFA3779B2D88CB05F793143` | Exact brand SVG paths and `0 0 750 600` viewBox |
| `EXTENSION_README.md` | `E467E41C9BE0997D50F3D06D03A83CCF227806D9738A2E83AC2DB7763A0E8CFD` | Interaction and motion behavior |

The reference repository is read-only. No redesign code, commits or generated artifacts belong there.

## 3. Product behavior boundary

The redesign preserves:

- the current React component flows;
- all vehicle v2 calculations and display semantics;
- IndexedDB schemas and migration behavior;
- immutable fuel-price snapshots;
- Supabase Auth and sync mappings;
- offline writes and pending records;
- existing Portuguese copy unless a structural label is required;
- the lack of a router or state-management library.

The redesign must not:

- modify Supabase schema or RLS;
- create migrations;
- add provider work;
- introduce a second theme/palette selector;
- add new product modules or navigation destinations;
- modify `.env` or commit credentials.

## 4. Exact runtime tokens

The dark extension runtime in `src/panel.css` is the primary token source:

```css
--lcm-bg: rgba(10, 15, 23, 0.96);
--lcm-bg-2: #101927;
--lcm-card: rgba(21, 31, 45, 0.82);
--lcm-overlay: rgba(255, 255, 255, 0.045);
--lcm-overlay-hover: rgba(255, 255, 255, 0.075);
--lcm-fg: #f7faff;
--lcm-muted: #9dacc0;
--lcm-faint: #6f7f94;
--lcm-border: #2b3b51;
--lcm-track: #1c2a3c;
--lcm-accent: #27ceff;
--lcm-accent-2: #4773ff;
--lcm-progress-end: #91ebff;
--lcm-progress-gradient: linear-gradient(90deg, #4773ff 0%, #27ceff 62%, #91ebff 100%);
--lcm-primary-bg: #22c8ff;
--lcm-primary-fg: #051219;
--lcm-focus: #72e7ff;
--lcm-shadow: rgba(0, 0, 0, 0.45);
--lcm-success: #38d996;
--lcm-warning: #f5b95d;
```

The application canvas uses the documented instrument black `#06090d`; runtime surfaces use the values above. Cyan remains scarce: active telemetry, progress, selection, focus and primary actions. Green is only healthy confirmation. Warning amber indicates estimated/stale attention. Faint blue-gray indicates unavailable state.

## 5. Typography and numbers

The principal Control Vault stack is copied exactly from `src/panel.css`:

```css
font-family:
  "SFMono-Regular",
  "Cascadia Code",
  "Roboto Mono",
  Menlo,
  Monaco,
  Consolas,
  "Liberation Mono",
  monospace;
```

All measurement, financial and status numerals use `font-variant-numeric: tabular-nums`. The port preserves the extension's compact weights and tracking, including strong readings at weights `780–840` and negative tracking down to `-0.075em` where copied from the main metric.

## 6. Shape exception

Every rectangular Control Vault surface uses:

```css
border-radius: 0;
```

This applies to buttons, inputs, cards, panels, navigation, action rows, confirmations and metric containers. Circular status dots, progress endpoints, check indicators and other semantically circular geometry remain circular.

No extension radius may leak into rectangular Control Vault UI.

## 7. Iconography and brand geometry

SVGs are copied as React-rendered inline SVG with the original `viewBox`, path `d`, fill rules and clip rules. Do not substitute an icon library or redraw a matching glyph.

Planned source icons:

- `bxs-refresh-cw-dot`: synchronization/loading semantics;
- `bxs-layer`: primary/home module navigation;
- `bxs-check-circle`: calibrated/full/confirmed state;
- `bxs-time-five`: history and time semantics;
- `bxs-cog`: setup/configuration context when needed.

The Control Vault brand mark reuses the three exact paths from `src/brand.js` with viewBox `0 0 750 600`. Only surrounding product text changes.

## 8. Density and composition

Adaptation is structural only:

- retain the extension's compact 8–15px internal spacing and fine 1px evidence lines;
- present the app as one centered instrument surface rather than a set of generic cards;
- use one main telemetry area for autonomy and fuel progress;
- use divided evidence rows for consumption, odometer and monthly spend;
- keep primary actions at a minimum 44px target;
- style login, setup, odometer, fuel and history as members of the same instrument system;
- avoid helper paragraphs, decorative cards, generic dashboard charts, gradients unrelated to the copied progress treatment and automotive decoration.

Mobile may stack rows or reduce outer gutters. Desktop may center and bound the instrument. Those are layout adaptations, not new aesthetics.

## 9. Motion contract

Copy these timing constants from `src/content.js`:

```text
ENTRY_ANIMATION_MS = 720
COUNT_UP_MS = 880
```

Metric count-up uses `requestAnimationFrame` and the exact easing:

```js
1 - Math.pow(1 - raw, 3)
```

Fuel progress uses:

```css
transition: width 880ms cubic-bezier(.16,1,.3,1);
```

View entry preserves:

```css
@keyframes lcm-view-in {
  from { opacity: 0; transform: translateY(7px) scale(.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes lcm-piece-in {
  from { opacity: 0; transform: translateY(6px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

Use the original stagger timings where the same hierarchy exists: `340–400ms cubic-bezier(.16,1,.3,1)` with `20ms`, `70ms`, `120ms`, `170ms` and `220ms` delays. Do not add blur.

## 10. Interaction states

The port preserves:

- icon/control hover: `160ms ease`, brighter text, tinted overlay, 1px inset evidence and `translateY(-1px)`;
- active press: `scale(.94)` for compact icon controls;
- primary/large active press: short physical displacement without changing product state;
- disabled: unavailable cursor/state and reduced opacity;
- focus: `2px solid var(--lcm-focus)` with `2px` offset;
- status dots: success/live green, warning/stale amber, syncing cyan and unavailable faint;
- progress shimmer only on the real progress bar;
- visible browser selection and caret colors derived from the copied palette.

## 11. Reduced motion

Copy the extension behavior:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

The JavaScript metric helper must also bypass `requestAnimationFrame` count-up and render the final value immediately when reduced motion is active.

## 12. Accessibility and responsive behavior

- Preserve semantic headings, form labels, alerts, `aria-current`, `aria-busy` and native inputs.
- Icon-only controls require accessible labels.
- No horizontal overflow at 320px.
- Main telemetry remains readable without zoom.
- Primary actions remain reachable as a compact two-column row when width permits and stack only when necessary.
- Touch targets remain at least 44px except noninteractive status dots.

## 13. Verification

Completion requires:

- unit/component tests for the copied SVG geometry, count-up/reduced-motion behavior and critical view semantics;
- full `npm test` and `npm run build`;
- desktop and mobile render inspection;
- one Impeccable detector pass over changed UI targets;
- a source-to-source report listing copied tokens, SVGs, keyframes, easing/timing, interaction states, structural adaptations and every source element not reused with its reason.
