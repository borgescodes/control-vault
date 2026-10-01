# Control Vault reliability implementation plan

> Execute with superpowers:executing-plans, task by task, using TDD and Ponytail full.

**Goal:** reliable cross-device continuity, explicit sync feedback, native mobile navigation and usable PWA installation/update.
**Architecture:** retain React, native browser APIs, IndexedDB and direct authenticated Supabase. No new product modules or dependencies.
**Spec:** docs/superpowers/specs/2026-10-01-control-vault-reliability-design.md

## Constraints and review focus

- Preserve pending records, auth ownership, cents, IDs, domain calculations and supplied branding.
- Protect writes arriving during sync, failed multi-table pulls, more than 1,000 remote rows, direct routes and unsaved form values during PWA updates.
- No production data modifications for synthetic tests, no schema/RLS changes without evidence, no merge to main.

## Task 1 — synchronization and local merge (Sol / Extra high)

Files: src/infrastructure/local/{db,store,store.test}.ts; src/infrastructure/sync/{sync,sync.test}.ts.
Interfaces: mergeRemoteVehicleData(data), markSynced(kind,id,expectedRecord?), claimSyncOwner(userId), subscribeToLocalChanges(listener); sync activity includes unconfirmed/error states.
- [x] Add failing tests for repeated remote fetch, concurrent local writes, pending preservation, failed read atomicity, owner binding and pagination.
- [x] Push pending records and fetch/merge owned rows, insert-only vehicle setup, snapshot-safe acknowledgments; safe diagnostics.
- [x] Run focused tests, npm test and npm run build; commit.

## Task 2 — lifecycle and feedback (Sol / Extra high)

Files: src/app/{App,App.test}.tsx; src/shared/ui/ConnectionIndicator{,.test}.tsx; src/modules/vehicle/{VehicleModule,vehicleActions}.tsx/.ts; src/styles/global.css.
- [x] Add failing tests for textual ON/OFF/SYNC, failed sync, pending writes and focus/visible/online triggers.
- [x] Refresh views on local changes, coalesce resume events, expose failure/retry and local/pending save feedback, preserve data on sign-out.
- [x] Run focused tests, npm test and npm run build; commit.

## Task 3 — mobile navigation and fuel reference (Sol / Medium)

Files: src/modules/vehicle/{navigation,navigation.test}.ts, VehicleModule.tsx, FuelView.tsx, vehicleViews.test.tsx; src/styles/global.css; index.html.
- [x] Add failing history/back/direct-route tests and reference label assertions.
- [x] Native History API, shared fixed navigation, safe areas/dvh/keyboard space and explicit existing reference/cap/estimated liters copy.
- [x] Run focused tests, npm test and npm run build; commit.

## Task 4 — PWA installation and update (Sol / Medium)

Files: src/app/PwaControls{,.test}.tsx; src/infrastructure/pwa/register{,.test}.ts; src/main.tsx; src/vite-env.d.ts; vite.config.ts; public/_headers.
- [x] Add failing install/standalone/iOS and update/resume tests.
- [x] Retain prompt event, user-triggered install/update, visible resume checks, static-only SW cache and revalidation headers.
- [x] Run focused tests, npm test and npm run build; commit.

## Task 5 — integrated verification and report (Astra / Medium recommended)

- [x] Inspect production bundle in isolated browser contexts at 320/360/375/390/412/430px and desktop, including scroll/back and offline reload.
- [x] Verify server schema/RLS/grants/advisors and distinguish proven causes from unconfirmed device symptoms.
- [x] One whole-branch review, fix material findings, run fresh npm test/build/diff check; record exact live/device limits and report files/results.
- [x] Commit report, retain reviewable branch; do not merge or publish automatically.
