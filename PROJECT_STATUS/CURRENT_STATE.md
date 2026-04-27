# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** **Phase 34b** — drafting 9 default seed templates. **PAUSED 2026-04-26 awaiting user approval on v2 question sets.**
- **Last shipped (2026-04-26):** Phase 34a (form-builder schema + UI: category, job-type chips, repair-type chips, isDefault, sortIndex, Toggle field type, up/down reorder arrows). `index.html` cache-bust `settings.js?v=16`, `VC_BUILD = "Phase34a-2026-04-26"`. Per-commit detail will go into `PROJECT_MAP.md → Build History → Phase 34a` once verified.
- **Phase 33 verification** still pending on-device (smoke-tests a/b/c per `PHASE_34_HANDOFF.md → §2`); not blocking 34b.
- **Default tenant:** `USA_HEATING_COOLING`. TWIN_PILLARS branding is dead (per user 2026-04-25); lazy-migration bridge in `shared/firebase_logic.js` left quiet.

## Active Blocker

**Phase 34b — awaiting user approval on v2 question sets.** Full v2 draft, user revision rules, open questions, and stable seed-id metadata live in `PHASE_34_HANDOFF.md → §1.5`. Do NOT write `shared/repair_form_seeds.js` until user replies with `"Approved — implement"` / inline edits / per-template approvals.

Non-blocking carry-overs (Phase 33 follow-ups, no field-impact):
- `KI-003` — Office Override iframe parity gap (design `ADR-013`; sequenced behind 34 ship).
- `KI-004` — Field-app photo uploads dropped offline (design `ADR-012`; ships as 33 follow-up patch).

## Immediate Next Step — Phase 34b approval gate

1. **User reads `PHASE_34_HANDOFF.md → §1.5`** (v2 question-set draft + revision rules + open questions).
2. **User replies** with `"Approved — implement"` / inline edits / per-template approvals.
3. **On approval:** apply any inline edits, grep dispatcher PIN pattern in `settings.js` + `index.html` (REUSE existing — do NOT invent), then write `shared/repair_form_seeds.js?v=1`, wire admin button in `#fieldFormBuilderSection` next to "+ Create New Template", bump `settings.js?v=17` and `VC_BUILD = "Phase34b-<ship-date>"`. **One commit. Dispatcher-only — do NOT touch `technician/index.html`.**

## On Deck

- Phases **34c → 34d → 34e** — full specs in `PHASE_34_HANDOFF.md → §3 / §4 / §5` (do not re-derive).
- `ROADMAP.md → Next Up` — Command Map TV Mode, Field Inventory Truck Stock.
- `ROADMAP.md → Minor Tweaks & Polish` — KI-002 leftovers (B5/B6/B7, C1, C2, C4, E1, E3, E4); opportunistic only.
- `ROADMAP.md → Icebox` — `ticketClass` (Service vs Project) epic; ADR before code.
- Standing maintenance: Firestore rules for `portal_tokens` / `labor_logs`, optional short URL for Proof of Service, optional composite index for `labor_logs`, print/PDF chart timing, legacy `dispatcher/index.html` redirect-stub archive.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session, even if "no progress."
- When a phase ships: full detail goes into `PROJECT_MAP.md → Build History` (flip `[ ]` to `[v]`); keep only a one-line pointer here.
- When a blocker resolves: move entry from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Hard size cap:** if this file exceeds ~30 content lines, immediately migrate excess.
