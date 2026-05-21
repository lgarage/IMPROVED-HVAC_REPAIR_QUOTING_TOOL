# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 65 ALL slices shipped. KI-004 hooks + B6 SW cache hygiene shipped.
- **Last shipped (2026-05-20 22:00 CDT):** KI-004 contextHook callbacks — `drain()` now gets download URL after upload and invokes registered hooks to patch Firestore docs (7 call sites wired). B6 SW cache — `CACHE_NAME` bumped to `vertex-cache-v4`. `VC_BUILD: KI004-Hooks-2026-05-21`.
- **Prior (2026-05-20):** Nav guard z-index fix (raised to 100001). Customer Confirmation feature.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

On-device field test — force-reload PWA until BUILD shows `KI004-Hooks-2026-05-21` (VC DEBUG overlay). Test offline photo: take photo in airplane mode, re-enable signal, verify photo uploads and Firestore doc URL field is patched. Separately, the "first job of day Schedule pill broken" bug reported May 17–18 may still need investigation if it recurs.

> **On Deck / future ideas:** see `ROADMAP.md`. Fix tracker: `canvases/issues-found-fix-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
