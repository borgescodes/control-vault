# Control Vault - Data Corrections and Analytics Design

Date: 2026-10-04  
Status: Approved  
Repository: borgescodes/control-vault  
Branch: `feat/data-corrections-analytics`

## 1. Purpose

This design defines the approved next cycle for Control Vault after the current vehicle MVP.

The goal is to improve data correctness first, then derive better confidence, consumption and operating-cost information from the corrected records. The implementation must preserve the local-first architecture, keep Supabase as continuity infrastructure, and avoid introducing new dependencies or generalized abstractions.

The approved scope is limited to these eight items:

1. configurable tank capacity with the current vehicle corrected to 3.5 L;
2. editing fuel entries from History;
3. safe fuel-entry deletion using synchronized tombstones;
4. automatic recalculation after corrections;
5. a qualitative range-confidence indicator;
6. analytical consumption history by complete full-tank cycle;
7. operating-cost metrics;
8. Supabase Auth leaked-password protection.

Everything else discussed previously remains out of scope.

## 2. Product constraints

Existing product constraints remain authoritative unless this design explicitly changes them.

Control Vault remains:

- one personal authenticated account;
- one vehicle;
- local-first;
- IndexedDB as the operational store;
- Supabase as remote persistence and continuity;
- offline-capable for odometer and fuel operations;
- free of public sign-up, profiles, roles and collaboration;
- free of GPS, OCR, predictive ML, maintenance, taxes, insurance and financing;
- implemented with React, TypeScript, Vite, IndexedDB, Supabase and plain CSS;
- governed by the existing visual and copy rules.

No new runtime dependency is introduced by this cycle.

## 3. Architectural approach

The existing event-oriented model is retained.

`VehicleState` remains the authoritative vehicle configuration record. `FuelEntry` remains the authoritative refueling event. `OdometerReading` remains the authoritative manual odometer event.

Derived values such as consumption, remaining fuel, range, confidence and cost metrics are calculated from current records in memory. They are not persisted as aggregate tables or cached domain state.

The implementation must prefer modifying existing domain, persistence and synchronization flows over adding parallel subsystems.

## 4. Tank capacity

`VehicleState.nominalTankCapacityLiters` becomes the only authoritative source for tank capacity during normal operation.

The current fixed application default changes from 3.0 L to 3.5 L.

Requirements:

- new vehicle setup stores 3.5 L by default;
- the existing vehicle can update its stored capacity to 3.5 L without resetting history;
- changing capacity does not create a new vehicle state or new operational epoch;
- all fuel-percentage, fuel-remaining, range and maximum-refuel calculations read the configured state value rather than a fixed 3 L constant;
- configuration remains secondary UI and does not become a primary navigation destination.

A small default constant may remain for first-time setup, but calculations after setup must use the persisted vehicle-state value.

## 5. Fuel entry as the authoritative refueling odometer

New fuel entries no longer need a duplicate `OdometerReading` with `source: 'fuel_entry'`.

The canonical odometer timeline is built from:

- manual `OdometerReading` records;
- active `FuelEntry.odometerKm` values at `FuelEntry.fueledAt`.

Existing historical `OdometerReading` rows with `source: 'fuel_entry'` remain stored for compatibility but are ignored by current domain calculations, current-odometer selection and history rendering.

This removes duplicated mutable state. Editing or deleting a fuel entry changes only the fuel entry and automatically changes the reconstructed odometer timeline.

No new foreign key or pairing identifier between fuel entries and odometer readings is introduced.

## 6. Fuel-entry editing

History becomes the place where an existing active fuel entry can be corrected.

The edit flow supports:

- odometer;
- amount paid;
- fueled date/time;
- full-tank flag.

Estimated liters remain derived enrichment and are not directly editable.

Editing behavior:

- the fuel entry keeps the same stable `id`;
- `updatedAt` changes;
- the local sync status becomes `pending`;
- validation uses the same domain rules as creation where applicable;
- an edit that would make the odometer invalid relative to the reconstructed timeline is blocked;
- a suspicious positive jump continues to require explicit confirmation;
- no remote request is required before accepting a valid local edit.

Fuel-price provenance remains deterministic and offline-safe:

- editing does not refetch the fuel-price provider;
- if amount changes and the entry has a stored reference price, `estimatedLiters` is recalculated from that stored reference;
- if the entry has no stored reference price, `estimatedLiters` remains null;
- editing date/time does not rewrite historical reference-week metadata.

The UI does not expose manual liters as part of this cycle.

## 7. Fuel-entry deletion and tombstones

Fuel-entry deletion is a soft delete.

`FuelEntry` gains a nullable `deletedAt` field locally and remotely.

Deletion behavior:

- deleting sets `deletedAt`, updates `updatedAt`, and marks the local record `pending`;
- the record remains stored locally and remotely for synchronization safety;
- deleted entries are excluded from history, calculations, totals, current-odometer selection, full-tank anchors, consumption cycles and range estimation;
- sync upserts tombstones exactly like other fuel-entry updates;
- a tombstone received from Supabase hides the corresponding record on another device;
- no restore UI is introduced in this cycle;
- no physical remote delete is required.

Because legacy fuel-generated odometer readings are ignored by the domain, deleting a fuel entry cannot leave a duplicate odometer event influencing derived data.

## 8. Synchronization behavior

The existing local-first sync architecture remains in place.

For edited or deleted fuel entries:

1. the local mutation commits first;
2. the record becomes pending;
3. the existing sync loop upserts the same stable record ID;
4. Supabase stores the new fields and timestamps;
5. remote hydration merges the server representation back into IndexedDB;
6. domain selectors recalculate from active records.

Conflict policy remains intentionally simple because the product is single-account and single-user.

The current pending-record preservation rules continue to apply. A remote snapshot must not overwrite a newer unsynced local mutation.

No generalized conflict-resolution layer, event log or revision table is introduced.

## 9. Automatic recalculation

No explicit "recalculate" mutation is added.

All affected outputs remain pure derived values from the active timeline. When a fuel entry is edited or tombstoned, existing state refresh causes selectors and domain functions to run again.

The following must update automatically after a correction:

- current odometer;
- current fuel estimate;
- fuel percentage;
- remaining range;
- learned consumption;
- calibration state;
- confidence state;
- monthly and 30-day fuel spending;
- distance metrics;
- analytical cycles;
- cost per kilometer.

No persisted aggregate is allowed to become a second source of truth.

## 10. Range confidence

Range confidence is qualitative and derived.

States:

- `low`;
- `medium`;
- `high`.

The existing calibration model remains the primary evidence source:

- `calibrating` maps to low confidence;
- `estimated` maps to medium confidence;
- `calibrated` maps to high confidence.

Recency adds one simple degradation rule:

- if the most recent valid complete consumption cycle ended more than 90 days ago, confidence is reduced by one level;
- confidence never falls below low.

This reuses existing cycle count and dispersion logic rather than creating a second statistical model.

The UI must not display a numeric confidence percentage.

## 11. Analytical consumption history

History gains a simple switch between event history and cycle analysis.

No charting library is added.

Each valid complete full-tank cycle may display:

- ending date;
- distance traveled;
- liters attributed to the cycle;
- cycle km/L;
- fuel cost attributed to the cycle;
- derived R$/km;
- variation in km/L versus the previous valid cycle.

Cycle fuel and cost follow the same full-tank interval:

- start immediately after the previous full-tank anchor;
- include every partial refuel after that anchor;
- include the ending full-tank refuel;
- sum liters and amount across those included fuel entries.

A cycle with unknown liters remains invalid for consumption analytics, matching current consumption-learning behavior.

Variation is omitted when there is no previous valid cycle.

The presentation remains an editorial evidence log, not a dashboard of cards.

## 12. Operating-cost metrics

Operating-cost metrics are derived from active records only.

The Home surface may expose the compact summary. Detailed evidence remains in History.

Required metrics:

- fuel spend in the latest 30-day window;
- distance observed in the latest 30-day window when there is sufficient odometer coverage;
- derived R$/km when both spend and distance are usable;
- comparison of spend versus the preceding 30-day window;
- comparison of distance versus the preceding 30-day window;
- current learned consumption.

The existing recent-distance coverage rule should be reused where possible rather than inventing a second coverage model. If coverage is insufficient, the metric is unavailable rather than extrapolated.

Percentage comparison is shown only when the previous-period denominator is greater than zero.

No financial ledger, budget category or persisted aggregate table is introduced.

## 13. History interaction

History remains read-focused but gains correction actions for fuel entries.

Requirements:

- manual odometer rows remain non-editable in this cycle;
- fuel rows expose edit and delete affordances without turning every row into a card;
- delete requires a concise destructive confirmation;
- edit reuses existing fuel input formatting and validation;
- deleted fuel entries disappear from normal History immediately after the local tombstone commits;
- event history continues to suppress legacy fuel-generated odometer duplicates;
- cycle analysis uses the same visual language and typography already defined for Control Vault.

No new router dependency, form library, icon dependency or chart dependency is introduced.

## 14. Supabase schema changes

The repository receives a versioned migration for the fuel-entry tombstone field.

Required remote schema change:

```text
fuel_entries.deleted_at nullable timestamp
```

Existing ownership and RLS rules remain in force.

No new exposed table is required.

If provider behavior or the current deployed schema differs from repository assumptions, implementation must inspect the connected project before applying changes and update this spec before broadening scope.

## 15. Supabase Auth leaked-password protection

Supabase Auth leaked-password protection is enabled for the existing project.

This is a provider configuration change only.

Requirements:

- current Supabase changelog and Auth documentation are checked at implementation time;
- the connected Supabase plugin is used;
- the setting is enabled without changing public sign-up behavior or the current login UX;
- the resulting configuration is verified after the change;
- no privileged key is added to repository code.

This item does not authorize broader Auth, RLS or session changes.

## 16. Data correction for the current vehicle

As part of implementation, the connected Supabase project must be inspected before mutating live data.

The intended correction is:

- current vehicle tank capacity: 3.5 L;
- the relevant historical refuel of R$ 21.91 at approximately 3.11 L added should be identified from actual stored records before any mutation;
- that entry should be corrected to a full-tank event only after the matching row is unambiguously identified.

The implementation must not guess an ID, timestamp or odometer value.

Because manual actual-liters storage is explicitly outside this cycle, the 3.11 L observation is evidence for identifying the record and confirming tank capacity. It is not a reason to add an `actual_liters` field.

## 17. Error handling and integrity rules

Existing validation remains authoritative unless superseded here.

Additional rules:

- editing a deleted fuel entry is not exposed;
- tombstoned fuel entries never participate in derived calculations;
- editing amount never silently keeps an estimated-liter value calculated from a different amount when a stored reference price is available;
- sync failure preserves the local correction as pending;
- local persistence failure must not claim the edit or delete succeeded;
- a correction must never hard-delete local data before remote synchronization can observe the tombstone;
- legacy `source: 'fuel_entry'` odometer rows remain preserved but inert.

## 18. Testing strategy

Use TDD for domain, persistence and synchronization behavior.

Required coverage includes:

- default setup capacity is 3.5 L;
- selectors use persisted capacity rather than the former fixed 3 L value;
- reconstructed odometer timeline combines manual readings with active fuel entries;
- legacy fuel-generated odometer readings do not influence the reconstructed timeline;
- editing fuel odometer changes current odometer and derived metrics;
- editing amount recalculates estimated liters from stored reference price;
- deleting a fuel entry excludes it from every relevant selector;
- tombstones survive local persistence and sync round trips;
- pending local corrections are not overwritten by stale remote hydration;
- calibration and range recalculate after edit/delete;
- confidence maps calibration plus the 90-day recency degradation;
- cycle analytics calculate distance, liters, km/L, cost, R$/km and variation;
- 30-day operating metrics exclude deleted entries and handle insufficient distance coverage;
- History exposes fuel edit/delete without reintroducing fuel-generated odometer duplicates.

The full Vitest suite and production build must pass before completion.

## 19. UI constraints

The existing Control Vault design authority remains unchanged.

This cycle must preserve:

- rectangular surfaces with `border-radius: 0`;
- short operational copy;
- no explanatory clutter;
- no generic card grid;
- no charting dependency;
- thumb-friendly touch targets;
- reduced-motion behavior;
- existing mobile-first layout discipline.

Configuration for tank capacity remains secondary and must not add a new primary navigation item.

## 20. Explicit non-goals

Do not implement in this cycle:

- manual actual liters input;
- GPS;
- OCR or camera reading;
- predictive AI or ML;
- maintenance tracking;
- backup/export;
- sync diagnostics UI;
- saved-trip execution;
- trip-versus-range recommendations;
- new operational reminders;
- background push infrastructure;
- CI expansion or Playwright integration;
- generalized event sourcing;
- revision/audit-history tables for edits;
- restore UI for deleted fuel entries;
- new financial modules;
- charting libraries;
- new state-management libraries.

## 21. Success criteria

The cycle succeeds when:

1. the vehicle operates with an authoritative configured 3.5 L tank capacity;
2. a fuel entry can be corrected offline from History;
3. a fuel entry can be soft-deleted offline and that deletion synchronizes;
4. legacy fuel-generated odometer duplicates no longer affect calculations;
5. every correction immediately changes consumption, range and cost outputs without a manual reprocessing step;
6. autonomy exposes low, medium or high confidence without false numeric precision;
7. History can show valid full-tank cycles with consumption and cost evidence;
8. Home exposes useful recent operating-cost metrics without a new dashboard subsystem;
9. corrections remain stable across synchronization and another hydrated client;
10. Supabase leaked-password protection is enabled and verified;
11. the identified historical full-tank correction and vehicle capacity correction are applied only after live records are verified;
12. all tests and the production build pass;
13. no rejected feature or new dependency is introduced.

## 22. Implementation policy

Implementation must follow repository `AGENTS.md`, `MODEL_ROUTING.md`, Superpowers and Ponytail `full`.

The likely high-risk areas are:

- persistence model changes;
- tombstone synchronization;
- derived consumption/range correctness;
- live Supabase data correction;
- Auth security configuration.

Those tasks should use the repository's higher-effort routing recommendations.

Implementation proceeds only after this written spec is reviewed and approved, followed by a separate implementation plan.
