# Control Vault

Control Vault is a personal, local-first app. The first module records vehicle odometer readings and fuel entries, learns consumption, and estimates remaining range.

## Vehicle MVP

- One vehicle and one personal authenticated account.
- Manual odometer and fuel records, including offline use.
- Fuel spending, consumption calibration, estimated fuel and range, and history.
- IndexedDB is the operational store; Supabase provides authenticated remote continuity.
- No public sign-up, vehicle registration, maintenance, taxes, insurance, financing, OCR, GPS, or predictive AI.

## Architecture

```text
UI
 ↓
vehicle domain
 ↓
IndexedDB
 ↓
sync queue
 ↓
Supabase Auth + RLS
 ↓
Supabase Postgres
```

The UI writes locally first. Remote synchronization does not block recording.

## Stack

React, TypeScript, Vite, IndexedDB (`idb`), Supabase Auth/Postgres, Vitest, and PWA support. Styling uses plain CSS and browser capabilities are preferred over extra dependencies.

## Local setup

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Set these values in `.env.local` when Supabase is configured:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Only the Supabase publishable key belongs in the browser. Never commit `.env.local` or privileged credentials.

## Project decisions

- [Foundation spec](docs/superpowers/specs/2026-09-29-control-vault-foundation-design.md)
- [Vehicle MVP implementation plan](docs/superpowers/plans/2026-09-29-control-vault-vehicle-mvp.md)
