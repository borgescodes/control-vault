# ANP reference recovery

Status: authorized by the 2026-10-17 bug-fix request. Execute inline with
Superpowers systematic debugging, TDD, verification and Ponytail full.

## Evidence and bounded design

- Production bundle `index-CDqKrETg.js` embeds the expected public Render URL.
- Render service `srv-daujkh1srm7s73cgv24g` uses the Free plan. First HTTP
  request timed out at 90.008 s; the next returned 200 after 46.639 s; warm
  response: 200 in 0.408 s. CORS allows `*`.
- Response: PA/PARAGOMINAS/GASOLINA COMUM, 2026-10-04 through 2026-10-10,
  mean 7.053, minimum 6.790, maximum 7.220, seven stations.
- Main stops recovery after a 60-second background attempt, does not listen
  for connectivity restoration, and writes a three-hour throttle before a
  refresh succeeds. Storage exceptions can suppress valid network responses.
- Backend latest-week query sorts descending and filters `GASOLINA COMUM%`;
  the live response matches the client contract. No backend change is justified.

This plan supersedes the old September cache/retry instructions only for this
fix. Preserve main's 14-calendar-day maximum age after survey end. Reject future
surveys, wrong location/product and malformed data. Keep survey dates visible;
never fabricate a reference. No data migration or historical estimate rewrite.

## Task 1 — resilient reference retrieval (Sol / extra high recommended)

Use the existing `fuelPrice.ts` module and native fetch, timers and events.
Keep `getFuelPriceReference(now)` for bounded one-shot action lookups (valid
cache immediately, otherwise at most two seconds). Add
`subscribeFuelPriceReference(onChange): () => void` for mounted views: publish
usable cache/null immediately, fetch entirely in background with a 60-second
deadline, retry failures after 30 seconds and on online/focus/visible events.
Throttle only successful responses for three hours using `fetchedAt`, ignoring
legacy failure-written `nextCheckAt`. Schedule expiry even while offline. Abort
and remove timers/listeners on unsubscribe; do not overlap a subscription's
requests. Storage failure must not discard a valid in-memory response. Preserve
the newer cached week if a server returns an older one.

Files: `src/infrastructure/fuelPrice/fuelPrice.ts` and its tests; action
integration tests. RED/GREEN: no cache, valid/expired cache, >2-second response,
60-second timeout followed by recovery, offline/online, legacy throttle,
wrong product/location/future/invalid response, storage failure, expiration,
cleanup and non-retroactive local persistence. Verify focused tests, full
`npm test`, `npm run build`, `git diff --check`; commit this task.

## Task 2 — reactive views (Sol / extra high recommended)

Replace one-shot effects in `FuelView.tsx` and `VehicleModule.tsx` with the
subscription, returning its cleanup. Adapt existing view test doubles and add
an integration test using the real FuelView and real reference module, with
only fetch/sync replaced. Prove initial render/save do not wait for the network,
late price updates, estimated liters = amount / mean, expiry removal, and
unmount cleanup. Preserve submit/confirmation reference snapshots and edits.
Verify focused tests, full suite, build, diff check; commit this task.

## Task 3 — production proof and delivery (Sol / extra high recommended)

Validate the localhost view against the real API in a browser without writing
personal records. Record production HTTP/CORS and configuration evidence,
tests and limitations in `docs/verification/2026-10-17-anp-reference.md`.
Review the entire branch with a fresh reviewer, fix important findings with
TDD, then push a feature branch/open a PR and check CI. No merge, deployment,
provider mutation, database deletion or clearing production site storage.

Cloudflare became available during execution. The connected plugin confirmed
the same API URL in production, preview and the active deployment (80ab6c1).
No provider configuration change is needed. Preview builds are enabled for all
branches, so the final pushed commit must start with `[CF-Pages-Skip]` to obey
the user's no-deploy instruction while still allowing GitHub CI.

Task 1: RED 20/26 regressions failed on main; GREEN 27 focused tests, full suite 363/363, build and diff check passed. Public provider configuration unchanged.

Task 2: RED 3/4 real FuelView/lookup/IndexedDB integration tests failed before wiring; GREEN 61 focused tests, full suite 367/367, build and diff check passed. Saves before price recovery remain unchanged; new priced saves store 20 / 7.053 = 2.836 L.

Final review: fresh Astra/medium reviewer found one P2 expiry/recheck gap.
Fixed with `refreshes immediately when a recently checked reference expires
online` RED→GREEN; pending-request expiry also covered. Full suite 369/369,
normal build and build with real API URL plus dummy public Supabase settings
passed. The configured build retains the full app; the default unconfigured
build folds away code after the existing missing-Supabase guard.

Ruling: current-period survey end dates may be later than today, as permitted
by the existing weekly-cache specification. Reject future start dates instead
of rejecting an otherwise valid current week. Cost if wrong: accepting a
survey before its week has ended; the survey interval remains visible.

Task 3: localhost FuelView displayed the live ANP reference and enabled Save
for R$20 without writing records; production PWA also displayed the same week
after applying its already-published update. HTTP history and distinct aditivada
responses confirmed latest common-gasoline selection. Provider configuration
verified read-only; final delivery uses a deployment-skipping commit.
