# Control Vault - Foundation Design

Date: 2026-09-29
Status: Proposed for implementation
Repository: borgescodes/control-vault

## 1. Product intent

Control Vault is a personal, modular control application.

The first module is `vehicle`, focused only on fuel usage and range estimation. The product name and application architecture must not bind the project permanently to motorcycles or fuel because future personal-control modules may be added later.

The current implementation must remain intentionally small. Future modules are not scaffolded until there is a concrete need.

## 2. MVP scope

The first release supports one vehicle and no in-app account system.

The vehicle module must provide:

- odometer readings;
- fuel entries;
- fuel spending totals;
- learned average consumption;
- calibration state;
- estimated fuel remaining;
- estimated remaining range;
- fuel-entry history;
- odometer history;
- offline operation;
- synchronization with Supabase when connectivity returns.

The UI does not expose vehicle registration, multiple vehicles, users, roles, permissions, maintenance, taxes, financing, insurance, general expense tracking, budgets, AI assistants, regional fuel-price APIs, or image/OCR capture.

Image-based odometer reading remains a future experiment and must not be required by the MVP architecture.

## 3. Product principles

1. Personal tool, not a SaaS product.
2. One app, modular internally.
3. Local-first behavior.
4. Manual input must always work.
5. Data must remain usable offline.
6. The application must not claim sensor-level precision.
7. The shortest reliable implementation wins.
8. No speculative abstractions.

## 4. Application architecture

Control Vault is a single React application.

Planned source structure:

```text
src/
├── app/
├── modules/
│   └── vehicle/
├── shared/
├── infrastructure/
└── styles/
```

Responsibilities:

### `app/`

Application bootstrap, routing, global providers, shell and top-level composition.

### `modules/vehicle/`

Everything specific to the vehicle domain:

- odometer;
- refueling;
- fuel calculations;
- calibration;
- range estimation;
- vehicle-specific UI;
- domain tests.

The module must not depend directly on Supabase-specific behavior for its calculations.

### `shared/`

Only code genuinely reused across modules. No speculative shared abstractions.

### `infrastructure/`

External and persistence concerns:

- local IndexedDB persistence;
- synchronization;
- Supabase client;
- connectivity state;
- Cloudflare-facing integration when required.

### `styles/`

Global design tokens, typography and application-level visual rules.

## 5. Frontend technology

Foundation:

- React;
- TypeScript;
- Vite;
- PWA/service worker support;
- IndexedDB for durable local state;
- Supabase for cloud persistence;
- Cloudflare for deployment and access control.

Dependency policy follows Ponytail:

- browser-native and platform-native features first;
- do not introduce a library unless it materially reduces risk or complexity;
- avoid infrastructure wrappers that only have one implementation;
- avoid state-management libraries until React state is demonstrably insufficient.

## 6. Access model

There is no authentication or user-account feature inside Control Vault.

The deployed application is personal and should be protected externally with Cloudflare Access.

The browser must never contain privileged Supabase credentials.

Any public client credential used by the frontend must be limited to the minimum permissions required by the synchronization design. Server-side or privileged secrets must remain outside the browser.

The exact Cloudflare and Supabase security configuration is an infrastructure task for the implementation plan, but the product requirement is fixed: no login flow inside the app.

## 7. Local-first data flow

The local database is the operational source used by the UI.

Primary flow:

```text
UI
 ↓
vehicle domain
 ↓
IndexedDB
 ↓
sync queue
 ↓
Supabase
```

A successful user action is committed locally first.

The UI must not wait for Supabase before confirming an odometer or fuel entry.

When online, pending local mutations are synchronized to Supabase.

When offline, the same operations remain available and are queued.

Cloud synchronization is backup/continuity infrastructure, not the immediate source used to render the app.

## 8. Domain records

### Odometer reading

Minimum record:

```text
id
reading_km
recorded_at
source
created_at
updated_at
```

Initial sources:

```text
manual
fuel_entry
```

A future camera/OCR source may be added without changing the odometer model.

### Fuel entry

Minimum record:

```text
id
odometer_km
amount
liters
full_tank
fueled_at
created_at
updated_at
```

`price_per_liter` is derived from amount and liters and does not need to be an authoritative stored field.

Money must not be represented using imprecise floating-point arithmetic in persisted domain data.

IDs must be generated client-side so records can be created offline before synchronization.

## 9. Odometer rules

The odometer is the authoritative measure of distance traveled.

Fuel entries may create odometer readings automatically.

A normal odometer update must satisfy:

```text
new_reading >= latest_reading
```

A value lower than the latest accepted reading is invalid and must not be persisted without explicit correction of the previous data.

Large positive jumps are not automatically invalid because the system cannot know every possible travel pattern. They should be treated as suspicious and require confirmation when they exceed a simple plausibility threshold.

The exact initial threshold should remain a small configuration constant, not a rules engine.

Future OCR must pass through the same validation. OCR output never bypasses domain rules.

## 10. Consumption learning

The system must support partial refueling.

Consumption must not be calculated by assuming every fuel entry fills the tank.

Full-tank entries are calibration anchors.

For a complete interval that begins with a known full tank and ends with the next known full tank:

```text
distance_km =
  ending_full_odometer - starting_full_odometer

fuel_used_liters =
  sum of liters added after the starting full event
  through and including the ending full event

cycle_km_per_liter =
  distance_km / fuel_used_liters
```

Partial fuel entries between the two full-tank anchors are included in the sum.

Only valid complete cycles contribute to the learned consumption estimate.

The first version should use a simple robust average over recent valid cycles rather than predictive AI or a complex statistical model.

## 11. Calibration state

The product exposes qualitative state, not fake precision.

States:

```text
calibrating
estimated
calibrated
```

The initial implementation should use a small number of valid full-tank cycles and observed consistency to transition between states.

Exact thresholds belong in implementation constants and tests, not in UI copy.

The UI must not show a confident range when the data is insufficient.

## 12. Estimated fuel ledger

After the application has a valid consumption estimate, fuel remaining is maintained as a derived ledger.

A full-tank event resets estimated fuel to configured tank capacity.

A partial fuel event adds the entered liters, capped at tank capacity.

Distance traveled consumes estimated fuel:

```text
distance_delta_km =
  current_odometer - previous_odometer

estimated_consumed_liters =
  distance_delta_km / learned_km_per_liter

estimated_fuel_liters =
  previous_estimated_fuel_liters
  - estimated_consumed_liters
  + partial_fuel_added
```

The derived value is clamped to a physically valid range.

Remaining range:

```text
estimated_range_km =
  estimated_fuel_liters * learned_km_per_liter
```

This is always presented as an estimate.

A later full-tank anchor provides a correction point and can reveal model drift.

## 13. Initial state

The preferred pilot starts immediately after a known full tank.

Initial setup therefore requires only:

- tank capacity as internal configuration;
- current odometer;
- confirmation that the tank is full.

No vehicle-registration interface is required.

If the app starts from an unknown fuel state, spending and odometer history may still be recorded, but fuel remaining and range stay unavailable until a reliable full-tank anchor exists.

## 14. Visual direction

The visual direction is inspired by the Alethe interface, translated to a quieter mobile utility.

Characteristics:

- deep graphite background;
- near-monochrome palette;
- off-white primary text;
- restrained borders;
- minimal cards;
- numbers as primary visual elements;
- Inter or equivalent sans for general text;
- a monospace family for metrics and technical values;
- short, fluid interactions;
- no decorative motorcycle-specific identity;
- no fintech-dashboard aesthetic;
- no neon/cyberpunk treatment.

The visual system belongs to Control Vault, not specifically to the vehicle module.

## 15. Copy rules

The UI assumes a single knowledgeable personal user.

Copy must be short and operational.

Examples:

- `Atualizar KM`
- `Abastecer`
- `Autonomia`
- `Consumo`
- `Calibrando`
- `Histórico`

Do not add explanatory helper copy for obvious controls.

Explanations appear only when required for an error, uncertainty, destructive action or data-integrity decision.

## 16. Initial navigation

The vehicle MVP should remain small.

Expected surfaces:

- Home;
- Update odometer;
- Add fuel entry;
- History.

Configuration that is rarely changed should not become a primary navigation destination.

The exact component layout is a frontend implementation concern, provided it respects the approved visual and copy principles.

## 17. Error handling

Domain validation happens before persistence.

Important failures:

- odometer regression: block;
- malformed numeric input: block;
- impossible negative amount/liters: block;
- suspicious odometer jump: require confirmation;
- local persistence failure: report failure and do not claim success;
- Supabase sync failure: preserve local data, keep the item pending and surface only a minimal sync state;
- duplicate synchronization: prevented by stable client-generated IDs and idempotent upsert behavior.

Connectivity loss must never discard an accepted local record.

## 18. Synchronization strategy

The MVP needs a small deterministic sync mechanism, not a generalized replication engine.

Requirements:

- local record first;
- pending/synced status kept locally;
- stable client-generated IDs;
- upsert to Supabase;
- retry on later connectivity;
- single-user conflict policy;
- deleted-record synchronization only if delete is included in the first UI.

If deletion is not part of the first release, tombstones are unnecessary.

Multi-user and collaborative conflict resolution are explicitly out of scope.

## 19. Testing strategy

Testing should focus on logic where mistakes would corrupt the useful output.

Required automated coverage:

- odometer monotonic validation;
- suspicious-jump classification;
- complete full-tank cycle calculation;
- partial fills inside a full-tank cycle;
- learned consumption calculation;
- estimated fuel ledger;
- range estimation;
- calibration transitions;
- local sync queue behavior;
- retry/idempotency behavior.

UI tests should cover only critical flows. Avoid broad snapshot suites.

## 20. Repository organization

The repository is the source of truth for architecture and infrastructure changes.

Planned top-level layout:

```text
control-vault/
├── .github/
├── docs/
│   └── superpowers/
│       └── specs/
├── public/
├── src/
├── supabase/
│   └── migrations/
├── tests/
├── .env.example
├── .gitignore
├── AGENTS.md
├── README.md
├── package.json
└── tsconfig.json
```

Directories should be created when implementation requires them. Empty speculative directories are not valuable.

Supabase schema changes must be represented as versioned migrations in the repository rather than existing only as dashboard state.

## 21. Codex handoff principles

Codex should receive:

1. this approved product/architecture spec;
2. a separate implementation plan generated after this spec is approved;
3. repository-local `AGENTS.md` instructions;
4. explicit instruction to use connected Supabase and Cloudflare capabilities for infrastructure work;
5. Ponytail/YAGNI constraints;
6. Superpowers workflow constraints;
7. frontend visual reference and copy rules.

Codex should not independently broaden MVP scope.

## 22. Explicit non-goals

Do not implement now:

- multiple vehicles;
- vehicle profiles in the UI;
- user accounts;
- app-level authentication;
- maintenance;
- taxes;
- insurance;
- financing;
- arbitrary personal expenses;
- budgets;
- financial categories;
- AI assistant;
- OCR/camera odometer reading;
- GPS tracking;
- regional fuel-price integrations;
- background location;
- predictive ML;
- generalized event sourcing;
- generalized repository/data abstraction layers;
- multi-tenant database design.

## 23. Success criteria

The first usable version succeeds when the user can:

1. open the installed PWA;
2. record the current odometer without internet;
3. record a fuel entry without internet;
4. see those records immediately;
5. reconnect and have pending data synchronize;
6. complete enough full-tank cycles for consumption calibration;
7. see a clearly labeled range estimate based on their own measured usage;
8. see fuel spending for the current period;
9. use the interface without explanatory clutter;
10. continue using the application if Supabase is temporarily unavailable.

## 24. Deferred decisions

The following are intentionally deferred until implementation evidence requires them:

- OCR provider and vision model;
- multiple vehicles;
- financial modules;
- richer analytics;
- advanced statistical confidence models;
- background sync beyond the minimum reliable PWA behavior;
- additional state-management libraries;
- generalized plugin/module runtime.

These are deferred, not partially scaffolded.
