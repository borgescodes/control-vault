# Control Vault Mobile UX Redesign

**Status:** approved correction to the previous source-faithful redesign.

## Product direction

Control Vault is a personal, local-first vehicle instrument for one owner and one vehicle. The interface must optimize two repeated actions: update odometer and record a refuel. Remote sync remains silent infrastructure.

The visual north star is a dark-fantasy / sci-fi operating surface: near-black atmosphere, precise telemetry, restrained cyan signals, sparse text, and strong numeric hierarchy. It is mobile-first and must feel native to a narrow phone viewport before desktop adaptation.

## Credit Monitor relationship

`lovable-credit-monitor` is no longer a layout or branding template.

Approved elements to retain:

- the exact monospace font stack;
- near-black / cyan / blue / muted-gray palette family;
- tabular numeric treatment;
- short opacity + translate + scale entry motion;
- 880ms cubic metric/progress motion where it serves telemetry;
- reduced-motion behavior.

Explicitly rejected:

- Credit Monitor logo/BrandMark;
- copied extension icon catalog as a visual requirement;
- panel-inside-panel composition;
- status badges on ordinary screens;
- cyan borders around containers;
- decorative icon repetition.

Icons, when needed, must be basic, outline, and scarce. Use them only for back navigation, primary vehicle actions, and the bottom navigation. Text and hierarchy carry the rest of the meaning. Empty Home states use explicit copy such as "Sem estimativa", "Sem leitura", "Sem base", or "Sem dados"; do not use em-dash placeholders.

## Geometry and layout

- Mobile first at 320px, 390px and 430px.
- No rounded rectangular surfaces.
- No outer application frame.
- No decorative border around cards/sections.
- Use whitespace, luminance, typography, and position for grouping.
- Functional lines are allowed only where they communicate state, such as the fuel progress track or input underline.
- Desktop remains a compact personal instrument, not a wide corporate dashboard.

## Home

Home must expose, in this order:

1. autonomy in kilometers;
2. approximate autonomy in days when recent pace is sufficient;
3. approximate remaining liters and fuel percentage;
4. current-month gasoline spend;
5. distance driven this month;
6. refuel count and average refuel amount;
7. learned consumption;
8. current odometer;
9. quick actions for odometer and refuel.

When autonomy is unavailable, render a compact human state such as `Calibrando` or `Sem estimativa`; never use an em dash as a data placeholder.

## Input behavior

### Money

Money uses shifted cents. The user types digits only.

- `2` -> `R$ 0,02`
- `25` -> `R$ 0,25`
- `257` -> `R$ 2,57`
- `2570` -> `R$ 25,70`
- backspace -> `R$ 2,57`
- then `2` -> `R$ 25,72`

The raw digit sequence is the integer-cent value. No decimal separator is required from the user.

The refuel cap is derived from the same weekly `PA / PARAGOMINAS / GASOLINA COMUM` price reference used to estimate liters:

```text
maxLiters = nominalTankCapacityLiters + 1 L
maxAmountCents = ceil(maxLiters * referencePricePerLiter * 100)
```

For the current 3 L tank, 4 L is the operational maximum: R$ 7,00/L yields 2800 cents, R$ 7,05/L yields 2820 cents and R$ 8,20/L yields 3280 cents. The formula lives in one pure helper shared by the form and action layer.

The money mask has a structural ceiling of R$ 99,99 and never uses the dynamic ceiling as an input limit. When a price reference exists, the field still accepts values through R$ 99,99 while the form disables Save above the dynamic ceiling and communicates the reference/estimated maximum quietly. The action validates the dynamic ceiling again before persistence. When the current or stale reference is unavailable, no monetary ceiling is invented and an otherwise valid local entry remains recordable offline.

### Odometer

Odometer uses one implicit decimal place.

- `1` -> `0.1`
- `12` -> `1.2`
- `124830` -> `12483.0`

The user types digits only. Storage remains numeric kilometers.

The current vehicle odometer is the lower bound for updates and refuels. Entry views open with the current odometer, disable save while the typed value is lower, and the action layer still rejects regressions atomically. The current dashboard model caps odometer input at 999999.0 km.

## Derived metrics

No schema change is allowed.

Dashboard selectors derive:

- `remainingLiters`;
- `monthFuelEntryCount`;
- `monthAverageRefuelCents`;
- `monthDistanceKm` plus complete/partial/unavailable state;
- recent daily distance over the latest 30-day window with at least seven days between oldest/newest reading;
- `rangeDays` from conservative displayed range divided by recent daily pace.

The existing range safety factor applies to displayed range and range-days only, never to remaining liters or learned consumption.

## History

History groups records by local day.

Fuel-generated odometer readings are not rendered as separate events because the corresponding fuel entry already carries its odometer. Manual readings remain visible.

Fuel event priority:

1. amount paid;
2. odometer;
3. estimated liters when available;
4. full-tank state when applicable;
5. time.

No edit/delete actions are introduced.

## Architecture constraints

Do not change:

- IndexedDB operational authority;
- Supabase schema or migrations;
- RLS;
- pending sync;
- sync/hydration behavior;
- integer cents;
- fuel-price fallback;
- domain calibration rules.

Development over a phone on the same LAN may run over plain HTTP. ID creation must therefore use `crypto.randomUUID()` when available and an RFC 4122 v4 fallback backed by `crypto.getRandomValues()` when `randomUUID` is unavailable in that context.

No new UI framework, router, state manager, icon dependency, chart dependency, or component library.

## Operate interaction contract

- Primary viewport: 390x844; also support 320px, 430x932 and 1440x1000.
- `Abastecer` is primary and `Atualizar KM` is secondary; they must not look identical or sit inside cards.
- Phone actions remain thumb-reachable, touch targets are at least 44px and safe areas are respected.
- Fuel and odometer forms are compact mobile operations, not reduced desktop forms.
- Full-tank remains a semantic checkbox with a custom straight-edged, accessible, touch-friendly presentation.
- History reads as a date-grouped editorial log, not a list of cards, and never duplicates fuel-generated odometer readings.
- Login shares the same atmosphere without a central SaaS box or Credit Monitor branding.
- Motion conveys value/state changes, responds immediately to touch and obeys `prefers-reduced-motion`.

## Acceptance

- mobile layout reads naturally at 390x844;
- 320px and 430x932 phone layouts and 1440x1000 desktop remain free of horizontal overflow or clipped controls;
- no Credit Monitor branding remains in the product UI;
- no decorative container borders;
- no em-dash data placeholders or rounded rectangular surfaces;
- money and odometer masks behave by digit shifting;
- the fuel cap is price-derived when a reference exists and absent when it does not;
- Home shows the requested operational metrics;
- history has no fuel/odometer duplication;
- offline and sync behavior remain unchanged;
- tests and production build pass;
- no merge to `main`.
