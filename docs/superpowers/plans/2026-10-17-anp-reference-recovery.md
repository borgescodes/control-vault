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

Ruling: Cloudflare plugin search returned no plugin; effective production
build variable is verified from the served bundle instead of changing provider
configuration. Risk: preview/dashboard variable values remain unverified.

Task 1: RED 20/26 regressions failed on main; GREEN 27 focused tests, full suite 363/363, build and diff check passed. Public provider configuration unchanged.
