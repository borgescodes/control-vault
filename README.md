# Control Vault

Control Vault is a personal, modular control application.

The first module focuses on vehicle fuel tracking, odometer history, consumption learning and estimated remaining range. The product itself is intentionally broader than the first module so future personal-control domains can be added without renaming or rebuilding the application.

## Current status

The product architecture and implementation plan are approved.

Application scaffolding, Supabase configuration and Cloudflare deployment have not been implemented yet. The next implementation work should follow the committed plan task-by-task.

## Vehicle MVP

The first release targets:

- one personal authenticated account;
- one vehicle;
- odometer readings;
- fuel entries;
- fuel spending totals;
- learned consumption;
- calibration state;
- estimated remaining fuel;
- estimated remaining range;
- local-first/offline operation;
- authenticated synchronization with Supabase;
- installable PWA.

Not part of this MVP:

- multiple vehicles;
- public sign-up or multi-user features;
- maintenance;
- taxes;
- insurance;
- financing;
- generic personal expenses;
- OCR/camera input;
- GPS;
- AI assistant.

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

The UI writes locally first. Supabase synchronization is secondary and must not block normal local recording.

Target source layout:

```text
src/
├── app/
├── modules/
│   └── vehicle/
├── shared/
├── infrastructure/
└── styles/
```

## Planned stack

- React
- TypeScript
- Vite
- IndexedDB
- Supabase Auth + Postgres + RLS
- PWA/service worker
- Cloudflare hosting

Dependencies should remain minimal. Browser/platform-native capabilities are preferred when they are sufficient.

## Visual direction

The interface is inspired by Alethe's restrained dark visual language:

- deep graphite surfaces;
- near-monochrome palette;
- off-white primary text;
- minimal borders/cards;
- large numeric metrics;
- sans-serif body text;
- monospace metrics;
- short, subtle motion.

The visual system belongs to Control Vault and should not reference a specific motorcycle model.

Reference: https://github.com/Kc1t/alethe-agents

## Documentation

Approved architecture:

`docs/superpowers/specs/2026-09-29-control-vault-foundation-design.md`

Approved implementation plan:

`docs/superpowers/plans/2026-09-29-control-vault-vehicle-mvp.md`

Agent execution rules:

`AGENTS.md`

## Environment

The browser application will require:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Never commit privileged Supabase keys or provider credentials.

## Implementation

Codex should read `AGENTS.md`, the approved spec and the implementation plan before making changes.

The implementation plan defines the task order, tests, provider configuration and verification criteria.
