# Control Vault Vehicle MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Control Vault release as a single-user, local-first PWA whose first module records odometer and fuel data, learns consumption, estimates remaining range, and securely synchronizes with Supabase.

**Architecture:** One React + TypeScript + Vite application with a modular `vehicle` domain. The UI reads and writes IndexedDB first; pure domain functions derive consumption and range; authenticated Supabase synchronization runs as secondary continuity infrastructure. Cloudflare hosts the static PWA.

**Tech Stack:** React, TypeScript, Vite, Vitest, IndexedDB via `idb`, Supabase JS, Supabase Auth + Postgres + RLS, `vite-plugin-pwa`, plain CSS, Cloudflare.

**Spec:** `docs/superpowers/specs/2026-09-29-control-vault-foundation-design.md`

## Global Constraints

- Product is `Control Vault`; `vehicle` is only the first module.
- Single personal account only. No public sign-up, profiles, roles, collaboration, or multi-user UX.
- One vehicle only. No vehicle-registration UI.
- No maintenance, taxes, financing, insurance, generic expenses, OCR, GPS, AI assistant, fuel-price API, or speculative future modules.
- Local write succeeds before remote sync is attempted.
- Manual input must work offline after the app has been loaded.
- Browser uses only the Supabase publishable/public key. Never expose `service_role` or secret keys.
- Every exposed Supabase table has RLS and ownership checks using `auth.uid()`.
- No state-management library unless React state becomes demonstrably insufficient.
- No generalized repository layer, event sourcing, plugin system, or multi-tenant design.
- Use platform/native features before dependencies; dependencies must materially reduce complexity.
- Persist money as integer cents.
- Generate record IDs client-side with `crypto.randomUUID()`.
- UI copy is short and operational. No explanatory helper text for obvious controls.
- Visual system: graphite background, near-monochrome palette, off-white text, restrained borders, Inter-like sans, monospace metrics, short motion, no motorcycle-specific branding, no fintech/neon aesthetic.
- Alethe visual reference: `https://github.com/Kc1t/alethe-agents`.
- Use Superpowers for execution discipline and Ponytail `full` for YAGNI/minimalism.
- Use the connected Supabase plugin for current Supabase docs/configuration and the connected Cloudflare plugin for deployment operations.
- Supabase implementation must verify current documentation before schema/auth changes because provider behavior changes over time.
- Commit the lockfile.
- One meaningful commit per task.

## Review Focus

- Odometer regression: values lower than the latest accepted reading must be rejected before persistence.
- Suspicious odometer jump: a large positive jump must require explicit confirmation instead of being silently accepted or blocked.
- Partial refills between full-tank anchors: all liters in the interval must contribute to that consumption cycle.
- Expired/missing auth while local data is pending: local records must remain intact and pending until sign-in resumes.
- Duplicate sync retry: re-sending the same client-generated ID must remain idempotent and must not create duplicate remote rows.

---

### Task 1: Repository foundation and Codex guardrails

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/styles/global.css`
- Create: `src/vite-env.d.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `AGENTS.md`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: runnable React/Vite app, `npm run dev`, `npm run build`, `npm test`.
- Produces environment contract: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

- [ ] **Step 1: Initialize the minimum Vite React TypeScript app**

Use the current stable Vite React TypeScript scaffold, then remove starter/demo assets and styles.

Install only:
- runtime: `react`, `react-dom`, `@supabase/supabase-js`, `idb`
- build/PWA: `vite-plugin-pwa`
- test: `vitest`, `jsdom`, `fake-indexeddb`
- normal Vite/TypeScript React tooling required by the scaffold

Do not add Redux, Zustand, Tailwind, shadcn, React Query, router, form library, date library, CSS framework, ESLint plugin packs, or Prettier in this task.

- [ ] **Step 2: Define scripts**

`package.json` scripts:
- `dev`: Vite dev server
- `build`: TypeScript project build followed by Vite build
- `test`: `vitest run`
- `test:watch`: `vitest`

- [ ] **Step 3: Add the repository handoff docs**

`AGENTS.md` must tell Codex to:
- read the approved spec and this plan first;
- use Superpowers before implementation work;
- keep Ponytail `full` active;
- execute tasks in plan order;
- use TDD for non-trivial domain/sync behavior;
- use Supabase and Cloudflare plugins for provider changes;
- never expand MVP scope without explicit approval;
- never commit secrets;
- keep the UI copy minimal;
- commit after each task and verify before claiming completion.

`README.md` must include:
- Control Vault purpose;
- current `vehicle` MVP scope;
- local-first architecture diagram;
- stack;
- local setup;
- required env vars;
- links to the spec and implementation plan.

- [ ] **Step 4: Add CI**

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`:
1. checkout;
2. setup supported Node LTS;
3. `npm ci`;
4. `npm test`;
5. `npm run build`.

No deployment workflow yet.

- [ ] **Step 5: Verify scaffold**

Run:
```bash
npm ci
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: initialize Control Vault foundation"
```

### Task 2: Supabase project schema, Auth boundary and RLS

**Files:**
- Create via Supabase CLI: `supabase/migrations/<generated>_initial_vehicle_schema.sql`
- Create: `supabase/README.md`

**Interfaces:**
- Produces remote tables: `vehicle_state`, `odometer_readings`, `fuel_entries`.
- Produces ownership contract: every row belongs to `auth.uid()`.
- Produces one manually-created personal Auth user; no sign-up UX.

- [ ] **Step 1: Inspect the target Supabase project using the Supabase plugin**

Verify:
- project reference and URL;
- current Auth configuration;
- Data API exposure behavior;
- current docs/changelog relevant to Auth, publishable keys and RLS.

Do not write schema until the current provider behavior is confirmed.

- [ ] **Step 2: Create the migration file using Supabase CLI**

Run the current CLI help first, then create the migration with the CLI equivalent of:

```bash
supabase migration new initial_vehicle_schema
```

Do not invent a timestamped migration filename manually.

- [ ] **Step 3: Define the schema**

`vehicle_state`:
- `user_id uuid primary key references auth.users(id) on delete cascade`
- `tank_capacity_liters numeric(6,3) not null check (tank_capacity_liters > 0)`
- `initial_odometer_km numeric(10,1) not null check (initial_odometer_km >= 0)`
- `initial_full_tank_at timestamptz not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`odometer_readings`:
- `id uuid primary key`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `reading_km numeric(10,1) not null check (reading_km >= 0)`
- `recorded_at timestamptz not null`
- `source text not null check (source in ('manual','fuel_entry'))`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- index on `(user_id, recorded_at desc)`

`fuel_entries`:
- `id uuid primary key`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `odometer_km numeric(10,1) not null check (odometer_km >= 0)`
- `amount_cents integer not null check (amount_cents > 0)`
- `liters numeric(7,3) not null check (liters > 0)`
- `full_tank boolean not null default false`
- `fueled_at timestamptz not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- index on `(user_id, fueled_at desc)`

Do not add delete/tombstone columns.

- [ ] **Step 4: Enable RLS and add ownership policies**

For all three tables:
- enable RLS;
- allow `select`, `insert`, and `update` only to `authenticated`;
- every policy checks `(select auth.uid()) = user_id`;
- update policies use both `USING` and `WITH CHECK`;
- do not create anonymous write policies;
- do not add delete policy in the MVP.

Grant Data API access only as required by the project’s current API settings and verified Supabase guidance.

- [ ] **Step 5: Apply and verify through Supabase tooling**

Use the Supabase plugin/CLI to apply the schema.

Verify:
- anonymous requests cannot read/write rows;
- authenticated user can insert/select/update own rows;
- ownership mismatch is denied;
- update cannot reassign `user_id`;
- duplicate `id` upsert updates one row rather than creating a second row.

Run Supabase advisors and fix relevant security/performance warnings before committing.

- [ ] **Step 6: Create the single personal user**

Create one user manually in Supabase Auth with email/password.

No credentials go into the repository. `supabase/README.md` documents only the operator step.

- [ ] **Step 7: Commit**

```bash
git add supabase
git commit -m "feat: add secure vehicle schema"
```

### Task 3: Supabase client and minimal authentication gate

**Files:**
- Create: `src/infrastructure/supabase/client.ts`
- Create: `src/infrastructure/auth/session.ts`
- Create: `src/app/LoginView.tsx`
- Modify: `src/app/App.tsx`
- Create: `src/infrastructure/auth/session.test.ts`

**Interfaces:**
- Produces: `supabase` browser client.
- Produces: `signIn(email: string, password: string): Promise<void>`
- Produces: `signOut(): Promise<void>`
- Produces: `getCachedSession(): Promise<Session | null>`
- Produces: `subscribeToAuth(callback): () => void`

- [ ] **Step 1: Write the session-state tests**

Test names/assertions:
- `returns_null_when_no_cached_session_exists`
- `keeps_local_app_state_available_when_network_is_offline_but_cached_session_exists`
- `sign_in_surfaces_auth_error_without_mutating_local_data`

Use a small Supabase client stub. Do not create a generic auth adapter interface.

- [ ] **Step 2: Run the auth tests and confirm failure**

Run:
```bash
npm test -- src/infrastructure/auth/session.test.ts
```

Expected: FAIL because auth functions do not exist.

- [ ] **Step 3: Implement the minimal Supabase client/session helpers**

`client.ts` reads only:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Throw a clear startup error if either variable is missing.

Use Supabase's normal browser session persistence. Do not add custom token storage.

- [ ] **Step 4: Implement LoginView**

Fields:
- `Email`
- `Senha`

Action:
- `Entrar`

No sign-up, reset-password, social login, onboarding or explanatory prose.

- [ ] **Step 5: Gate the app**

Behavior:
- valid/cached session: open app shell;
- no session while online: show LoginView;
- sign-out returns to LoginView;
- local database is never cleared on sign-out.

- [ ] **Step 6: Verify**

Run:
```bash
npm test -- src/infrastructure/auth/session.test.ts
npm run build
```

Expected: PASS and build exits 0.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: add personal auth boundary"
```

### Task 4: Local IndexedDB persistence

**Files:**
- Create: `src/infrastructure/local/db.ts`
- Create: `src/infrastructure/local/store.ts`
- Create: `src/infrastructure/local/store.test.ts`
- Create: `src/modules/vehicle/domain/types.ts`

**Interfaces:**
- Produces domain types: `VehicleState`, `OdometerReading`, `FuelEntry`.
- Produces local wrapper type: `SyncStatus = 'pending' | 'synced'`.
- Produces:
  - `saveVehicleState(state): Promise<void>`
  - `getVehicleState(): Promise<LocalVehicleState | null>`
  - `saveOdometerReading(reading): Promise<void>`
  - `listOdometerReadings(): Promise<LocalOdometerReading[]>`
  - `saveFuelEntry(entry): Promise<void>`
  - `listFuelEntries(): Promise<LocalFuelEntry[]>`
  - `listPending(): Promise<PendingRecord[]>`
  - `markSynced(kind, id): Promise<void>`
  - `isLocalDatabaseEmpty(): Promise<boolean>`

- [ ] **Step 1: Define domain records**

`VehicleState`:
- `tankCapacityLiters: number`
- `initialOdometerKm: number`
- `initialFullTankAt: string`
- `createdAt: string`
- `updatedAt: string`

`OdometerReading`:
- `id: string`
- `readingKm: number`
- `recordedAt: string`
- `source: 'manual' | 'fuel_entry'`
- `createdAt: string`
- `updatedAt: string`

`FuelEntry`:
- `id: string`
- `odometerKm: number`
- `amountCents: number`
- `liters: number`
- `fullTank: boolean`
- `fueledAt: string`
- `createdAt: string`
- `updatedAt: string`

- [ ] **Step 2: Write failing local-store tests**

Using `fake-indexeddb`, assert:
- a newly saved record is returned immediately;
- new local records default to `pending`;
- `markSynced` changes only the targeted record;
- records survive closing and reopening the DB;
- `listPending` returns pending state/readings/fuel entries;
- stable IDs are preserved.

- [ ] **Step 3: Run tests and confirm failure**

Run:
```bash
npm test -- src/infrastructure/local/store.test.ts
```

Expected: FAIL because local DB/store do not exist.

- [ ] **Step 4: Implement database version 1**

Database name: `control-vault`.

Object stores:
- `vehicle_state` keyed by constant `primary`;
- `odometer_readings` keyed by `id`;
- `fuel_entries` keyed by `id`.

Keep `syncStatus` as local persistence metadata. Do not create a separate sync-queue store.

- [ ] **Step 5: Verify**

Run:
```bash
npm test -- src/infrastructure/local/store.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/local src/modules/vehicle/domain/types.ts
git commit -m "feat: add local-first persistence"
```

### Task 5: Vehicle domain calculations

**Files:**
- Create: `src/modules/vehicle/domain/config.ts`
- Create: `src/modules/vehicle/domain/odometer.ts`
- Create: `src/modules/vehicle/domain/consumption.ts`
- Create: `src/modules/vehicle/domain/fuelEstimate.ts`
- Create: `src/modules/vehicle/domain/domain.test.ts`

**Interfaces:**
- Produces: `TANK_CAPACITY_LITERS = 3`
- Produces: `SUSPICIOUS_ODOMETER_DELTA_KM = 500`
- Produces: `validateOdometer(latestKm: number | null, nextKm: number): OdometerValidation`
- Produces: `buildConsumptionCycles(initialAnchor, fuelEntries): ConsumptionCycle[]`
- Produces: `learnConsumption(cycles): ConsumptionEstimate | null`
- Produces: `estimateFuelRemaining(input): FuelEstimate | null`

- [ ] **Step 1: Write odometer tests**

Assertions:
- `latest=null, next=100 -> valid`;
- `latest=100, next=99.9 -> invalid`;
- `latest=100, next=100 -> valid`;
- `latest=100, next=599.9 -> valid`;
- `latest=100, next=600.1 -> suspicious`.

`OdometerValidation`:
```ts
type OdometerValidation =
  | { kind: 'valid'; deltaKm: number }
  | { kind: 'suspicious'; deltaKm: number }
  | { kind: 'invalid'; deltaKm: number };
```

- [ ] **Step 2: Write consumption-cycle tests**

Given initial full anchor at 1000 km:
- partial fill at 1040 km: 1.0 L;
- partial fill at 1080 km: 0.5 L;
- full fill at 1120 km: 1.5 L;

assert one cycle:
- `distanceKm === 120`;
- `fuelUsedLiters === 3.0`;
- `kmPerLiter === 40`.

Then add a second full-tank interval and assert a second independent cycle is produced.

- [ ] **Step 3: Write learning/calibration tests**

Use the most recent five cycles maximum.

Consumption estimate is the median `kmPerLiter` of those cycles.

Calibration:
- 0 cycles -> `calibrating`;
- 1-2 cycles -> `estimated`;
- 3+ cycles -> `calibrated` only when the relative spread of the most recent three cycles, `(max - min) / median`, is <= `0.20`;
- otherwise -> `estimated`.

- [ ] **Step 4: Write fuel-estimate tests**

With:
- tank capacity 3 L;
- latest full-tank anchor at 1000 km;
- learned consumption 40 km/L;
- current odometer 1040 km;

assert:
- 1 L consumed;
- 2 L estimated remaining;
- 80 km estimated range;
- 66.67% estimated fuel.

Add:
- partial fill after anchor adds liters but clamps at 3 L;
- no full anchor returns `null`;
- no learned consumption returns `null`;
- current odometer below anchor is rejected.

- [ ] **Step 5: Run tests and confirm failure**

Run:
```bash
npm test -- src/modules/vehicle/domain/domain.test.ts
```

Expected: FAIL because domain functions do not exist.

- [ ] **Step 6: Implement the minimum pure functions**

Rules:
- no classes;
- no services;
- no dependency on React, IndexedDB or Supabase;
- sort copies of input arrays rather than mutating caller data;
- clamp fuel remaining to `0..tankCapacityLiters`.

- [ ] **Step 7: Verify**

Run:
```bash
npm test -- src/modules/vehicle/domain/domain.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/vehicle/domain
git commit -m "feat: add vehicle calculation engine"
```

### Task 6: Initial setup, odometer and refueling flows

**Files:**
- Create: `src/modules/vehicle/VehicleModule.tsx`
- Create: `src/modules/vehicle/SetupView.tsx`
- Create: `src/modules/vehicle/OdometerView.tsx`
- Create: `src/modules/vehicle/FuelView.tsx`
- Create: `src/modules/vehicle/HistoryView.tsx`
- Create: `src/modules/vehicle/vehicleActions.ts`
- Create: `src/modules/vehicle/vehicleActions.test.ts`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Produces: `initializeVehicle(initialOdometerKm: number, now: string): Promise<void>`
- Produces: `recordOdometer(readingKm: number, recordedAt: string, confirmSuspicious?: boolean): Promise<RecordResult>`
- Produces: `recordFuel(input: FuelInput): Promise<RecordResult>`

- [ ] **Step 1: Write action tests**

Assert:
- initialization persists `tankCapacityLiters=3`, initial odometer and full-tank time locally;
- initialization also creates the initial manual odometer reading;
- odometer regression does not write;
- suspicious odometer jump returns `requires_confirmation` without writing;
- same suspicious value writes when `confirmSuspicious=true`;
- fuel entry saves the fuel record and a matching `fuel_entry` odometer reading in one action;
- fuel entry with `amountCents <= 0` or `liters <= 0` is rejected.

No remote Supabase call belongs in these actions.

- [ ] **Step 2: Run tests and confirm failure**

Run:
```bash
npm test -- src/modules/vehicle/vehicleActions.test.ts
```

Expected: FAIL because vehicle actions do not exist.

- [ ] **Step 3: Implement actions**

Use `crypto.randomUUID()`.

Use ISO timestamps.

When a fuel entry and its odometer reading are created, persist both locally before returning success.

If either local write fails, surface failure and do not claim success.

- [ ] **Step 4: Implement minimal screens**

Setup:
- `Hodômetro`
- checkbox `Tanque cheio`
- action `Começar`
- require the checkbox for initialization.

Odometer:
- `Hodômetro`
- action `Salvar`
- suspicious jump confirmation uses a compact confirmation state, not explanatory onboarding copy.

Fuel:
- `Hodômetro`
- `Valor`
- `Litros`
- toggle `Tanque cheio`
- action `Salvar`

History:
- chronological combined list of odometer and fuel records;
- no edit/delete in MVP.

Use native number/date inputs where practical. No form library.

- [ ] **Step 5: Verify**

Run:
```bash
npm test -- src/modules/vehicle/vehicleActions.test.ts
npm run build
```

Expected: PASS and build exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/modules/vehicle src/app/App.tsx
git commit -m "feat: add vehicle recording flows"
```

### Task 7: Home dashboard and visual system

**Files:**
- Create: `src/modules/vehicle/HomeView.tsx`
- Create: `src/modules/vehicle/selectors.ts`
- Create: `src/modules/vehicle/selectors.test.ts`
- Modify: `src/modules/vehicle/VehicleModule.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Produces: `getVehicleDashboard(state, readings, fuelEntries): VehicleDashboard`
- Produces view navigation: `home | odometer | fuel | history`.

- [ ] **Step 1: Write dashboard-selector tests**

Assert:
- current odometer uses latest reading;
- current-month spend is the sum of `amountCents` for fuel entries in the current calendar month;
- consumption/range are unavailable during `calibrating` when no complete cycle exists;
- consumption appears in `estimated` after one cycle;
- range uses the latest valid full-tank anchor plus partial fills and latest odometer;
- records from another month do not affect current-month spend.

Use a fixed `now` parameter so tests are deterministic.

- [ ] **Step 2: Run tests and confirm failure**

Run:
```bash
npm test -- src/modules/vehicle/selectors.test.ts
```

Expected: FAIL because selector does not exist.

- [ ] **Step 3: Implement selector**

`VehicleDashboard` exposes only display-ready data:
- `odometerKm`;
- `monthSpendCents`;
- `consumptionKmPerLiter | null`;
- `calibrationState`;
- `fuelPercent | null`;
- `rangeKm | null`.

Use `Intl.NumberFormat('pt-BR', ...)` in the view, not in domain logic.

- [ ] **Step 4: Implement visual tokens**

Start with:
```css
--bg: #101114;
--surface: #1a1c1f;
--surface-elevated: #1f2125;
--fg: #f3f4f6;
--muted: #8b8b95;
--faint: #6b6b75;
--border: rgba(243, 244, 246, 0.08);
--danger: #ef4444;
--warning: #f59e0b;
--success: #10b981;
```

Typography:
- general: `Inter, ui-sans-serif, system-ui, sans-serif`;
- metrics: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.

Do not add external font packages in the first visual pass.

Motion:
- 140-220 ms;
- opacity/background/transform only;
- respect `prefers-reduced-motion`.

- [ ] **Step 5: Implement Home**

Primary visual hierarchy:
1. `Autonomia` with large range value when available;
2. calibration state when range is unavailable;
3. estimated fuel percentage;
4. `Consumo`;
5. `Hodômetro`;
6. current-month spend;
7. actions `Atualizar KM` and `Abastecer`;
8. minimal navigation to `Início` and `Histórico`.

Do not add helper paragraphs, charts, illustrations, motorcycle branding, gradients or decorative cards.

- [ ] **Step 6: Verify**

Run:
```bash
npm test -- src/modules/vehicle/selectors.test.ts
npm run build
```

Expected: PASS and build exits 0.

Manually verify at a mobile viewport:
- no horizontal overflow;
- main data readable without zoom;
- primary actions reachable with one hand;
- dark palette remains legible.

- [ ] **Step 7: Commit**

```bash
git add src/modules/vehicle src/styles
git commit -m "feat: add minimal vehicle dashboard"
```

### Task 8: Authenticated Supabase synchronization

**Files:**
- Create: `src/infrastructure/sync/sync.ts`
- Create: `src/infrastructure/sync/sync.test.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/infrastructure/local/store.ts`

**Interfaces:**
- Produces: `syncPending(userId: string): Promise<SyncResult>`
- Produces: `hydrateFromRemoteIfLocalEmpty(userId: string): Promise<void>`
- Produces: `runSync(userId: string): Promise<SyncResult>`

- [ ] **Step 1: Write sync tests**

Use a Supabase client stub plus fake IndexedDB.

Assert:
- pending local record is upserted with current `user_id`;
- successful upsert marks only that local record `synced`;
- failed upsert leaves the record `pending`;
- retrying the same ID does not create a second remote row;
- missing auth/user ID performs no remote write and leaves local data pending;
- when local DB is empty, remote rows hydrate local stores as `synced`;
- when local DB is not empty, remote hydration is skipped in MVP.

The last rule intentionally avoids building multi-device conflict resolution.

- [ ] **Step 2: Run tests and confirm failure**

Run:
```bash
npm test -- src/infrastructure/sync/sync.test.ts
```

Expected: FAIL because sync functions do not exist.

- [ ] **Step 3: Implement push-first sync**

For each pending local entity:
- map camelCase local fields to remote snake_case fields;
- attach current `user_id`;
- use idempotent Supabase upsert on the stable primary key;
- mark local record synced only after success.

No background polling loop.

- [ ] **Step 4: Implement fresh-install hydration**

If local DB is empty and the app is online/authenticated:
- fetch `vehicle_state`;
- fetch odometer readings;
- fetch fuel entries;
- save them locally as `synced`.

If any local data already exists, do not merge remote changes in the MVP.

- [ ] **Step 5: Trigger sync minimally**

Run sync:
- after successful authentication;
- after app becomes online;
- after a successful local write when online.

Use browser `online` event. Do not add a connectivity library.

Prevent overlapping sync runs with one module-level in-flight Promise or boolean. No job scheduler.

- [ ] **Step 6: Verify**

Run:
```bash
npm test -- src/infrastructure/sync/sync.test.ts
npm test
npm run build
```

Expected: all PASS and build exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/sync src/infrastructure/local src/app/App.tsx
git commit -m "feat: sync local vehicle data to Supabase"
```

### Task 9: PWA behavior and Cloudflare deployment

**Files:**
- Modify: `vite.config.ts`
- Create: `public/pwa-192.png`
- Create: `public/pwa-512.png`
- Modify: `README.md`

**Interfaces:**
- Produces installable PWA.
- Produces Cloudflare deployment from `main` with `dist` as build output.

- [ ] **Step 1: Configure `vite-plugin-pwa`**

Manifest:
- name: `Control Vault`
- short_name: `Control Vault`
- theme/background color: `#101114`
- display: `standalone`

Cache the application shell/static assets.

Do not cache Supabase API responses as application data. IndexedDB remains the offline data store.

- [ ] **Step 2: Add minimal PWA icons**

Create simple monochrome `CV` placeholder icons at 192 and 512 pixels.

Do not design a brand/logo system in this task.

- [ ] **Step 3: Verify offline shell**

Build and serve the production bundle.

After one successful online load:
- switch browser offline;
- reload;
- app shell opens;
- cached local records remain visible;
- new odometer/fuel records can be saved locally;
- sync remains pending.

- [ ] **Step 4: Configure Cloudflare using the connected plugin**

Create/link the static frontend project to `borgescodes/control-vault`.

Required configuration:
- branch: `main`;
- build command: `npm run build`;
- output directory: `dist`;
- environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

Use current Cloudflare product defaults/capabilities discovered through the plugin. Do not commit provider tokens or secrets.

- [ ] **Step 5: Verify production**

On the deployed URL verify:
- sign-in works;
- no sign-up UI exists;
- create odometer record online;
- create fuel record online;
- go offline and create another record;
- reconnect and observe sync;
- duplicate retry does not duplicate rows;
- anonymous direct Data API access is blocked by RLS;
- PWA installs successfully;
- no privileged Supabase key appears in built assets.

- [ ] **Step 6: Update README**

Document:
- local run;
- Supabase operator setup;
- Cloudflare deployment;
- offline-first behavior;
- current non-goals.

- [ ] **Step 7: Final verification**

Run:
```bash
npm ci
npm test
npm run build
```

Use Superpowers verification-before-completion before claiming the MVP foundation is ready.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: ship Control Vault PWA foundation"
```
