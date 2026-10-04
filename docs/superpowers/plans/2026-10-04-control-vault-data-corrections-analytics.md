# Control Vault Data Corrections and Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make vehicle data correctable and safely synchronized, use the configured 3.5 L tank capacity as the source of truth, and derive confidence, consumption-cycle and operating-cost analytics from active records.

**Architecture:** Keep the existing local-first event model. `VehicleState`, manual `OdometerReading` records and active `FuelEntry` records remain the only persisted domain sources; all analytics stay derived. Fuel tombstones reuse the saved-trip synchronization pattern, and legacy `source: 'fuel_entry'` odometer rows remain stored but become inert.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 5, IndexedDB via `idb`, Supabase JS 2, Supabase Auth/Postgres/RLS, plain CSS.

**Spec:** `docs/superpowers/specs/2026-10-04-control-vault-data-corrections-analytics-design.md`

## Global Constraints

- One personal authenticated account and one vehicle only.
- IndexedDB remains the operational local store; Supabase remains remote persistence and continuity.
- Local writes must succeed without waiting for Supabase.
- No new runtime dependency.
- Keep Ponytail in `full` mode.
- Use TDD for non-trivial domain, persistence and synchronization behavior.
- Keep domain calculations pure and independent from React, IndexedDB and Supabase.
- No manual actual-liters field.
- No GPS, OCR, predictive ML, maintenance, backup/export, sync diagnostics UI, saved-trip execution, trip-versus-range recommendations, new reminder infrastructure, CI expansion or charting library.
- Fuel corrections keep stable client-generated IDs.
- Fuel deletion is a tombstone, never a physical delete in the normal flow.
- Legacy fuel-generated odometer rows remain stored but must not affect current calculations.
- Money remains integer cents in persisted records.
- Rectangular UI surfaces keep `border-radius: 0`; copy stays short and operational.
- Supabase work must use current documentation, the connected Supabase capability, RLS ownership rules and security advisors.
- Never expose a `service_role`, secret key or Management API token in browser code or repository files.

## Review Focus

1. Editing an older fuel event must validate against its chronological neighbors, not against the latest vehicle odometer. Task 3 tests an accepted historical correction and a rejected correction that crosses the next event.
2. A legacy `source: 'fuel_entry'` odometer row must not keep an edited or deleted fuel event alive indirectly. Tasks 2 and 4 test that the reconstructed timeline ignores those rows.
3. A stale remote snapshot must not replace a newer pending local edit or tombstone. Task 4 adds merge tests for both cases.
4. Old IndexedDB fuel rows do not contain `deletedAt`. Task 2 upgrades database version 5 data to `deletedAt: null` and verifies the migration.
5. Period comparisons must not divide by zero or invent distance from insufficient coverage. Task 5 tests zero previous-period spend/distance and insufficient 30-day odometer coverage.

---

### Task 1: Configured 3.5 L tank capacity

**Routing:** Sol Extra High. Persisted vehicle configuration affects fuel limits, range and percentage calculations.

**Files:**
- Modify: `src/modules/vehicle/domain/config.ts`
- Modify: `src/modules/vehicle/vehicleActions.ts`
- Modify: `src/modules/vehicle/FuelView.tsx`
- Modify: `src/modules/vehicle/vehicleActions.test.ts`
- Modify: `src/modules/vehicle/vehicleViews.test.tsx`
- Modify: `src/modules/vehicle/selectors.test.ts`

**Interfaces:**
- Produces: `DEFAULT_TANK_CAPACITY_LITERS = 3.5`.
- Produces: `getMaxFuelAmountCents(referencePricePerLiter: number, tankCapacityLiters: number): number`.
- Produces: `updateTankCapacity(nominalTankCapacityLiters: number, now: string): Promise<RecordResult>`.
- Consumes later: the configured `VehicleState.nominalTankCapacityLiters` in fuel entry UI and derived selectors.

- [ ] **Step 1: Write failing capacity tests**

In `vehicleActions.test.ts`, assert new setup persists `nominalTankCapacityLiters: 3.5`, `updateTankCapacity(3.5, now)` updates the existing state without changing `createdAt` or `initialOdometerKm`, marks it pending and rejects non-finite/non-positive capacity.

In `vehicleViews.test.tsx`, assert the fuel ceiling uses the capacity prop rather than a fixed constant.

In `selectors.test.ts`, keep a state with `nominalTankCapacityLiters: 3.5` and assert a known-full current tank reports 3.5 L and 100%.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

`npm test -- src/modules/vehicle/vehicleActions.test.ts src/modules/vehicle/vehicleViews.test.tsx src/modules/vehicle/selectors.test.ts`

Expected: failures because the default remains 3 L, `updateTankCapacity` does not exist and `FuelView` cannot receive configured capacity.

- [ ] **Step 3: Implement the minimum capacity changes**

Rename the setup-only constant to `DEFAULT_TANK_CAPACITY_LITERS` and set it to `3.5`.

Change `getMaxFuelAmountCents` to require `tankCapacityLiters`; do not keep an implicit 3.5 fallback in calculations.

Implement `updateTankCapacity` by reading the current vehicle state, validating the positive finite number, writing the same state with only `nominalTankCapacityLiters` and `updatedAt` changed, then queueing the existing sync.

Pass the configured capacity into `FuelView` and use it for the displayed dynamic fuel ceiling.

- [ ] **Step 4: Run focused tests and full suite**

Run the focused command above, then `npm test`.

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: use configured tank capacity`.

---

### Task 2: Canonical odometer timeline and fuel tombstone foundation

**Routing:** Sol Extra High. This changes persisted local records and the odometer source used by every calculation.

**Files:**
- Modify: `src/modules/vehicle/domain/types.ts`
- Modify: `src/modules/vehicle/domain/odometer.ts`
- Create: `src/modules/vehicle/domain/odometerTimeline.test.ts`
- Modify: `src/modules/vehicle/fuelEntries.ts`
- Modify: `src/modules/vehicle/fuelEntries.test.ts`
- Modify: `src/infrastructure/local/db.ts`
- Modify: `src/infrastructure/local/store.ts`
- Modify: `src/infrastructure/local/store.test.ts`
- Modify: `src/modules/vehicle/vehicleActions.ts`
- Modify: `src/modules/vehicle/vehicleActions.test.ts`
- Modify: `src/modules/vehicle/selectors.ts`
- Modify: `src/modules/vehicle/selectors.test.ts`

**Interfaces:**
- Produces: `FuelEntry.deletedAt: string | null`.
- Produces: `getOdometerTimeline(readings: OdometerReading[], fuelEntries: FuelEntry[]): Array<{ id: string; at: string; odometerKm: number; source: 'manual' | 'fuel' }>`.
- Produces: `getLatestOdometerKm(readings: OdometerReading[], fuelEntries: FuelEntry[], fallbackKm?: number): number | null`.
- Produces: `saveFuelEntryIfCurrent(entry: FuelEntry, shouldSave: (latestOdometerKm: number | null, activeFuelEntries: FuelEntry[]) => boolean): Promise<boolean>`.
- Changes: `saveOdometerReadingIfCurrent` derives the latest value from manual readings plus active fuel entries.
- Consumes later: Tasks 3, 4 and 5 use the same active timeline.

- [ ] **Step 1: Write RED tests for active fuel records and timeline**

Add tests proving:

- tombstoned fuel entries are excluded by `uniqueFuelEntries`;
- manual readings and active fuel entries appear in chronological timeline order;
- `source: 'fuel_entry'` odometer rows are ignored;
- a tombstoned fuel entry is absent from the timeline;
- latest odometer uses manual readings plus active fuel entries;
- a new fuel save creates one fuel record and no new `source: 'fuel_entry'` odometer record.

- [ ] **Step 2: Write RED IndexedDB migration test**

Bump the expected local database version from 5 to 6 in the test setup, seed a version-5 fuel row without `deletedAt`, reopen it with current code and assert the row is backfilled with `deletedAt: null`.

Do not rewrite or remove legacy odometer rows.

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

`npm test -- src/modules/vehicle/fuelEntries.test.ts src/modules/vehicle/domain/odometerTimeline.test.ts src/infrastructure/local/store.test.ts src/modules/vehicle/vehicleActions.test.ts src/modules/vehicle/selectors.test.ts`

Expected: failures for missing `deletedAt`, missing timeline helpers and creation of the paired fuel odometer record.

- [ ] **Step 4: Implement the canonical timeline**

Add `deletedAt` to `FuelEntry`.

Make `uniqueFuelEntries` discard entries whose `deletedAt` is non-null before duplicate-full-tank filtering.

Add the two pure odometer helpers in `domain/odometer.ts`; only manual odometer rows and active fuel entries contribute.

Update selectors to use the canonical timeline for current odometer, month baseline and recent-distance coverage.

- [ ] **Step 5: Upgrade IndexedDB and simplify fuel writes**

Set `LOCAL_DATABASE_VERSION = 6`.

For upgrades from versions below 6, backfill missing fuel `deletedAt` with `null` without changing other fields.

Replace `saveFuelAndReadingIfCurrent` usage with `saveFuelEntryIfCurrent`. Its transaction reads both `odometer_readings` and `fuel_entries`, validates against the canonical active timeline, then writes only `fuel_entries`.

Update `saveOdometerReadingIfCurrent` so a manual reading cannot regress behind a newer active fuel event.

Create new fuel entries with `deletedAt: null`.

- [ ] **Step 6: Run focused tests and full suite**

Run the focused command above, then `npm test`.

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `refactor: make fuel entries authoritative for refuel mileage`.

---

### Task 3: Offline-safe fuel editing and deletion

**Routing:** Sol Extra High. Historical correction is data-integrity-sensitive and must remain atomic offline.

**Files:**
- Modify: `src/modules/vehicle/domain/odometer.ts`
- Modify: `src/modules/vehicle/domain/odometerTimeline.test.ts`
- Modify: `src/infrastructure/local/store.ts`
- Create: `src/infrastructure/local/fuelEntriesStore.test.ts`
- Modify: `src/modules/vehicle/vehicleActions.ts`
- Modify: `src/modules/vehicle/vehicleActions.test.ts`

**Interfaces:**
- Produces: `validateFuelEntryPosition(readings: OdometerReading[], fuelEntries: FuelEntry[], entryId: string, nextOdometerKm: number, nextFueledAt: string): OdometerValidation`.
- Produces: `getFuelEntry(id: string): Promise<LocalFuelEntry | null>`.
- Produces: `saveFuelEntryCorrection(entry: FuelEntry, shouldSave: (readings: OdometerReading[], fuelEntries: FuelEntry[]) => boolean): Promise<boolean>`.
- Produces: `softDeleteFuelEntry(id: string, deletedAt: string): Promise<boolean>`.
- Produces: `FuelEditInput = { odometerKm: number; amountCents: number; fullTank: boolean; fueledAt: string }`.
- Produces: `updateFuelEntry(existing: FuelEntry, input: FuelEditInput, now: string, confirmSuspicious?: boolean): Promise<RecordResult>`.
- Produces: `deleteFuelEntry(id: string, now: string): Promise<boolean>`.

- [ ] **Step 1: Write RED neighbor-validation tests**

Test `validateFuelEntryPosition` with an existing historical entry at 1,100 km between events at 1,000 km and 1,200 km.

Assert:

- editing it to 1,150 km is valid even when the current vehicle odometer is above 1,200 km;
- editing it below 1,000 km is invalid;
- editing it above 1,200 km is invalid;
- moving its timestamp between different neighbors validates against the new position;
- a jump greater than `SUSPICIOUS_ODOMETER_DELTA_KM` from the previous event returns `suspicious` when it still does not cross the next event.

- [ ] **Step 2: Write RED persistence tests**

In `fuelEntriesStore.test.ts`, verify:

- an update retains the same ID and `createdAt`, updates `updatedAt`, and becomes pending;
- a soft delete sets `deletedAt` and `updatedAt`, remains in `listFuelEntries()` for sync storage, and is hidden by active-domain filtering;
- deleting an unknown ID returns false.

- [ ] **Step 3: Write RED action tests**

Verify `updateFuelEntry`:

- does not call `getFuelPriceReference`;
- recalculates `estimatedLiters` from the entry's stored `referencePricePerLiter` when amount changes;
- keeps `estimatedLiters: null` when the stored reference is null;
- keeps `referenceWeekStart` and `referenceWeekEnd` unchanged when date changes;
- supports suspicious confirmation;
- rejects chronological odometer regression without mutating the record.

Verify `deleteFuelEntry` queues sync only after a successful local tombstone.

- [ ] **Step 4: Run focused tests and confirm RED**

Run:

`npm test -- src/modules/vehicle/domain/odometerTimeline.test.ts src/infrastructure/local/fuelEntriesStore.test.ts src/modules/vehicle/vehicleActions.test.ts`

Expected: failures because correction APIs do not exist.

- [ ] **Step 5: Implement minimal store and action APIs**

Use one IndexedDB readwrite transaction over `fuel_entries` and `odometer_readings` for edit validation plus write.

Exclude the edited entry itself from neighbor validation.

Keep the existing stable ID, `createdAt` and price-reference metadata.

Use the existing liter rounding behavior for amount edits.

Use the saved-trip tombstone pattern for `softDeleteFuelEntry`.

- [ ] **Step 6: Run focused tests and full suite**

Run the focused command above, then `npm test`.

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: edit and soft-delete fuel entries`.

---

### Task 4: Supabase tombstone schema and synchronization

**Routing:** Sol Extra High. This changes remote persistence, merge semantics and RLS-protected user data.

**Files:**
- Create: migration generated by `supabase migration new add_fuel_entry_deleted_at`
- Modify: `src/infrastructure/sync/sync.ts`
- Modify: `src/infrastructure/sync/sync.test.ts`
- Modify: `src/infrastructure/local/store.test.ts`

**Interfaces:**
- Remote `fuel_entries.deleted_at timestamptz null`.
- `RemoteFuelEntry.deleted_at: string | null`.
- `toRemoteFuelEntry` sends `deleted_at`.
- `fromRemoteFuelEntry` maps `deleted_at` to `FuelEntry.deletedAt`.

- [ ] **Step 1: Read current Supabase changelog/docs and inspect project**

Use the Supabase skill requirements before DDL.

Use the connected Supabase project tools to list the project, inspect `public.fuel_entries`, list applied migrations and confirm existing RLS/ownership policies before mutation.

Expected: the table exists without `deleted_at`.

- [ ] **Step 2: Write RED sync tests**

Add tests proving:

- a pending fuel tombstone upserts `deleted_at`;
- a remote tombstone hydrates locally as synced;
- a newer pending local edit is not replaced by an older remote row;
- a newer pending local tombstone is not replaced by an active older remote row;
- a later remote tombstone propagates after the local record is synced.

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

`npm test -- src/infrastructure/sync/sync.test.ts src/infrastructure/local/store.test.ts`

Expected: failure because remote fuel mapping has no `deleted_at`.

- [ ] **Step 4: Add and apply the migration**

Generate `add_fuel_entry_deleted_at` and make its SQL only:

`alter table public.fuel_entries add column deleted_at timestamptz;`

Do not add a new table, trigger or policy. Existing select/insert/update ownership policies already cover the new column.

Apply the DDL through the connected Supabase capability, then verify the column exists.

- [ ] **Step 5: Implement remote mapping**

Add `deleted_at` to `RemoteFuelEntry`, `toRemoteFuelEntry` and `fromRemoteFuelEntry`.

Keep the existing upsert conflict key `id`.

- [ ] **Step 6: Run Supabase advisors and tests**

Run security and performance advisors after DDL. Resolve any new issue caused by this migration before continuing.

Run the focused tests, then `npm test`.

Expected: PASS with no new advisor issue attributable to the migration.

- [ ] **Step 7: Commit**

Commit message: `feat: sync fuel entry tombstones`.

---

### Task 5: Derived confidence, cycle analytics and 30-day operating cost

**Routing:** Sol Extra High. These calculations directly drive user-facing fuel and cost decisions.

**Files:**
- Modify: `src/modules/vehicle/domain/consumption.ts`
- Modify: `src/modules/vehicle/domain/consumption.test.ts`
- Modify: `src/modules/vehicle/selectors.ts`
- Modify: `src/modules/vehicle/selectors.test.ts`

**Interfaces:**
- Extend `ConsumptionCycle` with `startAt: string`, `endAt: string`, `fuelCostCents: number`.
- Produce: `RangeConfidence = 'low' | 'medium' | 'high'`.
- Produce dashboard field: `rangeConfidence: RangeConfidence`.
- Produce dashboard field: `consumptionCycles: Array<ConsumptionCycle & { costPerKmCents: number; kmPerLiterChangePercent: number | null }>`.
- Produce dashboard fields: `recent30SpendCents: number`, `recent30DistanceKm: number | null`, `recent30CostPerKmCents: number | null`, `previous30SpendChangePercent: number | null`, `previous30DistanceChangePercent: number | null`.

- [ ] **Step 1: Write RED consumption-cycle tests**

Assert each valid cycle records anchor dates and sums `amountCents` across all partial refuels plus the ending full refill.

Assert a cycle with unknown liters remains invalid, preserving current learning behavior.

- [ ] **Step 2: Write RED confidence tests**

For a fixed `now`:

- calibrating returns low;
- estimated with a recent valid cycle returns medium;
- calibrated with a recent valid cycle returns high;
- a most recent valid cycle older than 90 days degrades high to medium and medium to low;
- low never degrades below low.

- [ ] **Step 3: Write RED operating-metric tests**

Use the canonical odometer timeline from Task 2.

Assert:

- latest 30-day spend excludes tombstones;
- latest 30-day distance is available only with sufficient coverage;
- R$/km is null without usable distance;
- previous-window percentage change is null when the previous value is zero;
- spend and distance comparisons use the immediately preceding 30-day window;
- editing/deleting an entry changes derived cycle and operating metrics without any explicit reprocessing call.

- [ ] **Step 4: Run focused tests and confirm RED**

Run:

`npm test -- src/modules/vehicle/domain/consumption.test.ts src/modules/vehicle/selectors.test.ts`

Expected: failures for the new fields and confidence behavior.

- [ ] **Step 5: Implement the minimum derived calculations**

Accumulate cycle cost inside the existing `buildConsumptionCycles` pass.

Derive confidence from existing calibration state plus one 90-day recency downgrade.

Derive cycle cost/km and km/L variation after cycles are built.

Reuse the canonical odometer timeline for current/previous 30-day distance windows. Do not extrapolate from insufficient coverage.

Keep all results transient in selectors.

- [ ] **Step 6: Run focused tests and full suite**

Run the focused command above, then `npm test`.

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: derive vehicle confidence and operating analytics`.

---

### Task 6: Correction and analytics UI

**Routing:** Sol Medium. Domain contracts are fixed by prior tasks; this is React composition and interaction work.

**Files:**
- Modify: `src/modules/vehicle/navigation.ts`
- Modify: `src/modules/vehicle/navigation.test.ts`
- Modify: `src/modules/vehicle/FuelView.tsx`
- Modify: `src/modules/vehicle/HistoryView.tsx`
- Modify: `src/modules/vehicle/HomeView.tsx`
- Modify: `src/modules/vehicle/VehicleModule.tsx`
- Create: `src/modules/vehicle/TankCapacityView.tsx`
- Modify: `src/modules/vehicle/vehicleViews.test.tsx`
- Modify: `src/styles/app.css` or the existing vehicle stylesheet that owns these classes

**Interfaces:**
- Add view `'fuel-edit'` with path `/historico/abastecimentos/:id/editar`.
- Add view `'tank-capacity'` with path `/tanque`.
- Add `currentFuelEntryId(): string | null`.
- `FuelView` accepts `tankCapacityLiters: number` and optional `entry?: FuelEntry`; create mode calls `recordFuel`, edit mode calls `updateFuelEntry`.
- `HistoryView` accepts `consumptionCycles`, `onEditFuel(id)` and `onDeleteFuel(id)`.
- `TankCapacityView` calls `updateTankCapacity`.

- [ ] **Step 1: Write RED navigation tests**

Assert direct parsing and navigation for the fuel-edit and tank-capacity routes, including URL-encoded fuel IDs.

- [ ] **Step 2: Write RED FuelView edit tests**

Assert edit mode:

- title/copy identifies correction rather than new refuel;
- initializes amount, odometer, full-tank and date/time from the entry;
- uses native `datetime-local`;
- does not fetch a new historical price reference for save semantics;
- submits `updateFuelEntry(existing, input, now, confirmSuspicious)`;
- retains the suspicious-jump confirmation flow.

- [ ] **Step 3: Write RED History tests**

Assert:

- normal event mode hides tombstones and legacy fuel-generated odometer rows;
- each fuel row exposes Editar and Excluir actions;
- delete calls the supplied callback only after a concise native confirmation;
- the Eventos/Ciclos switch renders cycle date, distance, liters, km/L, cost, R$/km and variation;
- no chart element or chart dependency is introduced.

- [ ] **Step 4: Write RED Home and tank-capacity tests**

Assert:

- Home renders qualitative confidence when autonomy is ready;
- Home renders compact 30-day spend, distance and R$/km where available;
- unavailable values do not display invented zero-derived comparisons;
- Home exposes a secondary tank-capacity action, not a new primary navigation item;
- TankCapacityView saves a positive 3.5 L value through `updateTankCapacity`.

- [ ] **Step 5: Run focused UI tests and confirm RED**

Run:

`npm test -- src/modules/vehicle/navigation.test.ts src/modules/vehicle/vehicleViews.test.tsx`

Expected: failures for missing routes, props and UI.

- [ ] **Step 6: Implement the smallest UI**

Reuse `FuelView` for create/edit instead of creating a second fuel form.

Use native `datetime-local` and native `window.confirm`.

Keep History editorial, with a simple Eventos/Ciclos switch and no card grid.

Keep tank configuration secondary, reachable from Home but absent from bottom navigation.

Pass already-derived analytics from `VehicleModule`; do not recompute domain formulas inside components.

- [ ] **Step 7: Verify UI and full suite**

Run the focused tests, `npm test`, and `npm run build`.

Perform a bounded 390x844 inspection for Home, History events, History cycles, Fuel edit and Tank capacity. Also check 320px for horizontal overflow.

Expected: no new dependency, no clipped controls, no rounded rectangular surfaces.

- [ ] **Step 8: Commit**

Commit message: `feat: add fuel correction and analytics UI`.

---

### Task 7: Correct the live vehicle data

**Routing:** Sol Extra High. This mutates production user data and must not guess record identity.

**Files:**
- No product code required unless live evidence contradicts the approved schema assumptions.
- Repository migration from Task 4 must already be committed.

**Interfaces:**
- Live `vehicle_state.tank_capacity_liters = 3.5`.
- One unambiguously identified R$ 21.91 fuel record becomes `full_tank = true`.

- [ ] **Step 1: Inspect, do not mutate**

Use the connected Supabase project.

Query the owned `vehicle_state` row and candidate fuel entries with `amount_cents = 2191`, including ID, odometer, estimated liters, full-tank flag, fueled date and reference price metadata.

Do not infer the target only from amount if more than one row matches.

- [ ] **Step 2: Verify the target is unambiguous**

Expected evidence should be compatible with the user's described fill of approximately 3.11 L.

If multiple plausible rows remain, stop this data-mutation task and report the candidate IDs/timestamps without changing any row.

- [ ] **Step 3: Apply the two minimal data corrections**

Execute a parameter-free SQL update only after the exact primary key is known:

- set `vehicle_state.tank_capacity_liters = 3.5` and advance `updated_at`;
- set the identified `fuel_entries.full_tank = true` and advance `updated_at`.

Do not overwrite `estimated_liters` with the observed 3.11 L because the field's semantics remain estimated.

- [ ] **Step 4: Read back and verify**

Requery both rows and confirm exactly the intended records changed.

Run the relevant security advisor again if any provider-side schema/security change was made during this task; pure row updates alone do not require a new migration.

- [ ] **Step 5: Record completion**

No repository commit is required for the live row mutation. Record the exact verified row ID and timestamp in the implementation report, not in source code.

---

### Task 8: Enable and verify Supabase leaked-password protection

**Routing:** Sol Extra High. This is an Auth security configuration change.

**Files:**
- No application-code change expected.
- No credential or Management API token may be committed.

**Interfaces:**
- Desired provider state: leaked-password protection enabled.
- Current Supabase documentation identifies this as Auth password security backed by HaveIBeenPwned and available on Pro Plan and above.

- [ ] **Step 1: Refresh current provider documentation**

Use the connected Supabase documentation search for `Password security` and the current Auth config management reference.

Confirm the product/plan prerequisite and the current setting name before any change.

- [ ] **Step 2: Inspect current security state**

Use the connected Supabase security advisor and available project metadata to confirm whether leaked-password protection is currently disabled.

Expected before change: the existing security finding is present or provider state otherwise confirms disabled.

- [ ] **Step 3: Enable the setting using an authorized provider surface**

The currently connected Supabase MCP toolset in this environment does not expose an Auth-config PATCH action. Therefore do not simulate this with SQL and do not place a Supabase Management API token in the repository.

If the execution environment still lacks an authorized Auth-config mutation at this step, the user must toggle **Authentication -> Providers -> Email -> Prevent use of leaked passwords** in the Supabase Dashboard. The agent then resumes verification.

If an authorized Supabase Auth-config action becomes available, use that action instead.

- [ ] **Step 4: Verify after the change**

Re-run the Supabase security advisor and verify the leaked-password finding is cleared.

Do not modify login UI, public signup behavior, RLS or session handling.

- [ ] **Step 5: Record completion**

No source commit is required unless current provider documentation forces a repository configuration change, in which case stop and update the spec before broadening scope.

---

### Task 9: Final integration verification and review

**Routing:** Astra Medium recommended by `MODEL_ROUTING.md` for whole-branch integration review.

**Files:**
- Modify only files required to fix verified regressions within the approved scope.

**Interfaces:**
- The branch must satisfy all prior task contracts simultaneously.

- [ ] **Step 1: Run full automated verification**

Run:

`npm test`

`npm run build`

Expected: both exit successfully with no new warnings/errors attributable to this cycle.

- [ ] **Step 2: Verify critical behavior end to end**

Exercise:

- configured 3.5 L capacity;
- new fuel creation without a paired fuel odometer row;
- offline historical fuel edit;
- offline fuel tombstone;
- re-rendered range/consumption/cost after correction;
- sync of edit and tombstone;
- remote hydration preserving newer pending local records;
- History Eventos/Ciclos;
- Home confidence and 30-day operating metrics.

- [ ] **Step 3: Verify scope and dependency discipline**

Confirm `package.json` has no new runtime dependency and rejected features remain absent.

Confirm no physical fuel delete, new audit table, chart library, state manager or manual-liters field was introduced.

- [ ] **Step 4: Request fresh code review**

Use Superpowers `requesting-code-review` with the whole branch diff against `main`.

Fix every Critical and Important finding within scope, rerunning affected tests after each fix.

- [ ] **Step 5: Run verification-before-completion**

Use Superpowers `verification-before-completion`.

Re-run `npm test`, `npm run build` and inspect the final branch diff.

- [ ] **Step 6: Finish the branch**

Use Superpowers `finishing-a-development-branch`.

Do not merge to `main` without the user's explicit integration choice.
