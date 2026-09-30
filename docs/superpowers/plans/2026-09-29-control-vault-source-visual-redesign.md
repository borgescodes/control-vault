# Control Vault Mobile UX Correction Plan

**Spec:** `docs/superpowers/specs/2026-09-29-control-vault-source-visual-redesign.md`

This plan supersedes the earlier literal Credit Monitor port. Ponytail full applies: remove before adding, use native browser/CSS behavior, and add no dependency.

## Task 1 - Practical inputs and derived metrics

- Add pure digit-based formatters for shifted-cent money and implicit-decimal odometer.
- Cap fuel input at 3000 cents and odometer at 999999.0 km.
- Prefill update/refuel odometer from current state and disable regressive submissions.
- Add selector-derived remaining liters, month spend context, month distance, recent pace, and range days.
- Cover with focused tests.
- No persistence/schema change.

## Task 2 - Distill shell and Home

- Remove Credit Monitor BrandMark and module/status chrome.
- Use sparse basic outline icons only for back, quick actions and bottom navigation.
- Replace Home em-dash placeholders with explicit state copy.
- Remove outer frame and decorative container borders.
- Build Home as one continuous mobile surface.
- Keep typography, palette, tabular numbers, and restrained motion from the approved Credit Monitor subset.
- Put fuel, month spend, month distance, consumption and odometer in clear numeric hierarchy.

## Task 3 - Entry flows and history

- Apply digit masks to setup, odometer and fuel forms.
- Replace full-width Back buttons with a compact back affordance.
- Format suspicious odometer confirmation.
- Consolidate fuel + generated odometer into one history event.
- Group history by local day.
- Keep icons absent unless a basic icon materially improves comprehension.

## Task 4 - Mobile LAN compatibility

- Route generated IDs through a shared UUID helper.
- Prefer `crypto.randomUUID()`; fall back to `crypto.getRandomValues()` for HTTP LAN testing.
- Cover the fallback with a focused unit test.

## Task 5 - Verification

Run:

```bash
npm test
npm run build
git status
```

Then inspect at least:

- 390x844 Home;
- 390x844 Abastecer;
- 390x844 Atualizar KM;
- 390x844 Histórico;
- 1440x1000.

Check money backspace behavior manually, odometer digit shifting, no horizontal overflow, reduced motion, offline save, reconnect sync, and absence of duplicate remote rows.

Do not merge `main`.
