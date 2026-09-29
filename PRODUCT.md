# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One knowledgeable personal user operating Control Vault primarily on a phone, including while offline.

## Product Purpose

Control Vault is a personal, modular control application. Its first module, `vehicle`, records odometer and fuel activity locally, learns estimated consumption, presents conservative estimated autonomy, and synchronizes authenticated continuity data when connectivity is available.

## Positioning

The application treats IndexedDB as the operational store and Supabase as authenticated remote continuity. Accepted vehicle records remain usable without network access or an active remote session.

## Operating Context

- Mobile-first PWA used during odometer updates and refueling.
- One personal account and one vehicle.
- Manual odometer and fuel-spend entry.
- Weekly public fuel-price reference may estimate liters but never blocks a local write.
- Short operational Portuguese copy.

## Capabilities and Constraints

- React, TypeScript and Vite.
- IndexedDB-first persistence with stable client-generated IDs.
- Supabase Auth and ownership RLS as the security boundary.
- No public sign-up, profiles, roles, collaboration or multi-user behavior.
- No vehicle registration, maintenance, taxes, insurance, financing, OCR, GPS or predictive ML.
- Domain calculations remain independent from React, IndexedDB and Supabase.
- The redesign must not change the Supabase schema, add migrations or alter the validated local-first/sync architecture.

## Brand Commitments

- Product name: Control Vault.
- `C:\Users\pedro.borges\vault\lovable-credit-monitor` is the authorized literal source for the visual system.
- The extension implementation, especially `DESIGN.md`, `src/panel.css`, `src/icons.js`, `src/content.js`, `src/brand.js` and `EXTENSION_README.md`, is visual authority rather than loose inspiration.
- Rectangular Control Vault surfaces deliberately use `border-radius: 0`; semantically circular dots and indicators remain circular.
- No second design system, automotive branding, fintech-dashboard treatment, generic cyberpunk interpretation or decorative modernization.

## Evidence on Hand

- Approved foundation spec: `docs/superpowers/specs/2026-09-29-control-vault-foundation-design.md`.
- Approved vehicle v2 spec: `docs/superpowers/specs/2026-09-29-control-vault-vehicle-model-v2-design.md`.
- Source visual repository at commit `05f9af1ea225ad69ae1b5fe0c2914870fd39b402`.
- Existing React application with 144 passing tests and a successful production PWA build before redesign work.

## Product Principles

1. Personal tool, not a SaaS product.
2. Local writes succeed independently of remote providers.
3. Show estimated vehicle data honestly rather than implying sensor precision.
4. Keep copy short and operational.
5. The shortest reliable implementation wins.

## Accessibility & Inclusion

Keyboard focus must remain visible, interactive targets remain at least 44px where practical, semantic labels and live error roles remain intact, and `prefers-reduced-motion` must disable nonessential motion and metric animation.
