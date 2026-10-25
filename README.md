# Control Vault

<img src="public/logo.png" alt="Control Vault" width="96" height="96" />

Control Vault is a personal, local-first app. The vehicle module records odometer readings and fuel spending, records measured pump liters, learns consumption from complete measured cycles, and estimates remaining range.

## Vehicle MVP

- One vehicle and one personal authenticated account.
- Setup requires the current odometer; a full tank is optional.
- Fuel recording requires odometer, amount paid, liters reported by the pump, and whether the tank ended full.
- Liters are entered from the pump. The paid price per liter is derived locally from amount / measured liters; no public pricing service is needed.
- Fuel spending, approximate consumption, estimated fuel and conservative operational range, and history.
- IndexedDB is the operational store; Supabase provides authenticated remote continuity.
- No public sign-up, vehicle registration, maintenance, taxes, insurance, financing, OCR, GPS, or predictive AI.

## Measured pump liters and historical calibration

The tank capacity is **3.0 L**. A fuel entry records amount in integer cents and confirmed liters (up to three decimal places). New registrations work without network access. Price per liter and trip costs are derived from recorded fills.

The historical ANP-derived `estimated_liters` and reference-week fields remain intact for historical viewing and provisional range during the transition. The existing `fuel_entries.liters` column represents only verified readings from the pump; legacy unknown volumes remain null, never silently converted to measurements.

New consumption calibration starts at the first measured full-tank entry and uses only complete full-to-full intervals with every intervening fill measured. Once there is at least one complete measured cycle, historical ANP estimates no longer influence learned consumption. Until then, previous consumption/range is provisional and labeled low confidence.

Manual odometer readings can be corrected in History and optionally flagged when the tank was observed empty. An empty observation is an anchor for subsequent fuel balance, not a claim of sensor precision. Range remains an estimate based on consumption between recorded events.

## Offline-first

```text
UI
 ↓
IndexedDB
 ↓
pending sync
 ↓
Supabase
```

The UI reads and writes IndexedDB. Supabase provides authenticated continuity
when a connection is available. Odometer and fuel records remain available
offline, and failed synchronization leaves them pending for the next run.

Every sync pushes pending IDs and then reads all owned server records, including when the local database already contains data. Supabase holds confirmed cross-device records; IndexedDB preserves offline work until acknowledgment. Sync runs after login, local writes, reconnection, focus and visible resume. Pending local writes survive remote merges; another account cannot open the bound personal database.

The header shows `ON` only after successful confirmation, `OFF` without connectivity and `SYNC` for pending, running, failed or unconfirmed synchronization. Remote failures preserve the queue and expose retry. Local save feedback is distinct from server confirmation.

Navigation uses native browser history at `/`, `/abastecer`, `/hodometro` and `/historico`. The fixed bottom navigation reserves content space and hides while a form input is focused. Installation appears when supported; iOS provides home-screen instructions on request. New worker versions expose `Atualizar app` instead of reloading a form automatically.

For the reproducible browser check, build and serve the production bundle on `127.0.0.1:5176`, then run `node tests/browser-reliability.cjs` with Playwright available (`PLAYWRIGHT_MODULE` may point to the bundled installation). It uses real browser storage and service workers with isolated Auth/Data API fixtures; it never writes test records to the personal Supabase project. See `docs/reports/2026-10-01-technical-review.md` for evidence and live-device limitations.

Offline refueling records include the liters explicitly entered from the pump. Historical reference estimates remain readable after synchronization.

## Stack

React, TypeScript, Vite, IndexedDB (`idb`), Supabase Auth/Postgres, Vitest, and PWA support. Styling uses plain CSS and browser capabilities are preferred over extra dependencies.

## Local development

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Only the Supabase publishable key belongs in the browser. Never commit `.env.local` or privileged credentials.

Fuel recording never depends on an external price API.

## Tests

```bash
npm test
npm run build
```

## Supabase

The existing `control-vault` project provides single-user Auth and Postgres
continuity. Public application tables have ownership-based RLS. Schema changes
live in versioned migrations under `supabase/migrations`. The frontend uses no
privileged key. Follow the required manual account setup and keep public signup
and anonymous sign-ins disabled as documented in [supabase/README.md](supabase/README.md).

## Cloudflare

Production: https://control-vault.pages.dev

- Production branch: `main`
- Build command: `npm run build`
- Output directory: `dist`
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

## Scope

The MVP supports one personal account and one vehicle. It excludes public
signup, profiles, roles, collaboration, multiple vehicles, maintenance, taxes,
financing, insurance, general finance, configurable fuel market, OCR/camera, GPS and predictive AI.

## Project decisions

- [Foundation spec](docs/superpowers/specs/2026-09-29-control-vault-foundation-design.md)
- [Vehicle MVP implementation plan](docs/superpowers/plans/2026-09-29-control-vault-vehicle-mvp.md)
- [Vehicle model v2 spec](docs/superpowers/specs/2026-09-29-control-vault-vehicle-model-v2-design.md)
- [Vehicle model v2 implementation plan](docs/superpowers/plans/2026-09-29-control-vault-vehicle-model-v2.md)
