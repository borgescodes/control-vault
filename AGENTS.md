# AGENTS.md

## Start here

Before changing code, read these files in order:

1. `docs/superpowers/specs/2026-09-29-control-vault-foundation-design.md`
2. `docs/superpowers/plans/2026-09-29-control-vault-vehicle-mvp.md`
3. `MODEL_ROUTING.md`

Treat the approved spec as the product/architecture source of truth, the implementation plan as the execution order, and `MODEL_ROUTING.md` as the capability/effort policy for each task.

## Required workflow

- Use Superpowers before implementation work.
- Keep Ponytail in `full` mode for the whole implementation.
- Execute the implementation plan task-by-task, in order.
- Before every task, consult `MODEL_ROUTING.md` and select the recommended model/reasoning effort or an explicitly justified escalation.
- If the current execution environment cannot switch model/effort, report the recommended route before starting instead of claiming it was applied.
- Re-route if the task materially changes scope while executing.
- Use TDD for non-trivial domain, persistence and synchronization behavior.
- Make one meaningful commit per task.
- Run the task verification commands before claiming a task is complete.
- Use Superpowers verification-before-completion before declaring the MVP foundation ready.

## Provider work

For any Supabase work:

- Use the connected Supabase plugin.
- Verify current Supabase docs/changelog before schema, Auth or RLS changes.
- Keep schema changes represented as versioned migrations in the repository.
- Run relevant Supabase advisors before committing provider changes.
- Never expose `service_role` or secret keys in browser code.

For any Cloudflare work:

- Use the connected Cloudflare plugin.
- Keep provider credentials out of the repository.
- Treat Cloudflare as frontend hosting for this MVP unless the approved spec/plan is explicitly changed.

## Current product constraints

Control Vault is one modular app.

The first module is `vehicle`.

MVP constraints:

- one personal authenticated account;
- one vehicle;
- Supabase Auth only as a security boundary;
- no public sign-up;
- no profiles, roles or collaboration;
- no multi-user product behavior;
- no vehicle registration UI;
- local-first operation;
- IndexedDB is the operational local store;
- Supabase is remote persistence/continuity;
- manual odometer and fuel entry must work offline;
- no maintenance, taxes, financing, insurance or generic personal-finance module yet;
- no OCR/camera flow yet;
- no GPS;
- no predictive ML;
- no generalized event sourcing or repository abstraction layer.

Do not scaffold future modules until there is a concrete approved need.

## Security constraints

- Browser uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Every exposed application table must have RLS enabled.
- Ownership policies must enforce `auth.uid() = user_id`; `TO authenticated` alone is insufficient.
- Update policies require both `USING` and `WITH CHECK`.
- Local data must not be deleted when the Auth session expires or the user signs out.
- Stable client-generated IDs are required for offline creation and idempotent sync.

## Architecture constraints

Target source structure:

```text
src/
├── app/
├── modules/
│   └── vehicle/
├── shared/
├── infrastructure/
└── styles/
```

Keep domain calculations pure and independent from React, IndexedDB and Supabase.

Use native/browser features before adding dependencies.

Do not add Redux, Zustand, React Query, Tailwind, shadcn, a form library, a date library or a router unless the current task proves the native/minimal approach is insufficient.

## UI direction

The UI should follow the approved Alethe-inspired direction:

- deep graphite;
- near-monochrome;
- off-white primary text;
- restrained borders;
- minimal surfaces/cards;
- metrics as primary visual elements;
- sans-serif general text;
- monospace metrics;
- short motion;
- no motorcycle-specific branding;
- no fintech-dashboard look;
- no neon/cyberpunk treatment.

Copy is short and operational.

Prefer:

- `Atualizar KM`
- `Abastecer`
- `Autonomia`
- `Consumo`
- `Calibrando`
- `Histórico`

Do not add helper paragraphs for obvious controls.

## Scope control

If current provider behavior, implementation evidence or tests conflict with the plan, stop and update the spec/plan before broadening architecture.

Do not silently invent new product scope.

The shortest reliable implementation that satisfies the approved spec wins.
