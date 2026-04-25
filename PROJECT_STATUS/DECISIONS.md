# Vertex Core | Decision Log

Append-only architectural decision record (ADR-lite). When you reverse or supersede an entry, leave the original and add a new entry referencing it.

**Format**

```
### ADR-NNN — <short title>
- Date: YYYY-MM-DD (or phase tag)
- Status: Accepted | Superseded by ADR-MMM | Deprecated
- Context: why this came up
- Decision: what we chose
- Alternatives considered: what we did not choose, and why
- Consequences: what this commits us to
```

---

### ADR-001 — Vanilla JS / Firebase, no build pipeline

- **Date:** Project inception.
- **Status:** Accepted.
- **Context:** The team is one HVAC office staff + AI-assisted contributors, not a frontend org. We need to deploy, debug, and patch from anywhere (including a mechanic's phone via Firebase Hosting console) without a toolchain.
- **Decision:** Vanilla HTML/CSS/JS with Firebase compat SDK. **No React, no Vue, no Node backend, no Webpack/Vite.**
- **Alternatives considered:** React + Firestore (better componentization but adds bundler, transpile step, and an opinionated rendering model that doesn't fit the dispatcher's HTML-first sidebar layout). Next.js (rejected — would require a Node runtime).
- **Consequences:** Script load order matters (declared in `AI_CONTEXT_PROJECT_OVERVIEW.md §3`). Cache-busting requires manual `?v=N` bumps (`.cursorrules §5`). Globals on `window.*` are an accepted pattern, not a smell.

### ADR-002 — Tenant isolation under `tenants/{tenantId}/…`

- **Date:** Phase 10.
- **Status:** Accepted.
- **Context:** Vertex Core needs to support multiple HVAC shops on the same Firebase project without leaking data between them.
- **Decision:** All operational collections live under `tenants/{tenantId}/…`. Tenant id resolves from `APP_CONFIG.tenantId` with `localStorage.vc_active_tenant_id` as override. Default tenant is `USA_HEATING_COOLING`.
- **Alternatives considered:** One Firebase project per tenant (operationally heavy, expensive, and breaks shared admin tooling). Top-level collections with `tenantId` filter (cheaper but security rules become brittle).
- **Consequences:** Every new collection helper must go through `tenantRoot(db)` / `tenantCollection`. `.cursorrules §2` codifies this as a hard guardrail.

### ADR-003 — Lazy migration bridge for `TWIN_PILLARS`

- **Date:** Phase 11.
- **Status:** Accepted.
- **Context:** The original Twin Pillars production data lives at the **root** of Firestore (pre-tenant schema). Migrating in one shot risks downtime and regression for the live shop.
- **Decision:** When `getTenantId() === "TWIN_PILLARS"` (`isBridgeTenant()`), reads merge tenant + root snapshots (`subscribeServiceCallsMerged`, `subscribeSiteIntelligenceMerged`, `getServiceCallOnceBridged`, `getSiteIntelDocOnceBridged`, etc.). Writes go to the **tenant** path and may delete the root copy lazily.
- **Alternatives considered:** Big-bang migration script (downtime risk, hard to roll back). Permanent dual-write (doubles cost and creates conflict resolution headaches).
- **Consequences:** Every cross-cutting query for service calls / site intel must use the `*Merged` / `*Bridged` helpers, not raw `tenantCollection().get()`, when the bridge tenant might be active.

### ADR-004 — Terminology pivot: "Inter-Office Comms" / "Site Intel" / "Field Bible" / "Shadow Mode"

- **Date:** Phase 11.
- **Status:** Accepted.
- **Context:** Earlier prototypes used borrowed industry names ("ServiceTitan-style", "BuildOps-style", "Dark Channel" for internal notes) that confused both customers and competitors. We needed a brand-coherent vocabulary.
- **Decision:** Standardize on **Inter-Office Comms** (formerly Dark Channel / internal notes), **Site Intel** (formerly site notes), **Field Bible** (the persistent per-location notes textarea inside Site Intel), **Shadow Mode** (read-only dispatcher mirror of a tech's live screen).
- **Alternatives considered:** Keep the descriptive names ("Internal notes", "Location notes") — rejected because they don't scan as product features in UI / docs.
- **Consequences:** `.cursorrules §3` enforces this terminology in code, UI, and docs. Avoid "ServiceTitan", "BuildOps", "Dark Channel" anywhere user-facing or AI-facing.

### ADR-005 — Single unified technician notes box (no public/internal toggle)

- **Date:** Phase 27.
- **Status:** Accepted (supersedes the earlier two-channel design).
- **Context:** Field techs were fumbling the public/internal toggle in the Dictation Hub, leaking internal notes into customer-visible memos. The dispatcher had to clean it up after the fact anyway.
- **Decision:** One textarea on the technician side (`#dictationHubNotes`), debounced into `internal_comms`. The **dispatcher** is responsible for client-facing copy via the **AI Report Reviewer** (Phase 29) and the `clientPortalMemo` field.
- **Alternatives considered:** Keep the toggle but hide it behind a power-user setting (still failure-prone). Auto-classify with Gemini (unreliable and adds a per-keystroke cost).
- **Consequences:** `getDictationExportMode` returns `"internal"` for back-compat. Field evidence photos default to `isPublic: false` and the dispatcher promotes them before Proof of Service (Phase 16 evidence overrides remain the public-vs-internal control point).

### ADR-006 — Office Override over Shadow Mode for editing

- **Date:** Phase 30.
- **Status:** Accepted.
- **Context:** Dispatchers needed the ability to **edit** a job's notes / equipment / forms on behalf of a tech (e.g. fix formatting, inject context, add equipment). Shadow Mode is strictly read-only by design (ADR scope: training and supervision only).
- **Decision:** Add **Office Override** as a separate mechanism. **📱 Edit in Field App UI** opens the field app in an iframe with `?forceTicketId={id}&office_override=1`; the dispatch-board phone preview also opts into Office Override when a ticket is loaded (`scCurrentId` is set). A Firestore flag (`officeOverrideActive` / `officeOverrideBy` / `officeOverrideAt`) on the ticket doc broadcasts the state to the tech's real device so they can see when the office is editing.
- **Alternatives considered:** Make Shadow Mode editable behind a flag (rejected — breaks the read-only contract documented in `.cursorrules §4` and risks accidental dispatcher writes when only supervising). Build a parallel "office-edit" UI duplicating the field shell (rejected — would diverge from the tech's UX and double the maintenance).
- **Consequences:** Two distinct read-only-vs-editable surfaces share the same iframe. Override state must be visible on the tech's real device (orange frame + top strip) — this is what KI-001 currently breaks on physical mobile devices.

### ADR-008 — Office Override visual chrome via overlay div, not body `outline`

- **Date:** 2026-04-25 (KI-001 close-out, end of Phase 30).
- **Status:** Accepted.
- **Context:** Phase 30 shipped the Office Override flow with the orange screen frame rendered as `outline: 8px solid #f39c12 !important` on `<body>`. Field-tested on a real technician phone, the outline never appeared. Mobile Safari and Android Chrome clip outlines set on `<body>` as soon as the page scrolls or the document is taller than the viewport — which is always true for the field app workspace. The top warning strip `#vcOfficeOverrideGlobalStrip` was also using `z-index: 280`, well below the codebase's modal layers (`50000`, `30000`, `20050`, `10050`), so it was overdrawn by any open modal.
- **Decision:** Render the orange screen frame as a dedicated fixed-position overlay div (`#vcOfficeOverrideFrame`) injected as a direct child of `<body>`, with `position: fixed; inset: 0; border: 8px solid #f39c12; pointer-events: none; z-index: 100000;`. Toggle visibility via CSS keyed on `body.vc-office-override` (URL) and `body.vc-override-active` (dispatcher postMessage / Firestore flag) so a single source of truth drives both code paths. Bump `#vcOfficeOverrideGlobalStrip` to `z-index: 100001`. Add a fixed `min-height: 56px` fallback before the `calc(40px + env(safe-area-inset-top, 0px))` rule for older iOS Safari that resolves `env()` oddly. Both elements must remain direct children of `<body>` because any ancestor with `transform`, `filter`, `perspective`, or `will-change` set breaks `position: fixed` containment on iOS.
- **Alternatives considered:** Keep the `outline` and try `outline-offset` / `box-shadow inset` workarounds (rejected — same mobile clipping bug applies to `<body>`-level outlines). Use `position: fixed` rules directly on `<body>` (rejected — multiple sibling rules on `<body>` collide with PWA viewport behavior and the `padding-top` for the strip). Move the override chrome into the `#screen-workspace` shell only (rejected — the chrome must be visible on every screen, including schedule and history, so the tech sees the override state regardless of where they are when the dispatcher toggles).
- **Consequences:** All future full-viewport visual indicators in the field app must use a fixed-position overlay div as a direct child of `<body>` and cannot rely on `outline` on `<body>` (now codified as a Standing gotcha in `KNOWN_ISSUES.md`). The JS wiring (`handleOfficeOverride`, `applyOfficeOverrideFromTickets`) is unchanged — the bug was purely in the CSS rendering layer — so no `?v=N` cache-bust was needed (no external JS/CSS files were modified; only inline content of `technician/index.html`).

### ADR-007 — Memory architecture: split `CURRENT_STATE.md`, `KNOWN_ISSUES.md`, `DECISIONS.md` out of `PROJECT_MAP.md`

- **Date:** Memory system upgrade (this session).
- **Status:** Accepted.
- **Context:** `PROJECT_MAP.md → Current Focus` had grown into a multi-paragraph debugging journal for the Phase 30 blocker, polluting the implemented-features catalog. New AI sessions had no obvious "start here" file.
- **Decision:** Introduce three new files: `CURRENT_STATE.md` (session-resumable snapshot), `KNOWN_ISSUES.md` (open bugs + standing gotchas + resolved reference), `DECISIONS.md` (this file). `PROJECT_MAP.md` keeps Build History and the implemented-feature catalog; its `Current Focus` collapses to a 3-line pointer into the new files. `AI_CONTEXT_PROJECT_OVERVIEW.md` and `ROADMAP.md` are unchanged in role.
- **Alternatives considered:** Single `STATUS.md` covering current state + bugs + decisions (rejected — different update cadences; bugs and decisions both want append-only history while current state wants frequent overwrite). Inline ADR comments in code (rejected — invisible to AI session bootstraps).
- **Consequences:** `.cursorrules §1` updated to declare the recommended read order and the responsibility of each file. Future phases must update `CURRENT_STATE.md` per session and append a `DECISIONS.md` entry for any non-obvious choice.
