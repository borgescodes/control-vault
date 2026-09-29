# Model Routing

This document defines the default model and reasoning-effort routing for agentic work in Control Vault.

Source guidance: https://developers.openai.com/api/docs/guides/model-selection

The OpenAI model-selection guide should be treated as the upstream reference. This file adapts that guidance to this repository's risk profile and implementation plan.

## Core rule

Use the lightest model/effort pair that can reliably meet the task's quality bar.

Escalate for ambiguity, security, data integrity, cross-cutting changes, or difficult verification.

Do not select Astra merely because a task is large. A clear implementation plan usually favors Sol.

Do not select Luna for work where a plausible mistake could corrupt persisted data, weaken authorization, or create subtle offline/synchronization bugs.

## Available routing levels

The current OpenAI guidance characterizes the model/effort pairs as follows:

| Model | Effort | Project interpretation |
| --- | --- | --- |
| Luna | Low | Fine-grained edits, simple extraction, trivial mechanical changes |
| Luna | Medium | Clear briefs, scaffolding, coordinated but well-defined updates |
| Luna | Extra high | Broad context gathering with clear constraints |
| Sol | Low | Focused writing/editing and straightforward verification |
| Sol | Medium | Default engineering route for normal coding requiring judgment |
| Sol | Extra high | Security-sensitive work, data integrity, deep debugging, careful verification |
| Astra | Low | High-fidelity content adaptation where nuance matters |
| Astra | Medium | Architectural or broad cross-cutting work requiring large context |
| Astra | Extra high | Hard, ambiguous, exacting work after simpler routes prove insufficient |

## Default by activity

### Luna / Low

Use for:

- typo fixes;
- small README edits;
- copy changes with no behavioral impact;
- renaming one well-scoped symbol;
- extracting or summarizing already-known repository facts.

Do not use when behavior, persistence or security changes.

### Luna / Medium

Use for:

- initial scaffold from an approved plan;
- package/config wiring with known values;
- CI setup;
- simple environment templates;
- coordinated mechanical edits across a few files;
- straightforward documentation derived from approved decisions.

Escalate to Sol if implementation judgment becomes material.

### Luna / Extra high

Use sparingly for:

- repository reconnaissance across many files/apps when the question is still well constrained;
- triage before deciding which implementation task owns a problem.

Do not use as a substitute for Sol on difficult coding.

### Sol / Low

Use for:

- focused technical documentation;
- reviewing a small, obvious diff;
- fact-checking config against current provider docs;
- narrow code edits where behavior is already fully pinned by tests.

### Sol / Medium

This is the default implementation route.

Use for:

- normal React/TypeScript features;
- component work;
- ordinary refactors;
- unit tests;
- IndexedDB code with well-defined contracts;
- PWA configuration;
- Supabase client wiring after schema/security decisions are already fixed;
- Cloudflare deployment work with a clear provider path;
- routine bug fixes with an identified root cause.

### Sol / Extra high

Use when mistakes carry meaningful security or data-integrity risk.

Use for:

- Supabase Auth and RLS;
- schema ownership rules;
- persisted money/data representation;
- local-first synchronization;
- idempotency/retry logic;
- atomic IndexedDB writes;
- vehicle consumption/calibration/range calculations;
- subtle offline/session interactions;
- difficult debugging;
- final verification of security-sensitive tasks.

### Astra / Low

Not a normal engineering route for this repository.

Use only when high-fidelity rewriting/adaptation is the actual task.

### Astra / Medium

Use for:

- architecture changes spanning multiple modules;
- changing the local-first/sync model;
- revising the security model;
- major plan/spec revisions;
- broad integration review after the implementation tasks complete;
- problems where correct resolution requires understanding most of the repository at once.

### Astra / Extra high

Reserve for:

- unresolved architecture/security problems after Sol Extra high investigation;
- contradictory evidence across multiple subsystems;
- repeated failed approaches where the root cause is still unclear;
- exacting cross-system work where a wrong decision would force significant rework.

This is an escalation route, not a default.

## Escalation rules

Escalate from Luna to Sol when any of these becomes true:

- non-trivial branching or domain logic appears;
- more than mechanical coordination is required;
- persistence behavior changes;
- Auth/RLS/security is involved;
- offline behavior matters;
- failure could corrupt or lose user data;
- tests expose an unexpected interaction.

Escalate from Sol Medium to Sol Extra high when:

- authorization boundaries are being changed;
- persisted values or calculations determine user-facing financial/range data;
- sync/retry/idempotency is involved;
- the bug is not explained after normal root-cause investigation;
- verification must cover several failure modes.

Escalate from Sol to Astra when:

- the task becomes architectural rather than implementational;
- several modules/interfaces need to change together and the approved plan no longer determines the answer;
- there are competing valid designs with consequential trade-offs;
- repeated Sol Extra high attempts fail to establish a reliable direction.

Do not escalate only because a task is time-consuming.

## De-escalation rules

Use a lighter route when:

- the hard decision has already been made and the remaining work is mechanical;
- tests fully pin the required behavior;
- a large task decomposes into small independent edits;
- provider documentation resolves the ambiguity.

Astra may design a change while Sol or Luna implements the resulting clear plan.

## Control Vault implementation-plan routing

Default routing for:

`docs/superpowers/plans/2026-09-29-control-vault-vehicle-mvp.md`

| Task | Work | Model | Effort | Reason |
| --- | --- | --- | --- | --- |
| 1 | Repository foundation and guardrails | Luna | Medium | Clear scaffold/config work from an approved plan |
| 2 | Supabase schema, Auth boundary and RLS | Sol | Extra high | Authorization and database security |
| 3 | Supabase client and authentication gate | Sol | Extra high | Session/security behavior and offline interaction |
| 4 | Local IndexedDB persistence | Sol | Medium | Well-defined persistence contracts with tests |
| 5 | Vehicle domain calculations | Sol | Extra high | Calculation correctness directly affects range/consumption |
| 6 | Initial setup, odometer and refueling flows | Sol | Medium | Normal feature implementation with domain contracts already fixed |
| 7 | Home dashboard and visual system | Sol | Medium | UI implementation requiring judgment but low architectural risk |
| 8 | Authenticated Supabase synchronization | Sol | Extra high | Data integrity, idempotency, retry and offline behavior |
| 9 | PWA behavior and Cloudflare deployment | Sol | Medium | Clear integration/deployment path |
| Final | Whole-implementation integration review | Astra | Medium | Broad context and cross-task verification |

## Review routing

Use a reviewer at least as capable as the implementation route for security/data-integrity work.

Recommended:

- Luna implementation -> Sol Low/Medium review when behavioral code changed.
- Sol Medium implementation -> Sol Extra high review for persistence/domain changes.
- Sol Extra high implementation -> Astra Medium review when the change spans multiple security/data boundaries.
- Final whole-branch review -> Astra Medium.

Do not require Astra review for trivial documentation or mechanical changes.

## Source-faithful visual redesign routing

Default routing for:

`docs/superpowers/plans/2026-09-29-control-vault-source-visual-redesign.md`

| Task | Work | Model | Effort | Reason |
| --- | --- | --- | --- | --- |
| Planning | Source audit, spec and plan revision | Astra | Medium | Exact cross-repository adaptation and durable visual authority |
| 1 | Source SVGs and token foundation | Sol | Medium | Exact but normal React/CSS implementation |
| 2 | Count-up and progress motion | Sol | Medium | Small behavioral UI helper with deterministic tests |
| 3 | Shell and authentication surface | Sol | Medium | Existing component restyle with behavior preserved |
| 4 | Home telemetry dashboard | Sol | Medium | Primary UI composition and state presentation |
| 5 | Setup surface | Sol | Medium | Bounded form presentation |
| 6 | Odometer and fuel surfaces | Sol | Medium | Existing validated actions with new presentation |
| 7 | History evidence rail | Sol | Medium | Bounded list presentation |
| 8 | Integrated states, responsive and PWA chrome | Sol | Medium | Cross-view visual integration without data changes |
| 9 | Visual verification and documentation | Astra | Medium | Whole-surface source comparison and integration review |

## Debug routing

Start with the route appropriate to the failing subsystem.

- obvious localized defect -> Sol Medium;
- persistence/sync/Auth/calculation defect -> Sol Extra high;
- root cause still unclear after systematic debugging -> Astra Medium;
- cross-system contradiction or repeated failed fixes -> Astra Extra high.

Always use the Superpowers systematic-debugging workflow before escalating solely due to repeated failure.

## Provider routing

Supabase and Cloudflare tasks must use current provider documentation/plugins regardless of model.

Model strength does not replace current documentation.

For Supabase security/schema work, prefer Sol Extra high even when the SQL diff is small because the failure cost is high.

For Cloudflare static deployment/configuration, Sol Medium is normally sufficient unless the deployment architecture changes.

## Operator/agent behavior

The operator selects the model and reasoning effort in the Codex GUI before each task.

Before starting an implementation-plan task:

1. Read the task.
2. Read this file.
3. The operator selects the task's recommended model/effort in the Codex GUI.
4. The agent checks whether the task still matches that routing.
5. If execution reveals materially higher/lower complexity or risk, the agent reports the recommended re-route before continuing.

Model routing is an operator decision aid, not an agent-side capability gate.

The agent should not block merely because it cannot inspect or change the GUI-selected model/effort. It should only flag a routing mismatch when the actual task profile has changed or when the operator explicitly asks for a routing check.

## Relationship to Superpowers and Ponytail

Model routing chooses capability.

Superpowers controls process.

Ponytail controls implementation complexity.

All three apply together.

A stronger model is not permission to broaden scope, skip tests, add abstractions, or ignore the approved spec/plan.

## Maintenance

This file is project policy, not a frozen statement about OpenAI models.

Re-check the upstream model-selection guide when:

- model names/availability change;
- reasoning-effort levels change;
- Codex exposes new routing controls;
- repeated project evidence shows a lighter/heavier route is consistently more appropriate.

Prefer measured project outcomes over model prestige.
