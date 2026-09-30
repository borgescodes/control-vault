# Control Vault Operate Redesign Correction Plan

**Spec:** `docs/superpowers/specs/2026-09-29-control-vault-source-visual-redesign.md`

This plan supersedes the fixed R$ 30 cap and the earlier source-faithful Credit Monitor layout. Execute in order with Superpowers, TDD, Ponytail `full` and Impeccable. Do not change Supabase, migrations, RLS, local-first persistence or synchronization.

## Task 1 - Dynamic refuel limit

- Add RED tests for the pure 3 L + 1 L margin formula at R$ 7,00, R$ 7,05 and R$ 8,20 per liter, rounding the reference to the displayed BRL cent before multiplication.
- Reuse the existing weekly fuel-price client/cache; its production API is implemented by the separate approved fuel-price integration plan.
- Share the smallest pure helper between the refuel form and `recordFuel`.
- Keep the last valid shifted-cent value only when the next digit exceeds the structural R$ 99,99 mask limit; the dynamic fuel ceiling controls Save eligibility, not typing.
- Revalidate the limit in the action before persistence.
- When `getFuelPriceReference()` returns `null`, apply no dynamic monetary ceiling and preserve offline recording.
- Verify focused tests, the full suite and the production build; commit the task.

## Task 2 - Odometer and UUID regression hardening

- Add or adjust RED tests for current 12345.6 with 12345.5 rejected in the UI, 12345.6 and 12345.7 accepted, 999999.0 accepted and 999999.1 rejected.
- Keep the current odometer prefilled and prevent a regressive save in the UI while retaining atomic action/store validation.
- Reproduce missing `crypto.randomUUID` and verify the UUID v4 fallback uses `crypto.getRandomValues`, never `Math.random` or a dependency.
- Verify fuel and odometer record creation share the fallback path; commit the task.

## Task 3 - Impeccable audit and visual contract

- Inspect the running Home, fuel, odometer, history and login surfaces at representative phone and desktop sizes.
- Critique hierarchy, density, thumb reach, affordance, legibility, element excess or absence and mobile adaptation in `Operate` mode.
- Record the replacement visual world in `DESIGN.md`: dark fantasy + sci-fi + personal vehicle instrument, near-black depth, restrained technical cyan, sparse outline icons, straight geometry and purposeful motion.
- Treat the incumbent UI as evidence and anti-reference, not as layout authority; commit the audit/design contract.

## Task 4 - Complete interface redesign

- Rebuild Home around autonomy as the hero, physical fuel presence and an editorial monthly telemetry block without eight cards.
- Make `Abastecer` primary and `Atualizar KM` secondary with thumb-friendly, non-identical actions.
- Redesign fuel and odometer forms for fast one-handed use, including a discreet dynamic-limit hint and accessible full-tank checkbox.
- Redesign history as a local-date-grouped evidence log with no per-row icons or duplicated fuel odometer event.
- Redesign login in the same atmosphere without a central SaaS box or Credit Monitor branding.
- Use only sparse inline outline SVGs already present or minimally extended; add no UI, icon or motion dependency.
- Preserve short motion, 880ms progress motion, count-up where useful and reduced-motion behavior.
- Verify focused UI tests, full suite and build; commit the task.

## Task 5 - Bounded visual verification and fixes

- Run one batched inspection at 390x844 for Home calibrating, Home ready, fuel, odometer, history and login, plus 430x932 and 1440x1000 representative views and a 320px overflow check.
- Check safe areas, touch targets, keyboard-safe CTA placement, first-viewport density, outline-icon consistency, no outer frame, no Credit Monitor logo, no em-dash placeholder and no rounded rectangle.
- Run the Impeccable detector once over changed UI targets.
- Fix all verified problems in one batch and perform at most one confirmation pass.
- Commit the visual fixes.

## Task 6 - Final functional verification

- Run `npm test`, `npm run build` and `git status`.
- Serve `npx vite --host 0.0.0.0 --port 5176` for LAN verification.
- Verify login, odometer regression, shifted cents/backspace, dynamic ceiling, full-tank save, UUID fallback, offline local save, reconnect sync and no history or sync duplication where the environment permits.
- Use Superpowers verification-before-completion and perform one fresh whole-branch review.
- Do not merge `main`.
