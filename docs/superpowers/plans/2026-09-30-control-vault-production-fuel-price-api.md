# Control Vault Production Fuel Price API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the official ANP-backed fuel-price chain and connect the production Control Vault UI without allowing remote latency or failure to block local refueling.

**Architecture:** Keep the upstream Python loader, Neon PostgreSQL, Spring Boot API, Render service, and Cloudflare Pages frontend. Add only the missing latest-workbook resolver, integration tests, and native client timeout/stale-first behavior.

**Tech Stack:** Python 3.12, pytest, PostgreSQL/Neon, Java 21/Spring Boot, Render, React/TypeScript/Vitest, Cloudflare Pages, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-30-control-vault-production-fuel-price-api-design.md`

## Global Constraints

- Use only official ANP data and preserve `GASOLINA COMUM%` lookup behavior.
- `recordFuel()` never waits through a Render cold start.
- Return usable stale cache immediately; use a 2-second native timeout only when no cache exists.
- R$ 99,99 is the mask ceiling; the 4 L price-derived ceiling controls Save eligibility only.
- Add no HTTP, retry, state-management, or timeout dependency.
- Preserve IndexedDB, Supabase schema/RLS/sync, and all existing vehicle behavior.
- Never expose or commit provider credentials.
- One meaningful commit per code/documentation task; verification precedes every completion claim.

## Review Focus

- A stale cache plus a hanging network must return immediately without issuing a blocking fetch.
- A first-run hanging network must time out and still allow a valid local save.
- `GASOLINA COMUM` must not accidentally select `GASOLINA` or another product family.
- ANP markup changes or a missing workbook must fail the workflow clearly rather than load an untrusted URL.
- A repeated weekly load must not duplicate raw rows and must preserve the latest aggregate.

---

### Task 1: Align repository authority

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-control-vault-foundation-design.md`
- Modify: `docs/superpowers/plans/2026-09-29-control-vault-vehicle-mvp.md`
- Modify: `docs/superpowers/specs/2026-09-29-control-vault-source-visual-redesign.md`
- Modify: `docs/superpowers/plans/2026-09-29-control-vault-source-visual-redesign.md`
- Create: `docs/superpowers/specs/2026-09-30-control-vault-production-fuel-price-api-design.md`
- Create: `docs/superpowers/plans/2026-09-30-control-vault-production-fuel-price-api.md`

**Interfaces:**
- Produces: authoritative local-first, timeout, mask, provider, and deployment contract for all later tasks.

- [ ] Remove the old no-price-API and dynamic-mask contradictions without broadening product scope.
- [ ] Run `git diff --check` and inspect the documentation diff.
- [ ] Commit as `docs: approve production fuel price integration`.

### Task 2: Harden and automate the API fork with TDD

**Files (API fork):**
- Modify: `loader/loader.py`
- Modify: `loader/tests/test_loader.py` or create a focused resolver test file
- Modify: `.github/workflows/carga-semanal.yml`
- Create/modify: Spring service/controller integration tests under `api/src/test/java`

**Interfaces:**
- Produces: `resolver_url_mais_recente(page_url) -> str` (or an equivalently small tested interface), optional workflow URL override, and verified `/v1/precos` contract.

- [ ] Fork to `borgescodes/precos-combustivel-api`, preserve `upstream`, and create a feature branch.
- [ ] RED: test official-page parsing, newest revenda workbook selection, official-host enforcement, and clear missing-link failure.
- [ ] GREEN: implement the smallest stdlib resolver and wire the workflow to use it when no manual URL is supplied.
- [ ] RED/GREEN: add API tests for PA, Paragominas case variants, `GASOLINA COMUM%`, encoded request, and response fields.
- [ ] Run loader tests, Java tests, Docker build, and `git diff --check`.
- [ ] Commit and push the API branch; open its PR.

### Task 3: Provision and load the official data chain

**Interfaces:**
- Consumes: versioned `db/init.sql`, loader, and official latest-workbook resolver from Task 2.
- Produces: dedicated Neon database with verified Paragominas aggregates and non-sensitive evidence.

- [ ] Create Neon project `control-vault-fuel-price` and apply `db/init.sql`.
- [ ] Resolve/download the latest official ANP workbook and load it through `DATABASE_URL` without exposing credentials.
- [ ] If necessary, load additional recent official weeks until Paragominas exists.
- [ ] Verify raw/aggregate counts and the latest five `GASOLINA COMUM%` aggregates.
- [ ] Re-run the same load and verify dedupe/upsert behavior.

### Task 4: Deploy and automate the API

**Interfaces:**
- Consumes: Neon JDBC/user/password values and the API fork.
- Produces: public Render base URL and green weekly GitHub Actions workflow.

- [ ] Create the Render Docker Web Service with `/actuator/health` and the required separated variables.
- [ ] Verify health, Paragominas HTTP 200 payload, CORS, and observed cold-start behavior.
- [ ] Configure GitHub Actions secret/variable and dispatch `Carga semanal ANP` manually.
- [ ] Verify green tests/download/load and database dedupe after the dispatch.
- [ ] Merge the API PR only after these checks pass.

### Task 5: Make Control Vault stale-first and timeout-bounded with TDD

**Files:**
- Modify: `src/infrastructure/fuelPrice/fuelPrice.ts`
- Modify: `src/infrastructure/fuelPrice/fuelPrice.test.ts`
- Modify if evidence requires: `src/modules/vehicle/vehicleActions.test.ts`

**Interfaces:**
- Produces: `getFuelPriceReference(now)` that returns any valid cache immediately and bounds a no-cache remote attempt with native abort/timeout behavior.

- [ ] RED: prove stale cache returns immediately without waiting for or requiring network.
- [ ] RED: prove first-run hanging fetch is aborted after 2 seconds and returns `null`.
- [ ] RED: prove `recordFuel()` persists locally after the bounded no-reference path.
- [ ] GREEN: implement the minimum native timeout/stale-first change; keep background UI refresh non-blocking.
- [ ] Verify that ANP `7.053` is normalized to the displayed R$ 7,05 before enforcing R$ 28,20/R$ 28,21/R$ 45,45/R$ 99,99 behavior and the no-reference fallback, without changing the mask.
- [ ] Run focused tests, full `npm test`, `npm run build`, and `git diff --check`.
- [ ] Commit as `fix: keep fuel saves independent of price API latency`.

### Task 6: Configure, merge, deploy, and verify production

**Interfaces:**
- Consumes: public Render URL and verified Control Vault branch.
- Produces: production Cloudflare build and end-to-end evidence.

- [ ] Configure `VITE_FUEL_PRICE_API_URL` for Cloudflare production and preview; trigger a fresh build.
- [ ] Open a Control Vault PR, require green CI, merge to `main`, and verify the deployed SHA.
- [ ] In a real browser, verify network 200/CORS, visible price and ceiling, mask boundaries, Save states, stale-cache offline fallback, and non-blocking cold start.
- [ ] After the chain is proven, clear only `fuel_entries`, `odometer_readings`, and `vehicle_state`, preserving the auth user; then clear only `control-vault.pages.dev` site storage.
- [ ] Recheck remote counts, production UI, `npm test`, `npm run build`, `git diff --check`, and final repository status.
- [ ] Run a fresh whole-branch review and use `verification-before-completion` before the final report.
