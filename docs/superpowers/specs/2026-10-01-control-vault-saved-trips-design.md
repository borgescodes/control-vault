# Control Vault - Saved Trips Design

Status: Approved
Date: 2026-10-01
Branch: `feature/saved-trips`

## 1. Purpose

Add a small, reusable `Percursos` feature to the vehicle module. The user manually records the distance from point A to point B and may optionally record a different return distance. Control Vault combines the saved distance with the vehicle's current learned consumption and the current gasoline price reference to show an approximate fuel volume and monetary cost.

The feature must not change consumption calibration, fuel estimation or range logic.

## 2. Product decisions

A saved trip contains only durable route facts supplied by the user:

- origin label;
- destination label;
- outbound distance in kilometers;
- optional return distance in kilometers.

No maps, GPS, geocoding, routing provider, travel-time estimate or background location are introduced.

Calculated fuel volume and cost are derived at read time. They are never persisted as authoritative trip fields.

## 3. List UX

`Percursos` is a primary navigation destination between `Início` and `Histórico`.

The list is optimized for quick consultation.

Outbound-only example:

`Casa > Trabalho | 14 km | ≈ R$ 3,50 ida`

Round-trip example:

`Casa > Juparanã | 30 km | ≈ R$ 7,50 total`

For a round trip, list distance and cost use:

`outboundDistanceKm + returnDistanceKm`

The list does not expand leg details inline.

## 4. Detail UX

Opening a trip shows:

- origin and destination;
- outbound distance, estimated liters and estimated cost;
- return distance, estimated liters and estimated cost when configured;
- total distance, liters and cost when return is configured;
- current learned consumption used;
- current gasoline price reference used.

The user may edit origin, destination and distances.

Deletion is supported with an explicit confirmation.

## 5. Create/edit UX

Fields:

- `Origem`
- `Destino`
- `Distância da ida`
- `Cadastrar volta` checkbox
- `Distância da volta`, shown only when return is enabled

Distances accept positive decimal kilometers and use pt-BR display conventions.

Origin and destination are short user labels, not geographic addresses.

## 6. Calculation

For each leg:

```
liters = distanceKm / consumptionKmPerLiter
cost = liters * fuelPricePerLiter
```

Round-trip totals are the sum of the separately calculated outbound and return legs.

No safety factor is applied. `RANGE_SAFETY_FACTOR` remains exclusive to displayed autonomy.

If consumption is unavailable, distance remains visible and cost is labeled `Aguardando calibração`.

If consumption is available but no usable price reference is available, estimated liters remain available and monetary cost is unavailable.

Approximation semantics remain explicit with `≈`.

## 7. Domain model

```ts
type SavedTrip = {
  id: string
  origin: string
  destination: string
  outboundDistanceKm: number
  returnDistanceKm: number | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}
```

`deletedAt` is a trip-specific soft-delete marker required so deletion can synchronize reliably between offline devices without introducing generalized tombstone infrastructure.

## 8. Local-first persistence

Saved trips follow the existing operational flow:

```
UI -> IndexedDB pending -> authenticated Supabase upsert -> synced
```

Use stable client-generated IDs.

Create, edit and delete commit locally first and remain usable offline.

Normal trip listing excludes rows with `deletedAt != null`, while synchronization retains those rows so deletion propagates.

## 9. Supabase

Add `public.saved_trips` with:

- `id uuid primary key`;
- `user_id uuid not null references auth.users(id) on delete cascade`;
- `origin text not null`;
- `destination text not null`;
- `outbound_distance_km numeric(10,1) not null check > 0`;
- `return_distance_km numeric(10,1) null check > 0 when present`;
- `deleted_at timestamptz null`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Grant only `select, insert, update` to `authenticated`.

Enable RLS.

Create select/insert/update ownership policies using `(select auth.uid()) = user_id`; update includes both `USING` and `WITH CHECK`.

Do not grant table access to `anon`.

Physical DELETE is not used by the client.

## 10. Sync

Extend the existing deterministic sync pipeline with `saved_trips`.

Requirements:

- pending create/edit/delete upserts are idempotent by `id`;
- remote refresh reads all owned trip rows, including soft-deleted rows;
- remote confirmed rows do not overwrite a newer local pending version;
- a remote soft-delete removes the trip from the visible local list while keeping the tombstone record locally;
- retry does not duplicate rows.

No changes to vehicle-state, odometer or fuel sync semantics.

## 11. Navigation

Paths:

- `/percursos`
- `/percursos/novo`
- `/percursos/:id`
- `/percursos/:id/editar`

Browser/PWA back navigation must continue using History API semantics.

The bottom navigation contains:

`Início | Percursos | Histórico`

Use the user-selected Boxicons `route` icon from the free Filled pack. Copy the official SVG path inline into the existing icon component; add no icon package or CDN dependency.

## 12. Non-goals

Do not add:

- map;
- GPS;
- route API;
- geocoding;
- traffic;
- travel time;
- tolls;
- recurring monthly trip projection;
- automatic address lookup;
- new consumption/calibration behavior;
- new fuel-price provider;
- generalized CRUD framework;
- generalized soft-delete framework.

## 13. Acceptance

The work is complete when:

1. the user can create an outbound-only trip offline;
2. the user can optionally configure a return distance different from the outbound distance;
3. the trip appears in the list after reload;
4. list summaries show outbound values for outbound-only trips and combined values for round trips;
5. calculations use current learned consumption and current gasoline price;
6. changing learned consumption or fuel-price reference changes displayed estimates without editing the saved trip;
7. details show outbound and return separately;
8. edit persists and synchronizes;
9. delete hides the trip and synchronizes without resurrecting it on another device;
10. the feature works with native browser/PWA back navigation;
11. Saved Trips sync uses the existing ON/OFF/SYNC feedback;
12. tests and production build pass;
13. no merge to `main` is performed automatically.
