# Control Vault Production Fuel Price API

Date: 2026-09-30
Status: Approved

## Outcome

Provide a real public price reference for `PA / PARAGOMINAS / GASOLINA COMUM` from official ANP data and connect the production Control Vault build to it.

## Architecture

```text
ANP official weekly workbook
  -> Python loader
  -> dedicated Neon PostgreSQL
  -> Spring Boot API on Render
  -> Control Vault on Cloudflare Pages
```

The API is optional operational enrichment. IndexedDB remains authoritative for user actions and Supabase remains only the Control Vault continuity store.

## Price lookup and local-first guarantee

The application resolves a reference in this order:

```text
current-week cache
  -> usable stale cache returned immediately
  -> remote request with a short native timeout
  -> null
```

A stale cache is returned without waiting for the network. UI background refresh may update the cache, but `recordFuel()` never waits through a Render cold start. When no cache exists, the remote attempt is bounded to 2 seconds. Failure, latency, timeout, malformed payload, missing configuration, or CORS failure must not block local persistence when no usable reference exists. Use browser-native timeout/abort primitives and add no dependency.

## Money rules

The mask and the business rule remain separate:

- structural input ceiling: R$ 99,99;
- dynamic Save ceiling: `ceil((3 L + 1 L) * precoMedio * 100)` cents.

At R$ 7,05/L, R$ 28,20 is valid and R$ 28,21 through R$ 99,99 remain typeable but disable Save. Without a current or stale reference, no dynamic ceiling is invented and a valid local entry remains recordable.

## API and data

Fork `VictorrCabral/precos-combustivel-api` into `borgescodes`, preserve `upstream`, and keep the documented PostgreSQL/Spring contract. Load only official ANP workbooks. The endpoint is:

```http
GET /v1/precos?uf=PA&municipio=PARAGOMINAS&produto=GASOLINA%20COMUM
```

Product lookup remains the normalized prefix `GASOLINA COMUM%`. The response must pass the existing Control Vault validator.

## Weekly automation

The ANP publishes dated weekly workbook URLs. The workflow must resolve the newest official revenda workbook from the official ANP page at runtime, fail clearly if none is found, and retain an optional manual URL override. The loader's dedupe and aggregate upsert remain unchanged.

## Deployment and security

- Neon stores only the public ANP dataset.
- Render receives JDBC URL without embedded credentials plus separate user/password variables.
- GitHub Actions receives the Python/psycopg connection string as a secret.
- Cloudflare receives only the public `VITE_FUEL_PRICE_API_URL` build variable.
- No credential or privileged key enters commits, logs, screenshots, browser code, or the final report.

## Acceptance

Completion requires official ANP rows in Neon, a healthy public Render service, HTTP 200 for Paragominas, working CORS, a successful manual weekly workflow, a rebuilt Cloudflare deployment, visible price/ceiling behavior in `Abastecer`, real stale-cache fallback, non-blocking local save during API failure/cold start, and a production-domain browser verification. Operational Supabase rows may be cleared only after that chain is proven, while preserving the auth user.
