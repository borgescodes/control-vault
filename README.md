# Control Vault

Control Vault is a personal, local-first app. The vehicle module records odometer readings and fuel spending, estimates fuel quantity from a weekly municipal gasoline reference, learns approximate consumption, and estimates remaining range.

## Vehicle MVP

- One vehicle and one personal authenticated account.
- Setup requires the current odometer; a full tank is optional.
- Fuel recording requires odometer, amount paid, and whether the tank ended full.
- Liters are estimated from the weekly average price for `PA / PARAGOMINAS / GASOLINA COMUM`; there is no manual liters field.
- Fuel spending, approximate consumption, estimated fuel and conservative operational range, and history.
- IndexedDB is the operational store; Supabase provides authenticated remote continuity.
- No public sign-up, vehicle registration, maintenance, taxes, insurance, financing, OCR, GPS, or predictive AI.

## Fuel price reference

The browser reads a public weekly fuel-price API configured with:

```env
VITE_FUEL_PRICE_API_URL=
```

The response is cached locally using the source week interval (`semanaInicio` through `semanaFim`). The cache is disposable browser state and is not synchronized to Supabase.

Each fuel entry stores the exact reference snapshot used for its estimate. If no usable reference is available, the expense and odometer are still saved with unknown estimated liters. A later full-tank entry can re-establish a reliable range anchor.

Range and consumption are approximate. The operational range shown in the UI applies a conservative display margin without modifying learned consumption or the internal nominal fuel ledger.

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

With a cached weekly fuel reference, offline fuel entries can still receive an estimated quantity. Without a cached reference, the local record still succeeds and synchronizes later with null estimation fields.

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
VITE_FUEL_PRICE_API_URL=
```

Only the Supabase publishable key belongs in the browser. Never commit `.env.local` or privileged credentials.

If the fuel-price API URL is absent or unavailable, fuel recording continues without a price-derived quantity.

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
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_FUEL_PRICE_API_URL`

## Scope

The MVP supports one personal account and one vehicle. It excludes public
signup, profiles, roles, collaboration, multiple vehicles, maintenance, taxes,
financing, insurance, general finance, manual liters entry, configurable fuel market, OCR/camera, GPS and predictive AI.

## Project decisions

- [Foundation spec](docs/superpowers/specs/2026-09-29-control-vault-foundation-design.md)
- [Vehicle MVP implementation plan](docs/superpowers/plans/2026-09-29-control-vault-vehicle-mvp.md)
- [Vehicle model v2 spec](docs/superpowers/specs/2026-09-29-control-vault-vehicle-model-v2-design.md)
- [Vehicle model v2 implementation plan](docs/superpowers/plans/2026-09-29-control-vault-vehicle-model-v2.md)
