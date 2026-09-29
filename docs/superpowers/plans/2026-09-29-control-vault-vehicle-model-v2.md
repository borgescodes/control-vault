# Control Vault Vehicle Model v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual-liter fuel recording with a local-first estimated model based on the weekly Paragominas gasoline average, allow setup without a full tank, and present conservative approximate range without losing offline operation or existing history.

**Architecture:** Keep the existing React + TypeScript + IndexedDB + Supabase architecture. Add one small browser-side fuel-price reference module backed by `localStorage`; persist only the immutable price snapshot used by each fuel entry. Migrate remote schema additively first, then migrate the local/domain contract in one compile-safe task, and finally remove manual liters from actions/UI.

**Tech Stack:** React, TypeScript, Vite, Vitest, IndexedDB via `idb`, Supabase JS/Postgres/RLS, browser `fetch`, `localStorage`, existing PWA/Cloudflare deployment.

**Spec:** `docs/superpowers/specs/2026-09-29-control-vault-vehicle-model-v2-design.md`

## Global Constraints

- Use Superpowers execution discipline and Ponytail `full`.
- TDD for every non-trivial behavior change. Observe RED before production code.
- Local persistence succeeds independently of the external fuel-price API.
- No manual liters input in the final v2 UI or `FuelInput`.
- Fixed reference market in v2: `PA / PARAGOMINAS / GASOLINA COMUM`.
- Fuel-price API base URL comes only from `VITE_FUEL_PRICE_API_URL`.
- Fuel-price cache stays in `localStorage`; never add an IndexedDB store or Supabase table for it.
- Cache freshness follows the returned `semanaInicio..semanaFim` interval, not a seven-day fetch TTL.
- Expired/same-week or failed refreshes are throttled for 12 hours with `nextCheckAt`.
- `nominalTankCapacityLiters = 3`; no separate reserve-capacity model.
- `RANGE_SAFETY_FACTOR = 0.90` affects displayed range only.
- Never apply the range safety factor to remaining liters, tank clamping, cycle fuel totals or learned consumption.
- Initial full-tank anchor is optional.
- A partial fuel entry with unknown estimated liters invalidates range until a later full-tank anchor.
- A full-tank entry resets the internal fuel balance to nominal capacity even when estimated liters are unknown.
- Preserve existing sequential per-refill clamp and `(odometerKm, fueledAt)` ordering.
- Existing odometer atomicity, sync rerun guard, hydration behavior and RLS ownership must remain intact.
- Persist money as integer cents and record IDs with `crypto.randomUUID()`.
- Do not add router, state manager, date library, cache library, HTTP library, proxy, scheduler, GPS, charts or confidence scoring.
- One meaningful commit per task. Do not merge to `main` during this plan.

## Review Focus

- Malformed/corrupt `localStorage` fuel-price JSON must be ignored safely and must not block fuel recording.
- Local calendar date boundaries must treat both `semanaInicio` and `semanaFim` as inclusive, independent of UTC midnight conversion.
- A stale cached reference plus network failure must remain usable for estimation while setting a 12-hour recheck throttle.
- Legacy IndexedDB and Supabase fuel rows must survive migration with their old liters copied to `estimatedLiters` and null reference snapshots.
- A full-tank event after an unknown partial refill must restore range calculation from that full-tank anchor instead of leaving range permanently unknown.

---

### Task 1: Additive Supabase v2 compatibility migration

**Files:**
- Create: `supabase/migrations/<generated>_vehicle_model_v2.sql`
- Modify if needed: `supabase/README.md`

**Interfaces:**
- Produces remote nullable `vehicle_state.initial_full_tank_at`.
- Produces `fuel_entries.estimated_liters`, `reference_price_per_liter`, `reference_week_start`, `reference_week_end`.
- Keeps legacy `fuel_entries.liters` temporarily, but nullable.

- [ ] **Step 1: Inspect current remote schema and policies**

Use the Supabase connector to confirm the current three tables, constraints, grants and RLS policies before writing SQL.

Expected: current `fuel_entries.liters` is `NOT NULL`; ownership policies remain the existing `auth.uid() = user_id` model.

- [ ] **Step 2: Create the migration**

Use the repository's existing migration naming convention/tooling.

Migration requirements:

```sql
alter table public.vehicle_state
  alter column initial_full_tank_at drop not null;

alter table public.fuel_entries
  add column estimated_liters numeric(7,3),
  add column reference_price_per_liter numeric(8,3),
  add column reference_week_start date,
  add column reference_week_end date;

update public.fuel_entries
set estimated_liters = liters
where estimated_liters is null;

alter table public.fuel_entries
  alter column liters drop not null;
```

Do not drop `liters` yet. Do not alter RLS/grants.

- [ ] **Step 3: Apply and verify migration**

Verify with real Supabase:
- existing rows retain IDs, amount, odometer and timestamps;
- old `liters` values are copied to `estimated_liters`;
- reference snapshot columns are null on historical rows;
- `initial_full_tank_at` accepts null;
- a v1-shaped insert with `liters` still works;
- a v2-shaped insert with `liters = null` and `estimated_liters` works;
- ownership mismatch remains rejected.

- [ ] **Step 4: Run advisors**

Expected:
- no new Security Advisor error;
- no new Performance Advisor warning/error;
- known leaked-password-protection warning may remain.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat: add vehicle model v2 schema"
```

---

### Task 2: Weekly fuel-price reference client and cache

**Files:**
- Create: `src/infrastructure/fuelPrice/fuelPrice.ts`
- Create: `src/infrastructure/fuelPrice/fuelPrice.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces:
```ts
export type FuelPriceReference = {
  uf: string
  municipio: string
  produto: string
  semanaInicio: string
  semanaFim: string
  precoMedio: number
  precoMinimo: number
  precoMaximo: number
  postosPesquisados: number
}

export async function getFuelPriceReference(now: Date): Promise<FuelPriceReference | null>
```
- Uses fixed request parameters: `PA`, `PARAGOMINAS`, `GASOLINA COMUM`.
- Reads base URL from `VITE_FUEL_PRICE_API_URL`.

- [ ] **Step 1: Write cache/client RED tests**

Tests:
- `uses_cached_reference_without_fetch_inside_week_inclusive`
- `refreshes_after_semana_fim_when_next_check_is_due`
- `keeps_stale_reference_when_refresh_fails_and_throttles_for_12_hours`
- `keeps_same_expired_week_and_throttles_for_12_hours`
- `stores_newer_week_and_clears_next_check`
- `returns_null_when_no_cache_and_request_fails`
- `ignores_malformed_cache_json`
- `compares_date_only_values_using_local_calendar_date`

Use a stubbed `fetch` and real jsdom `localStorage`. Do not add a caching dependency.

- [ ] **Step 2: Run RED**

```bash
npm test -- src/infrastructure/fuelPrice/fuelPrice.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimum cache/client**

Use cache key exactly:

`control-vault:fuel-price:PA:PARAGOMINAS:GASOLINA-COMUM`

Stored shape:

```ts
type FuelPriceCache = {
  reference: FuelPriceReference
  fetchedAt: string
  nextCheckAt: string | null
}
```

Rules:
- date inside `semanaInicio..semanaFim`, inclusive -> cached reference, no fetch;
- expired + throttle active -> stale reference, no fetch;
- expired + due -> fetch latest;
- same expired week or fetch error -> keep stale reference and set `nextCheckAt = now + 12h`;
- newer week -> replace cache and `nextCheckAt = null`;
- no cache + failed fetch -> null;
- no cache + already-expired response -> cache it and set 12-hour recheck.

Malformed/invalid cache is treated as absent.

- [ ] **Step 4: Add environment contract**

Append:

`VITE_FUEL_PRICE_API_URL=`

Do not place a production hostname or secret in the repo.

- [ ] **Step 5: Run GREEN and suite**

```bash
npm test -- src/infrastructure/fuelPrice/fuelPrice.test.ts
npm test
npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/fuelPrice .env.example
git commit -m "feat: add weekly fuel price reference"
```

---

### Task 3: Migrate domain, IndexedDB and sync contracts to v2

**Files:**
- Modify: `src/modules/vehicle/domain/config.ts`
- Modify: `src/modules/vehicle/domain/types.ts`
- Modify: `src/modules/vehicle/domain/consumption.ts`
- Modify: `src/modules/vehicle/domain/fuelEstimate.ts`
- Modify: `src/modules/vehicle/domain/domain.test.ts`
- Modify: `src/modules/vehicle/selectors.ts`
- Modify: `src/modules/vehicle/selectors.test.ts`
- Modify: `src/infrastructure/local/db.ts`
- Modify: `src/infrastructure/local/store.test.ts`
- Modify: `src/infrastructure/sync/sync.ts`
- Modify: `src/infrastructure/sync/sync.test.ts`
- Modify: `src/modules/vehicle/vehicleActions.ts`
- Modify: `src/modules/vehicle/vehicleActions.test.ts`

**Interfaces:**
- Domain:
```ts
export const NOMINAL_TANK_CAPACITY_LITERS = 3
export const RANGE_SAFETY_FACTOR = 0.90

export type VehicleState = {
  nominalTankCapacityLiters: number
  initialOdometerKm: number
  initialFullTankAt: string | null
  createdAt: string
  updatedAt: string
}

export type FuelEntry = {
  id: string
  odometerKm: number
  amountCents: number
  estimatedLiters: number | null
  referencePricePerLiter: number | null
  referenceWeekStart: string | null
  referenceWeekEnd: string | null
  fullTank: boolean
  fueledAt: string
  createdAt: string
  updatedAt: string
}
```
- `buildConsumptionCycles(initialAnchor: FullTankAnchor | null, fuelEntries: FuelEntry[]): ConsumptionCycle[]`
- `estimateFuelRemaining` accepts nullable initial anchor and nominal capacity, returning null when no reliable current estimate exists.
- IndexedDB version becomes `2`.
- Sync maps domain `nominalTankCapacityLiters` to existing remote `tank_capacity_liters`.

- [ ] **Step 1: Write migration/domain RED tests**

Add tests proving:
- opening a v1 local DB migrates `tankCapacityLiters -> nominalTankCapacityLiters`;
- v1 local `liters -> estimatedLiters` and reference snapshot fields become null;
- existing IDs and `syncStatus` survive migration;
- nullable initial anchor round-trips;
- no initial anchor + no later full tank -> cycles/range unavailable;
- no initial anchor + first later full tank establishes the anchor for subsequent calculation;
- unknown partial (`estimatedLiters = null`) invalidates range;
- later full tank after unknown partial restores range;
- cycles containing unknown fuel quantity are excluded;
- existing same-odometer timestamp ordering and per-refill clamp tests remain green;
- selector applies `RANGE_SAFETY_FACTOR` to `rangeKm` only;
- remaining liters, fuel percent and learned consumption remain undiscounted.

- [ ] **Step 2: Run RED**

```bash
npm test -- src/modules/vehicle/domain/domain.test.ts src/modules/vehicle/selectors.test.ts src/infrastructure/local/store.test.ts src/infrastructure/sync/sync.test.ts
```

Expected: FAIL on the new v2 contracts/migration.

- [ ] **Step 3: Implement domain constants/types and IndexedDB v2 upgrade**

In `db.ts` upgrade from version 1 to 2 without replacing stores.

For existing records:
- vehicle state: copy `tankCapacityLiters` to `nominalTankCapacityLiters`, remove legacy property;
- fuel entries: copy `liters` to `estimatedLiters`, set three reference snapshot fields null, remove legacy property;
- preserve keys, timestamps, IDs and `syncStatus`.

No new object store or index.

- [ ] **Step 4: Adapt consumption and remaining-fuel engine**

Rules:
- when initial anchor is null, partial entries before the first full entry are not usable as an anchor;
- first full entry establishes an anchor but does not close a cycle;
- a cycle with any unknown `estimatedLiters` is invalid and omitted;
- range ledger returns null after an unknown partial until a later full event;
- a full event always resets internal remaining fuel to nominal capacity;
- keep chronological `(odometerKm, fueledAt)` processing;
- keep per-event capacity clamp.

Do not apply `RANGE_SAFETY_FACTOR` inside `estimateFuelRemaining`.

- [ ] **Step 5: Adapt selector**

`VehicleDashboard.rangeKm` becomes operational/display range:

`theoreticalRange * RANGE_SAFETY_FACTOR`

Fuel percent remains based on internal nominal ledger.

Add:

```ts
rangeState: 'awaiting_full_tank' | 'calibrating' | 'ready'
```

Rules:
- no reliable full anchor -> `awaiting_full_tank`;
- anchor exists but learned consumption/range unavailable -> `calibrating`;
- display range available -> `ready`.

- [ ] **Step 6: Adapt sync mappings**

Remote state:
- `tank_capacity_liters <-> nominalTankCapacityLiters`;
- `initial_full_tank_at <-> string | null`.

Remote fuel:
- do not send legacy `liters`;
- map `estimated_liters`;
- map the three nullable reference snapshot columns.

Hydration converts nullable numeric values without turning null into zero.

- [ ] **Step 7: Keep recording flow compile-compatible temporarily**

Until Task 4 removes the liters field from the UI:
- existing `FuelInput.liters` may remain only as a temporary action input;
- map it to `FuelEntry.estimatedLiters`;
- set reference snapshot fields null;
- existing setup may continue creating a full anchor.

This compatibility exists only to keep this task independently green and is deleted in Task 4.

- [ ] **Step 8: Run GREEN and full suite**

```bash
npm test -- src/modules/vehicle/domain/domain.test.ts src/modules/vehicle/selectors.test.ts src/infrastructure/local/store.test.ts src/infrastructure/sync/sync.test.ts
npm test
npm run build
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "refactor: migrate vehicle domain to estimated fuel"
```

---

### Task 4: Make setup optional-full and fuel recording price-derived

**Files:**
- Modify: `src/modules/vehicle/vehicleActions.ts`
- Modify: `src/modules/vehicle/vehicleActions.test.ts`

**Interfaces:**
- Produces:
```ts
initializeVehicle(
  initialOdometerKm: number,
  initialFullTank: boolean,
  now: string,
): Promise<void>

export type FuelInput = {
  odometerKm: number
  amountCents: number
  fullTank: boolean
  fueledAt: string
}

recordFuel(input: FuelInput, confirmSuspicious?: boolean): Promise<RecordResult>
```
- Consumes `getFuelPriceReference(now: Date)`.

- [ ] **Step 1: Write action RED tests**

Tests:
- setup without full tank saves `initialFullTankAt = null`;
- setup with full tank saves `initialFullTankAt = now`;
- `FuelInput`/record flow contains no manual liters;
- R$ 20.00 at R$ 7.05/L stores `estimatedLiters = 2.837`;
- entry snapshots `precoMedio`, `semanaInicio`, `semanaFim`;
- API/reference failure stores `estimatedLiters = null` and null snapshot fields;
- API failure does not change a valid local result into an error;
- odometer validation and fuel+reading atomicity remain intact;
- full tank can be saved even when price reference is unavailable.

Mock only the fuel-price boundary. Continue using real fake-indexeddb for persistence.

- [ ] **Step 2: Run RED**

```bash
npm test -- src/modules/vehicle/vehicleActions.test.ts
```

Expected: FAIL on v2 signatures/behavior.

- [ ] **Step 3: Implement setup signature**

State:
- `nominalTankCapacityLiters = NOMINAL_TANK_CAPACITY_LITERS`;
- `initialFullTankAt = initialFullTank ? now : null`.

Keep initial state + first odometer reading atomic.

- [ ] **Step 4: Implement price-derived fuel entry**

On valid submit:
- call `getFuelPriceReference(new Date(input.fueledAt))`;
- if reference exists, compute `Math.round(((amountCents / 100) / precoMedio) * 1000) / 1000`;
- snapshot `precoMedio`, `semanaInicio`, `semanaFim`;
- if reference lookup returns null or throws, use null estimation fields;
- continue through `saveFuelAndReadingIfCurrent`.

External lookup failure is swallowed only for price estimation. Persistence/validation failures still surface normally.

- [ ] **Step 5: Remove transitional manual-liters compatibility**

No `liters` property remains in `FuelInput`, action tests or production action logic.

- [ ] **Step 6: Run GREEN and suite**

```bash
npm test -- src/modules/vehicle/vehicleActions.test.ts
npm test
npm run build
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/modules/vehicle/vehicleActions.ts src/modules/vehicle/vehicleActions.test.ts
git commit -m "feat: derive fuel quantity from weekly price"
```

---

### Task 5: Update setup, refuel and dashboard UX

**Files:**
- Modify: `src/modules/vehicle/SetupView.tsx`
- Modify: `src/modules/vehicle/FuelView.tsx`
- Modify: `src/modules/vehicle/HomeView.tsx`
- Modify: `src/modules/vehicle/VehicleModule.tsx`
- Modify: `src/styles/global.css`
- Add/modify focused UI tests only where behavior cannot be covered by action/selector tests.

**Interfaces:**
- Setup calls `initializeVehicle(odometerKm, fullTank, now)`.
- Fuel form submits v2 `FuelInput`.
- Home consumes `VehicleDashboard.rangeState`.

- [ ] **Step 1: Write UI RED tests for required behavior**

Cover:
- setup submits successfully with unchecked `Tanque cheio agora`;
- setup checkbox is optional;
- fuel form contains no `Litros` input;
- fuel checkbox label is `Completei o tanque`;
- `rangeState = awaiting_full_tank` renders `Aguardando tanque cheio`;
- ready range renders with `≈`;
- non-null learned consumption renders with `≈`;
- calibrating behavior remains distinct from awaiting-full-tank.

Do not add a broad UI-testing framework if existing Vitest/jsdom is enough.

- [ ] **Step 2: Run RED**

Run the focused UI test file(s).

Expected: failures reflect current required-full setup, liters field and old Home copy.

- [ ] **Step 3: Update SetupView**

Fields:
- `Hodômetro`
- optional checkbox `Tanque cheio agora`
- `Começar`

Delete the `Confirme o tanque cheio` blocking rule and checkbox `required`.

- [ ] **Step 4: Update FuelView**

Fields:
- `Hodômetro`
- `Valor`
- checkbox `Completei o tanque`
- `Salvar`

Delete all liters state, parsing and input.

Keep suspicious-jump confirmation flow unchanged.

Do not block form interaction while price reference is being refreshed.

- [ ] **Step 5: Update HomeView**

Autonomy:
- `awaiting_full_tank` -> `Aguardando tanque cheio`;
- `calibrating` -> `Calibrando`;
- `ready` -> `≈ {range} km`.

Consumption:
- null -> `Calibrando`;
- value -> `≈ {value} km/L`.

Keep current compact graphite layout. Do not add gauge, confidence bar, extra card or explanatory paragraph.

- [ ] **Step 6: Verify mobile/desktop**

Inspect at least:
- 390 x 844;
- 1440 x 1000.

Check no overflow, no obsolete liters input, optional setup works visually, long `Aguardando tanque cheio` copy does not break hierarchy, and approximation marker remains legible.

- [ ] **Step 7: Run GREEN, suite and build**

```bash
npm test
npm run build
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/modules/vehicle src/styles
git commit -m "feat: simplify vehicle fuel workflow"
```

---

### Task 6: Offline, cache and migration integration verification

**Files:**
- Modify if required by discovered regression: existing focused test files only.
- Modify: `README.md`

**Interfaces:**
- Verifies the completed v2 path without introducing a new subsystem.

- [ ] **Step 1: Run clean technical verification**

```bash
npm ci
npm test
npm run build
```

Expected: all exit 0.

- [ ] **Step 2: Verify local v1 IndexedDB upgrade**

Using a controlled browser/local fixture:
1. create v1 state/fuel rows;
2. load v2;
3. confirm history remains;
4. confirm state has `nominalTankCapacityLiters`;
5. confirm old liters became `estimatedLiters`;
6. confirm reference fields are null.

If this reveals a bug, add a failing migration test before fixing it.

- [ ] **Step 3: Verify weekly cache behavior in browser**

Validate:
- current-week cache causes no request;
- after `semanaFim`, a request occurs;
- same old week does not cause request loops;
- failed refresh retains stale reference;
- 12-hour throttle prevents repeated attempts.

Browser console/network inspection is sufficient; do not add observability infrastructure.

- [ ] **Step 4: Verify offline fuel recording**

Scenario A, cached reference:
- go offline;
- record value + odometer;
- estimated liters are stored from cache;
- row is pending.

Scenario B, no cache:
- clear only fuel-price cache;
- remain offline;
- record value + odometer;
- row saves with null estimation fields;
- row is pending.

Then reconnect and confirm sync marks both records synced without duplication.

- [ ] **Step 5: Verify anchor recovery**

Manual sequence:
- start without full tank -> Home says `Aguardando tanque cheio`;
- record unknown partial -> still no range;
- record `Completei o tanque` -> reliable anchor exists;
- after enough valid consumption data, range becomes available and is displayed with the 0.90 operational factor.

- [ ] **Step 6: Update README**

Document briefly:
- optional-full setup;
- fuel input uses amount rather than manual liters;
- weekly Paragominas/ANP-based reference;
- `VITE_FUEL_PRICE_API_URL`;
- cache is local/disposable;
- autonomy is approximate and conservatively displayed.

Do not expand README into API documentation.

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: document estimated fuel model"
```

---

### Task 7: Production rollout and final verification

**Files:**
- No product-code changes unless a production defect is first reproduced by a failing test.
- Environment/deployment configuration outside git: set `VITE_FUEL_PRICE_API_URL`.

**Interfaces:**
- Produces verified v2 deployment on the existing Control Vault Cloudflare project.

- [ ] **Step 1: Confirm production API base URL**

Before deployment, obtain the actual reachable base URL for the fuel-price API and verify from a browser:

```
GET /v1/precos?uf=PA&municipio=PARAGOMINAS&produto=GASOLINA%20COMUM
```

Expected: JSON matching `FuelPriceReference` and browser CORS access.

Do not deploy with an invented/placeholder host.

- [ ] **Step 2: Configure deployment environment**

Set:
- existing `VITE_SUPABASE_URL`;
- existing `VITE_SUPABASE_PUBLISHABLE_KEY`;
- `VITE_FUEL_PRICE_API_URL`.

No secret/service-role key.

- [ ] **Step 3: Deploy the branch build to the existing Cloudflare project**

Use the currently working deployment path. Do not redesign Git integration during this feature rollout.

- [ ] **Step 4: Run production flows**

Verify:
- existing account login;
- restored/hydrated data;
- existing migrated history;
- setup without full tank on a clean local DB;
- fuel entry with current weekly reference;
- `Completei o tanque`;
- offline entry with cached price;
- offline entry without cache;
- reconnect sync;
- no duplicate remote rows;
- logout/login does not delete local data.

- [ ] **Step 5: Verify production data and security**

Use Supabase tooling/dashboard:
- v2 rows contain estimation snapshot fields;
- legacy `liters` may be null on v2 rows;
- user ownership is correct;
- anonymous access remains denied;
- no RLS/grant regression;
- advisors show no new issues.

- [ ] **Step 6: Verify build output/secrets**

Confirm no:
- Supabase service-role/secret key;
- Cloudflare token;
- password;
- hardcoded privileged credential.

Public publishable key and public fuel-price API URL are expected browser values.

- [ ] **Step 7: Run verification-before-completion**

Use `superpowers:verification-before-completion`.

Evidence required:
- clean working tree;
- full tests green;
- build green;
- production URL healthy;
- online/offline flows verified;
- Supabase remote state verified.

- [ ] **Step 8: Final feature commit/push state**

Do not squash or merge automatically.

Push all commits to `codex/foundation-task-1` and report the complete v2 commit list.

Legacy remote `fuel_entries.liters` removal remains a later cleanup only after production verification; it is not part of this plan.
