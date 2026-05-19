# Model Lookup Table (Automation)

> **Purpose:** Compact lookup for the SDK build runner. One row per task pattern. Max 50 rows.
> **Updated by:** `tools/build_runner.ts` after each slice. Manual edits welcome.
> **Rule:** When a cheaper model succeeds on a pattern, update "Cheapest OK." When a model fails, record in "Cheapest Failed" and ratchet up unverified rows. Never lower below "Floor."
> **Verified:** `yes` = a model at this tier actually passed for this pattern. `no` = optimistic guess, never tested at this tier.
> **Cheapest Failed:** The most expensive model that FAILED for this pattern. When **Verified** = yes, SDK skips cheaper tiers (starts at next rung up).
> **Floor:** Hard minimum model for this pattern — Mini/Flash never run when Floor is set (see `getPatternMinimum` + `MODEL_GUARDS`).
> **Stale rule:** Rows older than 30 days get re-tested at cheapest tier on next matching slice.

| Pattern | Cheapest OK | Cheapest Failed | Floor | Verified | Last verified | Notes |
|---------|-------------|-----------------|-------|----------|---------------|-------|
| UI container / HTML+CSS layout | composer-2 | gpt-5.4-mini | — | yes | 2026-05-15 | 41a: mini failed, spark passed; 54c: composer-2 passed |
| CSS-only restyle / theme | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (nano-medium invalid); unverified — test on next match |
| Single-file JS bugfix | composer-2 | — | — | yes | 2026-05-13 | From outcome log: shadow consent race fix |
| Multi-file UI feature (no Firestore writes) | gpt-5.4-mini | — | — | no | 2026-05-18 | SDK: Mini first when file count < 3; guard blocks Mini at 3+ files |
| New JS module (IIFE, no Firestore) | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (mini-medium invalid); re-verify on next match |
| Speech API / media capture integration | claude-sonnet-4-6 | — | claude-sonnet-4-6 | yes | 2026-05-15 | Floor: Sonnet minimum (41b, 44a) |
| Cross-module wiring (3+ files) | gpt-5.4-mini | — | composer-2.5 | no | 2026-05-18 | Floor: no Mini/Flash on 3+ file wiring |
| Pure regex / dictionary logic | gpt-5.3-codex-spark | — | — | yes | 2026-05-15 | 43a: spark passed first try |
| Gemini prompt integration | gpt-5.4-mini | — | claude-opus-4-6 | no | 2026-05-18 | Floor: Vertex Core — Opus minimum |
| Firestore multi-read (query, no writes) | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (mini-medium invalid); re-verify on next match |
| Firestore write path (new collection/doc) | composer-2.5 | gpt-5.4-mini | composer-2.5 | no | 2026-05-18 | Floor: skip Mini/Flash; C2.5 first, escalate to Sonnet/Opus |
| Firestore rules / auth changes | claude-opus-4-6 | — | claude-opus-4-6 | yes | 2026-05-15 | 59b: opus passed; floor = Vertex Core |
| Firebase config / project migration | claude-opus-4-6 | — | claude-opus-4-6 | no | 2026-05-13 | Vertex Core rule — no matching slice yet |
| Dispatcher modal (read-only Firestore) | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (mini-medium invalid); unverified |
| Hamburger menu / nav chrome | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (nano-medium invalid); unverified |
| Dictation hub labels / hints / copy | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (nano-medium invalid); unverified |
| Shadow Mode / Office Override | claude-opus-4-6 | — | claude-opus-4-6 | no | 2026-05-13 | Vertex Core rule — no matching slice yet |
| Governance / docs-only edits | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (nano-medium invalid); unverified |
| Storage rules / upload paths | claude-sonnet-4-6 | — | claude-sonnet-4-6 | yes | 2026-05-16 | Floor: Sonnet minimum |
| Boot sequence / performance | claude-sonnet-4-6 | — | — | no | 2026-05-13 | Unverified — will test on next matching slice |
