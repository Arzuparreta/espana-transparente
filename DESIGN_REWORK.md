# España Transparente Rework — Design Consultation

Date: 2026-05-20  
Source plan: `arsu-main-design-20260520-153430.md`  
Status: Build-ready design direction

## Executive Decision

The rework should not replace the current visual identity. It should evolve it from **Forensic Minimalism** into **Forensic Atlas**.

The current design is strong at making individual records feel serious. The product problem now is that the portal is larger than its entry points: many useful datasets are present, but a first-time visitor cannot see the map. The rework is therefore about orientation, source confidence, and navigable trace chains.

## Product Diagnosis

The repo now contains a real civic data product:

- 15+ public-data tables and views.
- Public routes for deputies, Senate, government, parties, voting, budgets, contracts, subsidies, EU funds, organizations, indicators, institutions, revolving doors, search, and data status.
- A `ContextTrail` component already started for in-UI recovery.
- A global search system backed by `search_documents`.
- A home page with three anchors, government, recent votes, and revolving-door cases.

The issue is not lack of data. The issue is product legibility:

- The home page does not expose the full data surface.
- Deep pages are stronger than the front door.
- Source freshness is present in data layers but not consistently surfaced.
- The planned public-money funnel needs a visual system before implementation.

## Memorable Thing

A new visitor should remember this:

> This is the map of official records: what exists, where it comes from, and what each record connects to next.

That sentence drives the design. It is not UI copy.

## Research Notes

I checked the category before writing the system:

- TheyWorkForYou foregrounds search, representative lookup, parliamentary sections, and recent activity. Its strength is making many parliamentary surfaces visible from the top level.
- USAspending is built around spending exploration and drill-down from large categories into award records.
- CiviPortal-style financial transparency products converge on overview metrics, budget analysis, transaction search, vendor summaries, project pages, and data downloads.
- Civio is closer to Spanish civic-data credibility, but its format is journalism and investigations, not a neutral record explorer.

Design implication: the category baseline is **search + section map + recent records + drill-down**. España Transparente should keep the record-first severity, but add a clearer atlas layer. The opportunity is not prettier charts. The opportunity is a visible cross-source chain.

## Proposed Design System

### Aesthetic

Forensic Atlas:

- Dark-first.
- Dense but not cramped.
- Source-led.
- Left-anchored.
- Minimal decoration.
- Sharp edges.
- Mono data.
- No softness unless it improves legibility.

### Palette

Keep the current palette from `DESIGN.md`:

- Background: `#0B0B0A`
- Surface: `#141412`
- Surface alt: `#1D1D1A`
- Text: `#EEEDE9`
- Muted: `#999992`
- Signal: `#C8FF00`
- Border: `#2A2A27`

The main cleanup is documentation alignment: old references to red `#A1242C` are obsolete.

### Typography

Keep:

- Cabinet Grotesk for display and route titles.
- Geist for body and UI.
- Geist Mono for every amount, count, date, ID, section code, percentage, and source timestamp.

The rework should use less giant hero type inside dense panels. Hero scale belongs to the brand line and primary route headers, not every card.

### Layout

Move from pure poster-first to map-first:

- First viewport: brand, search, and factual anchors.
- Second viewport: `Qué hay aquí` index with all major verticals.
- Deep pages: context trail, record header, facts, related next steps, source footnote.
- Flagship route: cascade with expandable nodes and deep links.

### Motion

Minimal-functional only:

- Keep navigation progress.
- Keep accordion/disclosure motion.
- Avoid hover float and decorative entrance animation.

## Safe Choices

- Keep the dark forensic identity.
- Keep the existing shared primitives instead of inventing a parallel component system.
- Keep search prominent.
- Keep factual Spanish labels.
- Keep `IPC mensual` as a home anchor for now because the reviewed plan rejected a decontextualized divergence widget.

## Creative Risks

1. **Home as atlas, not dashboard.**  
   The home should show the full product map, not just a few impressive metrics. Cost: it is less visually dramatic than a pure hero. Gain: first-time comprehension.

2. **Source metadata everywhere.**  
   Per-section source/freshness/coverage footers can feel utilitarian. Cost: more density. Gain: trust, auditability, and fewer claims that records are invented.

3. **Spending funnel as cascade.**  
   The flagship route should be a navigable data chain, not a narrative page. Cost: harder layout, especially mobile. Gain: the product's unique integration becomes usable.

## Naming Guidance

Avoid names that sound like accusation or campaign copy.

Recommended route labels:

- Primary route: `Dinero público`
- Page title: `Trazabilidad del gasto`
- Section labels: `Presupuestos`, `Ministerios`, `Programas`, `Contratos`, `Subvenciones`, `Fondos UE`, `Organizaciones`, `Fuentes`

Avoid for UI unless user explicitly approves:

- `Cómo se gasta tu dinero`
- `Seguir el dinero`
- `El hilo del poder`

Those may be useful internal shorthand, but they add tone. The interface should stay factual.

## Artifact Set

This root-level bundle is meant for iteration with product, design, and engineering:

- `arsu-main-design-20260520-153430.md` — PM-approved planning source.
- `DESIGN.md` — durable visual system.
- `DESIGN_REWORK.md` — consultation synthesis and decisions.
- `REWORK_SCREEN_SPECS.md` — screen-level design specs.
- `REWORK_IMPLEMENTATION_PLAN.md` — implementation sequence and verification.
- `design-rework-preview.html` — static visual preview for the rework direction.

## Cleanup Decisions

- Removed `BASES_FILOSOFICAS.md`. It duplicated the internal lens, used the legacy Acción Humana framing, and increased the risk of mixing methodology into product work. `AGENTS.md` and `PLAN.md` remain the internal context.
- Removed `hero_container_screenshot.png`. It was a stale screenshot artifact in the repo root.
- Kept `SEARCH_REWORK_PLAN.md` because it appears to describe active search work rather than stale design material.

## Implementation Warnings

- Current `web/package.json` is Next.js 14. The reviewed plan mentions `use cache`; do not use it until the app is actually upgraded. Continue with `unstable_cache` in current code.
- `ContextTrail` already exists. Extend it before inventing a new navigation component.
- `web/src/app/sitemap.ts` currently enumerates static routes plus deputies and parties. The sitemap work should not be deferred.
- Do not reintroduce red as the signal color. `#C8FF00` is the active design decision.

## Research References

- https://www.theyworkforyou.com/
- https://www.usaspending.gov/
- https://www.civiportal.com/
- https://civio.es/
