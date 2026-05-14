# Model Lookup Table (Automation)

> **Purpose:** Compact lookup for the SDK build runner. One row per task pattern. Max 50 rows.
> **Updated by:** `tools/build_runner.ts` after each slice. Manual edits welcome.
> **Rule:** When a cheaper model succeeds on a pattern, update "Cheapest OK." When a model fails, bump it up. Never lower below "Floor."
> **Stale rule:** Rows older than 30 days get re-tested at cheapest tier on next matching slice.

| Pattern | Cheapest OK | Floor | Last verified | Notes |
|---------|-------------|-------|---------------|-------|
| UI container / HTML+CSS layout | composer-2 | — | 2026-05-13 | From outcome log: field app small UI removals, accordion changes |
| CSS-only restyle / theme | composer-2 | — | 2026-05-13 | From outcome log: admin tab visual restyle |
| Single-file JS bugfix | composer-2 | — | 2026-05-13 | From outcome log: shadow consent race fix, UWP silent photo fix |
| Multi-file UI feature (no Firestore writes) | claude-4.6-sonnet | — | 2026-05-13 | From outcome log: equipment hub card thumbs, UWP per-card OK |
| New JS module (IIFE, no Firestore) | claude-4.6-sonnet | — | 2026-05-13 | From outcome log: entitlements.js, user_entitlements.js |
| Speech API / media capture integration | claude-4.6-sonnet | — | 2026-05-13 | Estimated from mobile file input + dictation hub patterns |
| Cross-module wiring (3+ files) | claude-4.6-sonnet | — | 2026-05-13 | From outcome log: per-user feature toggles slices 2-4 |
| Pure regex / dictionary logic | gpt-5.3-codex | — | 2026-05-13 | Estimated — code-heavy, no UI, no Firestore |
| Gemini prompt integration | claude-4.6-opus | claude-4.6-opus | 2026-05-13 | From outcome log: unit work parser, field chronicle Gemini compile |
| Firestore multi-read (query, no writes) | claude-4.6-sonnet | — | 2026-05-13 | From outcome log: equipment hub full unit history |
| Firestore write path (new collection/doc) | claude-4.6-opus | claude-4.6-opus | 2026-05-13 | Vertex Core rule — never below Strong |
| Firestore rules / auth changes | claude-4.6-opus | claude-4.6-opus | 2026-05-13 | From outcome log: per-user feature toggles slice 1 |
| Firebase config / project migration | claude-4.6-opus | claude-4.6-opus | 2026-05-13 | From outcome log: twin-pillars → vertex-core-db |
| Dispatcher modal (read-only Firestore) | claude-4.6-sonnet | — | 2026-05-13 | From outcome log: customer directory site history modal |
| Hamburger menu / nav chrome | composer-2 | — | 2026-05-13 | From outcome log: workspace chrome cluster |
| Dictation hub labels / hints / copy | composer-2 | — | 2026-05-13 | From outcome log: dictation hub cluster |
| Shadow Mode / Office Override | claude-4.6-opus | claude-4.6-opus | 2026-05-13 | Vertex Core rule — privacy/consent paths |
| Governance / docs-only edits | composer-2 | — | 2026-05-13 | From outcome log: .cursorrules audit, dossier updates |
| Storage rules / upload paths | claude-4.6-sonnet | — | 2026-05-13 | From outcome log: storage rules security tightening |
| Boot sequence / performance | claude-4.6-sonnet | — | 2026-05-13 | From outcome log: field app schedule fast-boot |
