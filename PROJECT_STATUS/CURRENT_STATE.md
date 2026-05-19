# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 64 AI Quote Pipeline — queue verified, preflight passed, ready for overnight SDK run (`/a`). Phase 66/63 live. KI-004 core shipped.
- **Last shipped (2026-05-18):** Admin checklist save fix — `form_templates` write allowed without Firebase Auth; immediate toast + confirmation; editor closes on save; **Sync Ticket** hidden in admin workspace. `VC_BUILD: AdminSaveFix-2026-05-18`.
- **Prior (2026-05-18):** Admin checklist cards + editor; admin full AI chat; debug overlay drag.
- **Prior (2026-05-18):** Admin workspace full AI (`VCAdminAgent` bypasses intent engine); admin job tech roster picker.
- **Prior (2026-05-18):** Admin job create assigned-tech dropdown loads full roster; voice search CRM numbers.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.
- **Fix tracker canvas:** `issues-found-fix-tracker.canvas.tsx` (#issues-found backlog).

## Active Blocker

None.

## Immediate Next Step

- **Device verify:** Admin FAB → tap mic → speak → tap again → **picker if 2+ CRM locations** (e.g. Planet Fitness Green Bay).
- **Product queue:** **KI-006** past-day job UX.
- **Tonight at bedtime only:** SDK `/a` Phase 64 (64a→64b→64c→64e→64d). Do not run before bed unless user asks.
- **After overnight run:** `.build_state.json` + runner log; reconcile what changed.
- **Optional:** KI-004 URL-patch on outbox drain; compiled report edit persistence.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
