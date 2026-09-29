# Control Vault - Vehicle Model v2 Design

Status: Approved
Date: 2026-09-29
Branch: `codex/foundation-task-1`

## 1. Purpose

Revise the vehicle fuel model so the app reflects what the user actually knows during normal use.

The user should not be required to know liters dispensed or start the app with a full tank. The normal inputs are:

- current odometer;
- amount paid;
- whether the refill ended with the tank full.

Control Vault estimates liters from the weekly average gasoline price for Paragominas, PA. These estimates are sufficient for the personal-use autonomy and consumption features.

The application remains local-first. Failure of the external fuel-price source must never prevent recording an odometer reading or fuel expense.

## 2. Product decisions

### 2.1 Initial setup

Setup requires only the current odometer.

`Tanque cheio agora` is optional and defaults to unchecked.

If the user starts without a full tank:

- vehicle setup completes normally;
- odometer, expenses and fuel history work normally;
- autonomy is unavailable until the first reliable full-tank anchor;
- the Home state is `Aguardando tanque cheio`.

If the user starts with a full tank, setup creates the initial full-tank anchor at that odometer and timestamp.

### 2.2 Nominal tank capacity and operational range

The manufacturer reference remains `3 L`, but v2 treats it explicitly as a nominal capacity, not as an exact measured usable volume.

Rename the domain field to:

```ts
nominalTankCapacityLiters: number
```

Default:

```ts
nominalTankCapacityLiters = 3
```

Do not model reserve capacity separately in v2.

A full-tank event means the tank is known to be `full` relative to the nominal model. It does not mean Control Vault claims there are exactly `3.000 L` physically available.

The internal fuel ledger continues to use the nominal capacity as its upper bound. Consumption learning remains independent from any safety discount.

For displayed autonomy, apply a separate operational safety factor:

```ts
RANGE_SAFETY_FACTOR = 0.90
```

The displayed range is:

```
displayRangeKm =
  theoreticalRangeKm * RANGE_SAFETY_FACTOR
```

The safety factor applies only to displayed operational range. It must not alter:

- estimated remaining liters;
- full-to-full cycle fuel totals;
- learned consumption;
- tank-capacity clamping.

The UI presents autonomy as approximate, for example:

`≈ 108 km`

Do not present the nominal `3 L` as a precise physical measurement.

### 2.3 Fuel entry UX

Remove manual liters input.

The normal fuel form contains:

- `Hodômetro`
- `Valor`
- `Completei o tanque`

`Completei o tanque` means the fuel balance after that event is known to equal the nominal tank capacity.

The user may therefore record both common behaviors:

- add an arbitrary amount without filling the tank;
- add fuel until the tank is full.

### 2.4 Fuel quantity

When a weekly price reference is available:

```
estimatedLiters = round3((amountCents / 100) / referencePricePerLiter)
```

The app never asks the user to inspect the pump or enter liters manually.

When no usable price reference is available, the fuel entry is still saved with `estimatedLiters = null`.

## 3. Fuel price reference

### 3.1 Source

Use the public fuel-price API based on ANP weekly survey data.

The frontend requests the latest price for:

- UF: `PA`
- municipality: `PARAGOMINAS`
- product: `GASOLINA COMUM`

The API base URL is configured through:

`VITE_FUEL_PRICE_API_URL`

Do not hardcode a deployment hostname.

Do not introduce a Cloudflare proxy or Supabase mirror in v2.

### 3.2 Expected response

The relevant response fields are:

```ts
type FuelPriceReference = {
  uf: string
  municipio: string
  produto: string
  semanaInicio: string
  semanaFim: string
  precoMedio: number
  precoMinimo: number
  precoMaximo: number
  postosPesquisados: number
}
```

Only `precoMedio` is used to estimate liters.

Minimum, maximum and station count may be retained in the disposable cache payload for diagnostics, but they do not affect vehicle calculations.

## 4. Dynamic weekly cache

The cache follows the source's own week interval instead of using a blind seven-day TTL.

The ANP intervals observed for this source run Sunday through Saturday, for example:

- 20/09/2026 to 26/09/2026;
- 13/09/2026 to 19/09/2026;
- 06/09/2026 to 12/09/2026.

### 4.1 Storage

Use `localStorage`.

This is public, tiny and disposable reference data. It does not belong in IndexedDB or Supabase.

Use one fixed cache key for the current v2 location/product:

`control-vault:fuel-price:PA:PARAGOMINAS:GASOLINA-COMUM`

Suggested stored shape:

```ts
type FuelPriceCache = {
  reference: FuelPriceReference
  fetchedAt: string
  nextCheckAt: string | null
}
```

### 4.2 Freshness rule

If local calendar date is inside the cached interval, inclusive (`semanaInicio <= today <= semanaFim`):

- use the cached reference immediately;
- do not call the API.

If local calendar date is after `semanaFim`:

- use the cached reference immediately as fallback;
- attempt to fetch the newest reference when `nextCheckAt` is absent or reached.

If the API returns a newer week:

- replace the cache;
- clear `nextCheckAt`.

If the API returns the same expired week or the request fails:

- keep the existing reference;
- set `nextCheckAt` to 12 hours after the attempt.

This avoids repeated requests while still picking up a newly published weekly survey without waiting seven days from the last fetch.

If there is no cache:

- try the API;
- if it succeeds, cache and use the returned latest reference;
- if that returned reference is already expired for the local date, set `nextCheckAt` to 12 hours after the attempt;
- if the request fails, continue without a price reference.

### 4.3 Historical stability

A fuel entry must snapshot the reference actually used when it is created.

Never recalculate an old fuel entry when the weekly cache changes.

## 5. Domain model

### 5.1 VehicleState

Change:

```ts
type VehicleState = {
  nominalTankCapacityLiters: number
  initialOdometerKm: number
  initialFullTankAt: string | null
  createdAt: string
  updatedAt: string
}
```

`initialFullTankAt = null` means setup did not establish a fuel anchor.

### 5.2 FuelEntry

Replace the user-supplied liters model with:

```ts
type FuelEntry = {
  id: string
  odometerKm: number
  amountCents: number
  estimatedLiters: number | null
  referencePricePerLiter: number | null
  referenceWeekStart: string | null
  referenceWeekEnd: string | null
  fullTank: boolean
  fueledAt: string
  createdAt: string
  updatedAt: string
}
```

There is no `litersSource` enum because v2 has no manual-liters path.

When a price reference is used, the four estimation fields are populated consistently.

When no reference is available:

- `estimatedLiters = null`;
- all reference snapshot fields are `null`.

## 6. Supabase schema

Create a new migration.

### 6.1 vehicle_state

Make:

`initial_full_tank_at timestamptz null`

### 6.2 fuel_entries

Add the v2 estimation columns and migrate the existing `liters` data.

Target columns:

- `estimated_liters numeric(7,3) null`
- `reference_price_per_liter numeric(8,3) null`
- `reference_week_start date null`
- `reference_week_end date null`

Existing `amount_cents`, `odometer_km`, `full_tank`, timestamps, IDs and ownership remain.

Migration sequence:

1. add the four nullable v2 columns;
2. backfill `estimated_liters = liters` for existing rows;
3. leave the three reference snapshot fields null for those historical rows;
4. drop the `NOT NULL` constraint from the legacy `liters` column so v2 inserts can omit it;
5. keep that legacy column temporarily during rollout so the currently deployed v1 frontend is not broken before the v2 frontend is live;
6. stop reading/writing `liters` in v2 code;
7. remove the legacy column only in a later cleanup migration after v2 production verification.

This compatibility column is transitional only and must not remain part of the v2 domain type.

Do not change the RLS ownership model or grants.

## 7. IndexedDB

The local DB remains the operational source of truth.

A schema version bump is allowed only because `FuelEntry` persisted shape changes.

Do not add a fuel-price object store. Weekly price reference remains in `localStorage`.

Existing local fuel rows must be migrated into the v2 shape without deleting history:

- existing `liters` -> `estimatedLiters`;
- reference snapshot fields -> null.

Existing `VehicleState.initialFullTankAt` values remain valid; new setups may store null.

## 8. Recording flow

### 8.1 Setup

`initializeVehicle` receives:

- initial odometer;
- whether the tank is full;
- timestamp.

If full:

- `initialFullTankAt = now`.

If not full:

- `initialFullTankAt = null`.

The initial odometer reading remains atomic with vehicle initialization.

### 8.2 Refueling

The UI obtains the best available price reference before or while the form is open, without blocking interaction.

On submit:

1. validate odometer and amount;
2. select the currently available cached/fetched price reference;
3. derive `estimatedLiters` when possible;
4. create the immutable snapshot fields;
5. atomically validate odometer + save fuel entry + save fuel-generated odometer reading;
6. return local success;
7. attempt normal background sync.

External price lookup failure must not turn a valid local fuel operation into an error.

## 9. Fuel anchors and remaining fuel

A reliable anchor exists when either:

- setup was explicitly started with a full tank; or
- a later fuel entry has `fullTank = true`.

If no reliable anchor exists, remaining fuel and autonomy are unknown.

After a full-tank event, the internal estimated balance resets to `nominalTankCapacityLiters` regardless of `estimatedLiters`.

For partial refills with known `estimatedLiters`, retain the sequential ledger behavior already fixed in the domain:

1. consume fuel for distance since previous event;
2. add estimated liters;
3. clamp to `nominalTankCapacityLiters` at that event;
4. continue to the next event.

Events are ordered by:

`(odometerKm, fueledAt)`

so a later refill at the same odometer is still processed.

### 9.1 Unknown partial refill

A partial refill with `estimatedLiters = null` makes the exact remaining-fuel estimate unknown from that point forward.

Do not invent liters.

Autonomy remains unavailable until a later reliable full-tank event resets the balance.

## 10. Consumption learning

Consumption remains an estimate because fuel quantity is inferred from municipal average price.

Full-to-full cycles use the estimated liters of the fuel entries inside the cycle.

A cycle containing any fuel entry with `estimatedLiters = null` is not usable for learned consumption.

Retain the current robust learning rule where applicable:

- median of most recent five valid cycles;
- one or two valid cycles -> estimated;
- three or more -> stability check using the latest three.

The UI must not imply pump-measurement precision.

Use approximate presentation where useful, for example:

`≈ 39,2 km/L`

## 11. Dashboard states

### No full-tank anchor

```
Autonomia
Aguardando tanque cheio
```

Consumption may also be unavailable.

### Full anchor but insufficient valid cycles

```
Autonomia
<estimate when calculable>

Consumo
Calibrando
```

### Learned estimate available

Show estimated autonomy and consumption with explicit approximation semantics.

The domain may compute a theoretical range from the internal nominal fuel ledger. The selector/view applies `RANGE_SAFETY_FACTOR = 0.90` only to the displayed operational autonomy.

Example:

```
Autonomia
≈ 108 km
```

Do not display the undiscounted theoretical range as if it were a guaranteed usable distance.

Do not introduce confidence scores, gauges or extra dashboards.

## 12. Sync

The existing local-first flow remains:

`UI -> IndexedDB pending -> authenticated Supabase upsert -> synced`

Sync mappings must be updated for nullable anchor and new fuel-entry fields.

The weekly public API cache is never synced.

The snapshot stored inside each `FuelEntry` is synced because it is part of that historical record.

Hydration must map the new nullable fields back to IndexedDB.

## 13. Offline behavior

Offline use remains first-class.

With cached price reference:

- calculate estimated liters using the cached reference;
- record locally as pending.

With no cached reference:

- record amount, odometer and full-tank status;
- estimation fields remain null;
- sync later as normal.

If the entry is `fullTank = true`, it still creates a reliable future fuel anchor even when its estimated liters are null.

## 14. Error handling

Price reference failures are non-fatal.

The UI may show a compact indication that the estimate uses the most recent available weekly reference.

Do not add toast infrastructure or modal errors for price lookup.

Validation and persistence errors continue to use the existing action result flow.

## 15. Non-goals

Do not add:

- manual liters input;
- user-selectable municipality or UF in v2;
- station-level prices;
- exact fuel-station selection;
- GPS/location lookup;
- ANP history charts;
- Supabase table for public price cache;
- Cloudflare proxy solely for the price API;
- background scheduler;
- service-worker runtime caching for the price API;
- separate reserve-capacity model;
- user-configurable safety factor in v2;
- confidence scoring;
- maintenance, insurance or general finance features.

## 16. Testing requirements

Tests must cover at minimum:

- setup succeeds without full tank;
- nullable initial anchor round-trips local and remote;
- setup with full tank still creates an anchor;
- fuel form/action no longer accepts manual liters;
- amount + weekly average produces rounded estimated liters;
- historical price snapshot is immutable;
- cache is fresh while local date is within `semanaInicio..semanaFim`;
- cache becomes refreshable after `semanaFim`;
- stale API response is retained and recheck is throttled for 12 hours;
- API failure uses stale cache;
- no cache + API failure still permits fuel recording;
- full tank resets internal remaining fuel to nominal capacity;
- displayed autonomy applies the 0.90 safety factor while internal remaining liters and learned consumption do not;
- unknown partial refill invalidates range until a later full anchor;
- same-odometer later refill remains ordered by timestamp;
- per-event tank-capacity clamp remains correct;
- cycles with unknown estimated liters are excluded;
- sync/hydration map all new nullable fields;
- existing IndexedDB rows migrate without loss;
- existing Supabase rows migrate without loss;
- offline recording works with and without cached price.

## 17. Migration and rollout

Implement with TDD and explicit migration tests.

Recommended sequencing:

1. schema/domain types and nominal-capacity rename;
2. IndexedDB migration;
3. Supabase migration;
4. price-reference client + localStorage cache;
5. recording actions;
6. fuel estimate and consumption adaptation;
7. sync/hydration mappings;
8. setup/fuel/dashboard UI;
9. offline and production verification.

Do not merge to `main` until the v2 implementation and production verification are complete.
