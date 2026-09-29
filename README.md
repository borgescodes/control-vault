# Control Vault

Control Vault is a personal, local-first app. The first module records vehicle odometer readings and fuel entries, learns consumption, and estimates remaining range.

## Vehicle MVP

- One vehicle and one personal authenticated account.
- Manual odometer and fuel records, including offline use.
- Fuel spending, consumption calibration, estimated fuel and range, and history.
- IndexedDB is the operational store; Supabase provides authenticated remote continuity.
- No public sign-up, vehicle registration, maintenance, taxes, insurance, financing, OCR, GPS, or predictive AI.

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
financing, insurance, general finance, OCR/camera, GPS and predictive AI.

## Project decisions

- [Foundation spec](docs/superpowers/specs/2026-09-29-control-vault-foundation-design.md)
- [Vehicle MVP implementation plan](docs/superpowers/plans/2026-09-29-control-vault-vehicle-mvp.md)
