# Control Vault Source-faithful Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the real `lovable-credit-monitor` extension design system into every existing Control Vault surface without changing the validated vehicle, persistence, authentication or synchronization behavior.

**Architecture:** Keep the current React component and local-first data flow intact. Add only small shared visual primitives for exact source SVGs and metric motion, then restyle the existing shell and views with one global CSS system copied from the extension. Verification is component-level plus full-suite/build and bounded desktop/mobile inspection.

**Tech Stack:** React, TypeScript, Vite, Vitest, jsdom, plain CSS, native SVG and `requestAnimationFrame`.

**Spec:** `docs/superpowers/specs/2026-09-29-control-vault-source-visual-redesign.md`

## Global Constraints

- Work only in the existing `codex/foundation-task-1` worktree.
- Do not merge to `main`.
- Treat `C:\Users\pedro.borges\vault\lovable-credit-monitor` as read-only source authority at commit `05f9af1ea225ad69ae1b5fe0c2914870fd39b402`.
- Do not modify Supabase schema, migrations, RLS, provider configuration, IndexedDB schema, domain calculations or sync mappings.
- Do not modify or commit `.env`.
- Copy source values literally when the same visual behavior exists.
- Use the exact extension monospace font stack as the principal Control Vault stack.
- Set `border-radius: 0` on every rectangular surface; retain circles only for semantic circular elements.
- Keep existing Portuguese product copy and React callbacks unless the task explicitly adds an accessibility label.
- Use native CSS, SVG and browser animation APIs; add no dependency.
- Preserve keyboard focus, native form behavior, alert roles, `aria-current`, `aria-busy` and reduced-motion behavior.
- Keep Ponytail `full` active and make one meaningful commit per task.

## Review Focus

- At 320px width, long calibration/awaiting labels must not cause horizontal overflow or cover actions.
- Under `prefers-reduced-motion: reduce`, metric count-up must render the final value immediately and CSS animation must be disabled.
- A metric value update after local refresh must animate once without restarting indefinitely on unrelated renders.
- Loading, unavailable, error, estimated and calibrated states must use the source status grammar without relying on color alone.
- Every rectangular interactive/container surface must remain square while status dots and progress endpoints remain circular.

---

### Task 1: Source visual primitives and token foundation

**Files:**
- Create: `src/shared/ui/Icon.tsx`
- Create: `src/shared/ui/BrandMark.tsx`
- Create: `src/shared/ui/sourceGeometry.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Produces: `type IconName = 'refresh' | 'layer' | 'check' | 'time' | 'cog'`.
- Produces: `Icon({ name, className? }): JSX.Element` with source `viewBox="0 0 24 24"` and exact paths.
- Produces: `BrandMark({ className? }): JSX.Element` with source `viewBox="0 0 750 600"` and three exact paths.
- Produces global `--lcm-*` variables copied from the source and square base controls/surfaces.

- [ ] **Step 1: Write failing source-geometry tests**

Assert that server-rendered icons contain the exact audited path strings for `bxs-refresh-cw-dot`, `bxs-layer`, `bxs-check-circle`, `bxs-time-five` and `bxs-cog`; assert that `BrandMark` contains the original viewBox and three paths from `src/brand.js`.

- [ ] **Step 2: Run the source-geometry test and confirm RED**

Run: `npm test -- src/shared/ui/sourceGeometry.test.tsx`

Expected: FAIL because the shared source geometry components do not exist.

- [ ] **Step 3: Implement exact inline SVG components**

Copy paths verbatim. Use `aria-hidden="true"`, `focusable="false"` and `fill="currentColor"` behavior. Do not add an icon dependency or redraw geometry.

- [ ] **Step 4: Replace the global token/reset foundation**

Copy the dark runtime tokens from `src/panel.css`, use `#06090d` for the canvas, install the exact principal font stack, tabular numerals, selection/caret/focus styling and `border-radius: 0` for rectangular elements. Preserve only layout rules still needed by later tasks.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- src/shared/ui/sourceGeometry.test.tsx
npm run build
git add src/shared/ui src/styles/global.css
git commit -m "feat: port Credit Monitor visual primitives"
```

Expected: source-geometry tests PASS and build exits 0.

### Task 2: Metric count-up and progress motion

**Files:**
- Create: `src/shared/ui/AnimatedMetric.tsx`
- Create: `src/shared/ui/AnimatedMetric.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: Task 1 typography/tokens.
- Produces: `AnimatedMetric({ value, format, className?, reducedMotion? }): JSX.Element`.
- Produces exact 880ms count-up using `1 - Math.pow(1 - raw, 3)` and native `requestAnimationFrame`.
- Produces `.lcm-progress` width transition `880ms cubic-bezier(.16,1,.3,1)` and copied progress sweep.

- [ ] **Step 1: Write failing motion tests**

Assert that a numeric metric begins at zero and ends at the requested value after the 880ms animation; changing the value starts one new count-up; `reducedMotion=true` renders the final formatted value immediately without scheduling a frame.

- [ ] **Step 2: Run the motion test and confirm RED**

Run: `npm test -- src/shared/ui/AnimatedMetric.test.tsx`

Expected: FAIL because `AnimatedMetric` does not exist.

- [ ] **Step 3: Port the smallest React metric helper**

Port the `content.js` `performance.now()`/`requestAnimationFrame` loop and exact cubic easing. Cancel the outstanding frame during cleanup. Default reduced motion from `matchMedia('(prefers-reduced-motion: reduce)')`.

- [ ] **Step 4: Port progress motion CSS**

Copy the exact width transition, gradient, endpoint glow and `lcm-sweep` keyframe. Keep the rectangular track square; only the endpoint glow remains circular.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- src/shared/ui/AnimatedMetric.test.tsx
npm run build
git add src/shared/ui src/styles/global.css
git commit -m "feat: port Credit Monitor metric motion"
```

Expected: motion tests PASS and build exits 0.

### Task 3: Application shell and authentication surface

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/LoginView.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: Task 1 `BrandMark`, `Icon` and tokens.
- Preserves: auth subscription, cached session, online sync trigger and sign-out behavior.
- Produces: one square instrument shell/header and a styled login surface.

- [ ] **Step 1: Write failing shell tests**

Assert semantic markup for the brand mark, product title, session action and login panel; assert no sign-up/reset/social controls appear. Retain the existing hydration test.

- [ ] **Step 2: Run focused App tests and confirm RED**

Run: `npm test -- src/app/App.test.tsx`

Expected: new shell assertions FAIL against the current generic markup.

- [ ] **Step 3: Implement the source-family shell**

Compose the existing app with the exact brand geometry, compact header density and evidence-line framing. Keep callbacks and effects unchanged. Style the login form using copied surface, label, input, primary action, disabled, error and focus rules.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm test -- src/app/App.test.tsx
npm run build
git add src/app src/styles/global.css
git commit -m "feat: redesign Control Vault shell"
```

Expected: App tests PASS and build exits 0.

### Task 4: Home telemetry dashboard

**Files:**
- Modify: `src/modules/vehicle/HomeView.tsx`
- Modify: `src/modules/vehicle/vehicleViews.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: existing `VehicleDashboard`, Task 1 icons/tokens and Task 2 `AnimatedMetric`.
- Preserves: range/calibration/consumption/odometer/spend semantics and callbacks.
- Produces: source-family autonomy instrument, fuel progress, divided metric rail, action row and navigation.

- [ ] **Step 1: Write failing Home structure/state tests**

Assert the ready state renders animated range, percent progress with `aria-valuenow`, copied status-dot state, consumption/odometer/spend rail and exact icon names; assert awaiting/calibrating states omit false progress and retain their distinct labels.

- [ ] **Step 2: Run view tests and confirm RED**

Run: `npm test -- src/modules/vehicle/vehicleViews.test.tsx`

Expected: new dashboard structure assertions FAIL.

- [ ] **Step 3: Implement the home instrument**

Use one telemetry surface, a real fuel-progress bar, evidence dividers and exact status grammar. Apply count-up only to available numeric metrics. Keep approximation marks and safety-factor results unchanged.

- [ ] **Step 4: Port entry choreography**

Apply exact `lcm-view-in` and `lcm-piece-in` keyframes and source stagger timings to the corresponding home regions. Do not use blur or invent additional motion.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- src/modules/vehicle/vehicleViews.test.tsx
npm run build
git add src/modules/vehicle/HomeView.tsx src/modules/vehicle/vehicleViews.test.tsx src/styles/global.css
git commit -m "feat: redesign vehicle telemetry home"
```

Expected: view tests PASS and build exits 0.

### Task 5: Setup surface

**Files:**
- Modify: `src/modules/vehicle/SetupView.tsx`
- Modify: `src/modules/vehicle/vehicleViews.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Preserves: `initializeVehicle(initialOdometerKm, fullTank, now)` and optional full-tank setup behavior.
- Produces: compact setup instrument using source form/control grammar.

- [ ] **Step 1: Write failing setup presentation tests**

Assert the setup heading/context, numeric input semantics, optional `Tanque cheio agora`, primary action, alert and busy/disabled state remain present in the source-family structure.

- [ ] **Step 2: Run view tests and confirm RED**

Run: `npm test -- src/modules/vehicle/vehicleViews.test.tsx`

Expected: new setup presentation assertions FAIL.

- [ ] **Step 3: Implement the setup presentation**

Add only semantic wrappers/classes and exact source-family controls. Keep action invocation, validation and error handling unchanged.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm test -- src/modules/vehicle/vehicleViews.test.tsx
npm run build
git add src/modules/vehicle/SetupView.tsx src/modules/vehicle/vehicleViews.test.tsx src/styles/global.css
git commit -m "feat: redesign vehicle setup"
```

Expected: view tests PASS and build exits 0.

### Task 6: Odometer and fuel action surfaces

**Files:**
- Modify: `src/modules/vehicle/OdometerView.tsx`
- Modify: `src/modules/vehicle/FuelView.tsx`
- Modify: `src/modules/vehicle/vehicleViews.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Preserves: existing `recordOdometer`, `recordFuel`, suspicious-jump confirmation and local success callbacks.
- Produces: shared square action-panel, confirmation-row and secondary back-control patterns.

- [ ] **Step 1: Write failing action-surface tests**

Assert headings, native inputs, submit/back controls, error alerts and suspicious-jump confirmation expose consistent classes/semantics; retain the existing test proving liters input stays absent.

- [ ] **Step 2: Run view tests and confirm RED**

Run: `npm test -- src/modules/vehicle/vehicleViews.test.tsx`

Expected: new action-surface assertions FAIL.

- [ ] **Step 3: Implement both action surfaces**

Use the same source control density and states for both flows. Keep all data and action code unchanged. Apply source icon hover/active rules only where icons are actually rendered.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm test -- src/modules/vehicle/vehicleViews.test.tsx
npm test -- src/modules/vehicle/vehicleActions.test.ts
npm run build
git add src/modules/vehicle/OdometerView.tsx src/modules/vehicle/FuelView.tsx src/modules/vehicle/vehicleViews.test.tsx src/styles/global.css
git commit -m "feat: redesign vehicle entry flows"
```

Expected: view/action tests PASS and build exits 0.

### Task 7: History evidence rail

**Files:**
- Modify: `src/modules/vehicle/HistoryView.tsx`
- Modify: `src/modules/vehicle/vehicleViews.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Preserves: combined reverse-chronological odometer/fuel history and immutable display data.
- Produces: divided evidence rows using exact source icon geometry and compact tabular metadata.

- [ ] **Step 1: Write failing history tests**

Assert empty and populated history states, reverse chronology, fuel/odometer labels, source time/check icon geometry and back control. Do not add edit/delete actions.

- [ ] **Step 2: Run view tests and confirm RED**

Run: `npm test -- src/modules/vehicle/vehicleViews.test.tsx`

Expected: new history structure assertions FAIL.

- [ ] **Step 3: Implement the history rail**

Render each record as a square divided evidence row with compact icon, value and tabular timestamp. Add the short empty state only when the combined list is empty.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm test -- src/modules/vehicle/vehicleViews.test.tsx
npm run build
git add src/modules/vehicle/HistoryView.tsx src/modules/vehicle/vehicleViews.test.tsx src/styles/global.css
git commit -m "feat: redesign vehicle history"
```

Expected: view tests PASS and build exits 0.

### Task 8: Integrated states, responsiveness and PWA chrome

**Files:**
- Modify: `src/modules/vehicle/VehicleModule.tsx`
- Modify: `src/modules/vehicle/vehicleViews.test.tsx`
- Modify: `src/styles/global.css`
- Modify: `vite.config.ts`

**Interfaces:**
- Preserves: module load/error/view switching and PWA caching behavior.
- Produces: source status grammar for loading/error/unavailable states, 320px-safe responsive layout and PWA colors matching the copied canvas.

- [ ] **Step 1: Write failing integrated-state tests**

Assert loading remains `aria-busy`, errors remain alerts, active navigation remains discoverable, and no visual wrapper changes view callbacks or displayed data.

- [ ] **Step 2: Run view/App tests and confirm RED**

Run:

```bash
npm test -- src/modules/vehicle/vehicleViews.test.tsx
npm test -- src/app/App.test.tsx
```

Expected: new integrated-state assertions FAIL.

- [ ] **Step 3: Implement status and responsive rules**

Apply the source dots/labels, square loading surface, copied focus/disabled states, 320px overflow guards and compact desktop bound. Copy the exact reduced-motion CSS with `0.001ms` and ensure the PWA theme/background use `#06090d`.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm test
npm run build
git add src/modules/vehicle/VehicleModule.tsx src/modules/vehicle/vehicleViews.test.tsx src/styles/global.css vite.config.ts
git commit -m "feat: complete responsive instrument states"
```

Expected: all tests PASS and build exits 0.

### Task 9: Source comparison, visual inspection and final verification

**Files:**
- Create: `docs/design/control-vault-source-comparison.md`
- Create after verification: `DESIGN.md`
- Create after verification: `.impeccable/design.json`
- Create ignored evidence: `.impeccable/review/desktop.png`
- Create ignored evidence: `.impeccable/review/mobile.png`

**Interfaces:**
- Consumes: Tasks 1–8 completed UI.
- Produces: durable design documentation and the required source-to-source comparison report.

- [ ] **Step 1: Run the complete automated verification**

Run:

```bash
npm ci
npm test
npm run build
```

Expected: all 144 baseline tests plus redesign tests PASS and build exits 0.

- [ ] **Step 2: Inspect desktop and mobile in one bounded pass**

Capture a representative authenticated app state at 1440px and 390px widths. Verify no horizontal overflow, valid focus/hover/active states, square rectangular surfaces, readable telemetry, exact status grammar and settled entry motion.

- [ ] **Step 3: Run the Impeccable detector once**

Run the detector over the changed React/CSS targets. Fix only mechanical findings in one batch, then run one final screenshot confirmation. Do not run a second detector.

- [ ] **Step 4: Write the explicit source comparison**

List:

- copied tokens with source file/selector;
- copied SVGs and path names;
- copied keyframes;
- copied easing and timing values;
- copied hover/active/focus/disabled/status patterns;
- mobile/domain-only structural adaptations;
- source elements not reused and why.

- [ ] **Step 5: Document the finished design system**

Record the actual shipped tokens/components in `DESIGN.md` and `.impeccable/design.json`. Documentation must match code, including the square-surface exception.

- [ ] **Step 6: Final verification and commit**

Run:

```bash
npm test
npm run build
git status --short
git add docs/design DESIGN.md .impeccable/design.json
git commit -m "docs: verify source-faithful visual redesign"
```

Expected: tests/build PASS; only intended tracked documentation is staged; `main`, Supabase, migrations, `.env` and the reference repository remain unchanged.
