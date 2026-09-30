# Control Vault Design System

Status: approved implementation authority for the 2026-09-30 Operate redesign.

## Product scene

Control Vault is opened for a few seconds, usually on a phone and often beside the vehicle. The user needs to understand range immediately or record one value with one hand. The interface is an operating instrument, not a destination, dashboard collection or brand spectacle.

Mode: `Operate`.

Primary viewport: 390x844. Required adaptations: 320px, 430x932 and 1440x1000.

## Visual world: Obsidian violet instrument

The world combines dark fantasy atmosphere with scientific precision without using fantasy ornament or sci-fi clichés.

- Near-black graphite is the material.
- A restrained violet signal behaves like stored energy, not decoration.
- Off-white type reads like an instrument engraving lit in darkness.
- Depth comes from a subtle off-axis light field, vignette and tonal layers.
- A precise telemetry axis ties autonomy, range-days, remaining liters and fuel progress into one authored composition.
- Sparse ticks may encode a real measure. Decorative grids, scanlines, fake gauges, runes, HUD brackets and glowing container borders are prohibited.

The interface should feel quiet before interaction and momentarily luminous when a value changes.

## Inheritance boundary

From `lovable-credit-monitor`, retain only:

- the approved monospace stack for metrics;
- tabular figures and strong numeric spacing;
- cold gray plus restrained violet signal colors;
- short state transitions;
- `cubic-bezier(.16, 1, .3, 1)` where appropriate;
- 880ms fuel-progress/value motion;
- reduced-motion behavior.

Do not inherit its logo, BrandMark, panel layout, cyan container borders, repeated status dots/badges, filled icon catalog or nested cards.

## Typography

General UI text uses a native sans stack for fast reading. Metrics use the approved mono stack.

```css
--font-ui: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-metric: "SFMono-Regular", "Cascadia Code", "Roboto Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace;
```

- Operational text never drops below 12px.
- Body, navigation and control text target 13-15px.
- Labels stay compact through weight, tracking and contrast, not sub-11px sizing.
- Major metrics use tabular numbers, tight tracking and the metric stack.
- Do not use all-monospace text for forms, buttons or paragraphs.

## Color and light

Core roles:

- deep field: `#000000`;
- body field: `#000000`;
- lifted tonal layer: `#09070d`;
- primary text: `#f2f5f3`;
- secondary text: `#aab4b9`;
- quiet text: `#7d898f`;
- energy violet: `#a855f7`;
- deep energy violet: `#7c3aed`;
- pale energy violet: `#d8b4fe`;
- danger: `#ff7182`;
- warning: `#e9b86a`.

Use one asymmetrical violet radial light source near the autonomy/fuel axis over a true-black field. Glow is allowed only on active energy/progress and focus, never on every label or container.

## Geometry and grouping

- Every rectangular surface has `border-radius: 0`.
- No outer app frame.
- No cards around routine metrics, forms or actions.
- Borders do not define ordinary sections. Group with space, alignment, scale, contrast and tonal shifts.
- Functional lines are allowed for input baselines, progress tracks, temporal rails and focus.
- Semantically circular points may be circular.

## Home composition

The first viewport answers three questions in order: how far, for how long, and how much fuel remains.

1. `Autonomia` is the hero.
2. Approximate days sit in direct relation to the hero, never in a separate card.
3. Remaining liters, percentage and the energy rail form one physical fuel instrument.
4. `Abastecer` is the primary action; `Atualizar KM` is a quieter secondary action.
5. Monthly telemetry follows as an editorial ledger. Spend and distance dominate; count and average are one step quieter.
6. Consumption and odometer close the surface as technical references.

Absent data uses human copy: `Calibrando`, `Sem estimativa`, `Sem leitura`, `Sem base`, `Sem dados`. An em dash is never a data placeholder.

## Entry surfaces

Fuel and odometer share one compact grammar:

- 44px back affordance;
- short context label and title;
- current odometer prefilled;
- underlined numeric fields with large mono values;
- hints associated with their inputs;
- one clear submit action in the phone thumb zone;
- inline error and confirmation states that preserve input.

The mobile submit action is compact and sticky near the bottom safe area when the viewport allows it. It must remain reachable when the virtual keyboard reduces the visual viewport and must not become an oversized 80px CTA.

The dynamic fuel-price reference is quiet secondary copy. If absent, the interface says nothing about provider failure and imposes no invented ceiling. If the reference resolves after typing, the amount field clamps back to the derived ceiling.

## Full-tank control

Keep a native semantic checkbox. Present it as a straight-edged 44px row with a custom square mark, visible focus, strong checked state and no iOS-toggle imitation.

## History

History is an editorial evidence log grouped by local date.

- Date headings establish rhythm.
- A fine temporal rail may connect events without boxing them.
- Fuel amount leads, followed by odometer, estimated liters, full-tank state and time.
- Manual odometer rows lead with the reading and time.
- Fuel-generated odometer readings never render as a second event.
- Do not put an icon on every row.

## Login

Login shares the Obsidian instrument atmosphere. It is not a centered SaaS card.

- Product name and a restrained atmospheric signal establish continuity.
- Email, password and `Entrar` remain the only actions.
- The composition uses asymmetry and vertical rhythm rather than a large box or logo.

## Icons

Use the approved Boxicons Filled SVG paths for Home, History, Fuel and Odometer. Keep Back as a simple outline arrow. Do not add an icon dependency or decorate ordinary metrics/history rows.

## Motion

- Touch feedback is immediate: 120-180ms.
- View transitions are a single 180-220ms fade/translate, without staggered static-section choreography.
- Fuel progress may use `width 880ms cubic-bezier(.16, 1, .3, 1)` because the changing measure is the message.
- Count-up is limited to metrics whose value changed.
- Loading, focus and status must not wait for animation.
- Under `prefers-reduced-motion`, show final values immediately and preserve state contrast without movement.

## Accessibility and state

- Touch targets are at least 44x44px where practical, including `Sair`.
- Inputs expose `aria-invalid` and associate live hints/errors through `aria-describedby`.
- Route-like view changes move focus to the new heading or main view.
- Submit buttons expose `aria-busy` and `Salvando…` / `Entrando…` labels while pending.
- Successful local writes announce `Abastecimento salvo` or `Hodômetro atualizado`; remote sync remains silent.
- Focus indicators remain visible and high contrast.
- Safe-area insets apply to top, sides and bottom navigation/actions.

## Responsive behavior

Base styles are mobile-first.

- 320px: one column, 14px edge inset, no horizontal overflow, confirmation actions may stack.
- 390-430px: intended phone composition with useful Home data in the first viewport.
- Desktop: expand into a balanced instrument field with a wider Home telemetry composition; do not place a phone-width app inside a large empty desktop frame.
- Pointer/hover enhancements never carry required behavior.

## Pre-redesign audit record

Independent Impeccable assessments found a sound functional foundation and zero deterministic detector violations. Design review score: 32/40. Technical health was strong, with verified contrast, semantics, reduced-motion support and no overflow on the unauthenticated surface at 320px and 1280px.

Priority corrections carried into this contract:

1. Raise 9-11px operational text to a readable mobile floor.
2. Add explicit local-write pending and success feedback.
3. Remove staggered 340-400ms static page choreography.
4. Create a product-specific autonomy/fuel axis beyond generic dark telemetry.
5. Establish first- and second-tier monthly metrics.
6. Manage focus and programmatic input validity.
7. Raise the sign-out target to the 44px product floor.


## Final mobile navigation rule

The bottom navigation has no visual bar, gradient, blur, backdrop or container chrome. Only the Home/History controls are visible and interactive above the black field. The navigation wrapper itself must not intercept pointer events outside those controls.

## Final copy rule

Do not explain calibration mechanics on Home. `Calibrando` is sufficient. Do not render `desde o cadastro` under monthly distance. History entries lead directly with the meaningful value/detail; do not render redundant event labels such as `Abastecimento` or `Hodômetro atualizado`.
