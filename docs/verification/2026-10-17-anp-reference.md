# ANP reference recovery — 2026-10-17

## Root cause and production evidence

The effective production URL was correct. Cloudflare's connected plugin
confirmed `VITE_FUEL_PRICE_API_URL=https://control-vault-fuel-price-api.onrender.com`
for project `control-vault`, both production and preview, and active deployment
`582a798d-0cc6-4559-895f-7242c0e612e2` at main commit `80ab6c1`.
The same URL appears in the served `/assets/index-CDqKrETg.js`.

Render's connected plugin identified service `control-vault-fuel-price-api`,
ID `srv-daujkh1srm7s73cgv24g`, Free plan, main branch, health path
`/actuator/health`. During the first request, service logs showed Spring Boot
starting. The first request timed out at **90.008 seconds without any bytes**;
the second returned **HTTP 200 after 46.639 seconds**; a warm call returned
**HTTP 200 in 0.408 seconds**. This exceeds the deployed client's single
60-second background recovery window. After that failure the open form had no
retry or online/resume listener. With a cache, the deployed client also wrote
a three-hour throttle before knowing whether the request succeeded.

The API itself returned valid data with `Content-Type: application/json` and
`Access-Control-Allow-Origin: *` for the production Pages Origin header:

```http
GET https://control-vault-fuel-price-api.onrender.com/v1/precos?uf=PA&municipio=PARAGOMINAS&produto=GASOLINA%20COMUM
```

```json
{"uf":"PA","municipio":"PARAGOMINAS","produto":"GASOLINA COMUM","semanaInicio":"2026-10-04","semanaFim":"2026-10-10","precoMedio":7.053,"precoMinimo":6.790,"precoMaximo":7.220,"postosPesquisados":7}
```

History for October 1–17 returned this same week as the latest common-gasoline
week (HTTP 200, 1.158 seconds). A separate `GASOLINA ADITIVADA` request returned
7.203/L and six stations (HTTP 200, 0.781 seconds), confirming the products are
distinct. Repository query orders survey start descending and filters
`GASOLINA COMUM%`; it does not match `GASOLINA ADITIVADA`.

No changes to the API repository, importer, Neon, Supabase or provider
configuration were justified or performed.

## Changes

- `src/infrastructure/fuelPrice/fuelPrice.ts`: immediate usable cache/null
  publication; cancellable background requests, 60-second deadline, retry
  after 30 seconds, online/focus/visibility recovery and no overlapping request
  within a subscription. Only successful checks get the three-hour throttle.
  Legacy failure-written `nextCheckAt` cannot suppress retry. Keep valid prices
  on transient errors, publish valid responses despite storage errors, reject
  wrong product/location/malformed/future-start/obsolete references, preserve
  newer cache, and expire visible references at local midnight after the
  existing 14-day limit. Expiry immediately triggers an online recheck.
- `FuelView.tsx` and `VehicleModule.tsx`: subscribe while visible, unsubscribe
  on unmount/navigation. Accept null on expiry. Home bootstrap still does not
  require the API. Fuel edits and submission/confirmation snapshots are intact.
- `fuelPrice.test.ts`, `vehicleViews.test.tsx` and
  `fuelPriceViews.integration.test.tsx`: cache, failure, lifecycle, real React
  and IndexedDB regressions. No new dependency.
- `docs/superpowers/plans/2026-10-17-anp-reference-recovery.md`: scope,
  implementation sequence, evidence and review decisions.

## Verification

- Baseline main: **355/355 tests**.
- RED: 20 retrieval/recovery tests failed before implementation; three real
  view integration tests failed before subscription wiring; expiry/recheck
  regression failed before the review fix.
- Final `npm test`: **369/369 tests in 32 files**.
- Final focused real price/view tests: **32/32**.
- `npm run build`: passed. A second build using the real fuel API URL and
  dummy public Supabase values also passed and retained the complete app.
  Full bundle: 519.56 kB / 146.42 kB gzip; Vite emits the existing 500 kB size
  warning. No chunking scope was added.
- `git diff --check`: passed.
- Coverage includes valid API, five-second response, timeout then retry, UI
  background update, valid and expired local cache, empty first install,
  offline saves and online return, exact product, unrounded mean calculation,
  cleanup, midnight expiry, immediate online expiry recheck, no retrospective
  estimate writes, and existing fast app bootstrap regressions.
- Real React + price lookup + IndexedDB integration: R$20 / 7.053 stores
  **2.836 L**, with original week and price metadata. Records saved before
  recovery retain null estimates.
- Browser: real production PWA displayed the reference after applying its
  already-published update. The corrected localhost FuelView independently
  displayed the live API's R$7.05/L and October 4–10 survey, with Save enabled
  for R$20. The temporary local harness used a fictitious odometer, dummy
  Supabase settings and blocked submit at capture phase; no user records were
  created. Offline/cold-start timing cases were automated with fake clocks
  and IndexedDB, not simulated by interrupting the production service.
- `npm audit --omit=dev`: zero vulnerabilities. Full audit reports one
  pre-existing transitive development advisory in `source-map-js`; no package
  or lockfile changes were made.

## Delivery and remaining operations

Branch: `codex/fix-anp-reference-recovery`. See the PR's GitHub CI check for the
remote result. The final commit uses `[CF-Pages-Skip]`, documented by Cloudflare,
because this project automatically previews every branch. No merge or new
deployment is authorized or performed; provider settings are unchanged.

There is no manual API URL correction to apply. After explicit approval,
merge/rebuild the frontend and accept its normal PWA update. No clearing
site storage or reinstall is needed.

Render's live deployment still identifies backend commit `b12227a` from
September 30, although repository main is `f61166c`. The old deployed config
caches API results for six hours; main shortens this to 15 minutes. After
approval, deploy backend main to the existing service if that newer cache
policy is wanted. This is deployment drift, not a wrong current response.

Render Free cold starts remain slow; the fix keeps the PWA usable and retries
in the background. Surveys older than 14 days remain unavailable until fresh
official data arrives. The no-cache one-shot action fallback is still bounded
to two seconds; mounted forms never wait for it to render or save.

References: [Render Free service lifecycle](https://render.com/docs/free),
[Cloudflare deployment skip flag](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/#skipping-a-build-via-a-commit-message).
