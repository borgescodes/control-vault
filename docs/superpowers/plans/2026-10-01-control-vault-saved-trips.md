# Control Vault Saved Trips Implementation Plan

**Spec:** `docs/superpowers/specs/2026-10-01-control-vault-saved-trips-design.md`

## Task 1 - Domain contract and calculation

- Add `SavedTrip` to the vehicle domain types.
- Add pure trip-cost calculation helpers.
- Add tests for outbound-only, distinct return distance, totals, unavailable consumption and unavailable price.
- Do not alter consumption or autonomy calculations.

Verification: focused domain tests, then full suite.

## Task 2 - Local persistence

- Bump IndexedDB schema version.
- Add `saved_trips` object store keyed by client-generated `id`.
- Add list/get/save/update/soft-delete helpers.
- Extend pending-record handling and hydration/merge contracts.
- Visible listing filters soft-deleted rows; sync listing retains them.
- Add migration/persistence tests.

Verification: local-store tests and full suite.

## Task 3 - Supabase schema and sync

- Add versioned `saved_trips` migration with explicit authenticated grants, RLS and owner policies.
- Extend sync mappings, pending push, paginated read and remote merge.
- Add sync tests for create, edit, retry, remote hydration and soft-delete propagation.
- Verify current Supabase docs/changelog before schema work.
- Run security/performance advisors after applying the migration.

Verification: sync tests, provider queries, advisors and full suite.

## Task 4 - Navigation and icon

- Extend History API routing for `/percursos`, `/percursos/novo`, `/percursos/:id` and `/percursos/:id/editar`.
- Add `Percursos` as the center item in bottom navigation.
- Add the official Boxicons Filled `route` SVG path inline to `VehicleIcon`.
- Add navigation/icon tests.

Verification: navigation/UI tests and full suite.

## Task 5 - Saved Trips UI

- Add list, detail and create/edit views.
- List rows show `origin > destination`, summary distance and dynamic approximate cost.
- Detail separates outbound and return and shows combined total when return exists.
- Fetch the existing gasoline price reference through `getFuelPriceReference`; add no provider.
- Create/edit/delete write locally first and trigger existing background sync.
- Add explicit delete confirmation.
- Keep copy short and operational.
- Add responsive styling consistent with the existing Control Vault visual system.

Verification: UI tests at critical states and full suite.

## Task 6 - Integrated verification

- Run complete tests and production build.
- Verify no horizontal overflow at supported mobile widths.
- Verify offline create/edit/delete remain local and pending.
- Verify a second context receives create/edit/delete after synchronization.
- Verify list values update when price/consumption inputs change.
- Perform whole-branch review.
- Do not merge to `main`.
