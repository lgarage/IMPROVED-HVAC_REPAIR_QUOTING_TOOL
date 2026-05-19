# Model Lookup Table (Automation)

> **Purpose:** Compact lookup for the SDK build runner. One row per task pattern. Max 50 rows.
> **Updated by:** `tools/build_runner.ts` after each slice. Manual edits welcome.
> **Rule:** When a cheaper model succeeds on a pattern, update "Cheapest OK." When a model fails, record in "Cheapest Failed" and ratchet up unverified rows. Never lower below "Floor."
> **Verified:** `yes` = a model at this tier actually passed for this pattern. `no` = optimistic guess, never tested at this tier.
> **Cheapest Failed:** The most expensive model that FAILED for this pattern. Sets a hard floor — never try at or below this rank unless re-probing.
> **Stale rule:** Rows older than 30 days get re-tested at cheapest tier on next matching slice.

| Pattern | Cheapest OK | Cheapest Failed | Floor | Verified | Last verified | Notes |
|---------|-------------|-----------------|-------|----------|---------------|-------|
| UI container / HTML+CSS layout | composer-2.5 | gpt-5.4-mini | — | no | 2026-05-18 | SDK: C2.5 first rung; was composer-2 |
| CSS-only restyle / theme | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (nano-medium invalid); unverified — test on next match |
| Single-file JS bugfix | composer-2.5 | — | — | no | 2026-05-18 | SDK: C2.5 first; was composer-2 |
| Multi-file UI feature (no Firestore writes) | composer-2.5 | claude-opus-4-6 | — | no | 2026-05-18 | SDK: try C2.5 before Sonnet |
| New JS module (IIFE, no Firestore) | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (mini-medium invalid); re-verify on next match |
| Speech API / media capture integration | claude-sonnet-4-6 | — | — | yes | 2026-05-15 | 41b, 44a: sonnet passed; no cheaper tried |
| Cross-module wiring (3+ files) | composer-2.5 | — | — | no | 2026-05-18 | SDK: try C2.5 before Sonnet |
| Pure regex / dictionary logic | gpt-5.3-codex-spark | — | — | yes | 2026-05-15 | 43a: spark passed first try |
| Gemini prompt integration | composer-2.5 | — | composer-2.5 | no | 2026-05-18 | SDK: C2.5 first; escalate to Opus on fail |
| Firestore multi-read (query, no writes) | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (mini-medium invalid); re-verify on next match |
| Firestore write path (new collection/doc) | composer-2.5 | — | composer-2.5 | no | 2026-05-18 | SDK: C2.5 → Sonnet → Opus; cleared opus-as-failed floor |
| Firestore rules / auth changes | claude-opus-4-6 | — | claude-opus-4-6 | yes | 2026-05-15 | 59b: opus passed; floor = Vertex Core |
| Firebase config / project migration | claude-opus-4-6 | — | claude-opus-4-6 | no | 2026-05-13 | Vertex Core rule — no matching slice yet |
| Dispatcher modal (read-only Firestore) | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (mini-medium invalid); unverified |
| Hamburger menu / nav chrome | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (nano-medium invalid); unverified |
| Dictation hub labels / hints / copy | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (nano-medium invalid); unverified |
| Shadow Mode / Office Override | claude-opus-4-6 | — | claude-opus-4-6 | no | 2026-05-13 | Vertex Core rule — no matching slice yet |
| Governance / docs-only edits | gpt-5.4-mini | — | — | no | 2026-05-17 | Slug fixed (nano-medium invalid); unverified |
| Storage rules / upload paths | claude-sonnet-4-6 | — | — | yes | 2026-05-16 | Verified: claude-sonnet-4-6 passed |
| Boot sequence / performance | claude-sonnet-4-6 | — | — | no | 2026-05-13 | Unverified — will test on next matching slice |
