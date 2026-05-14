# Model Lookup Table (Automation)

> **Purpose:** Compact lookup for the SDK build runner. One row per task pattern. Max 50 rows.
> **Updated by:** `tools/build_runner.ts` after each slice. Manual edits welcome.
> **Rule:** When a cheaper model succeeds on a pattern, update "Cheapest OK." When a model fails, bump it up. Never lower below "Floor."
> **Stale rule:** Rows older than 30 days get re-tested at cheapest tier on next matching slice.

| Pattern | Cheapest OK | Floor | Last verified | Notes |
|---------|-------------|-------|---------------|-------|
| UI container / HTML+CSS layout | claude-4.5-haiku-thinking | — | 2026-05-13 | Unverified — will auto-escalate if Haiku fails |
| CSS-only restyle / theme | claude-4.5-haiku-thinking | — | 2026-05-13 | Unverified — will auto-escalate if Haiku fails |
| Single-file JS bugfix | composer-2 | — | 2026-05-13 | From outcome log: shadow consent race fix |
| Multi-file UI feature (no Firestore writes) | claude-4.6-sonnet | — | 2026-05-13 | From outcome log: equipment hub card thumbs |
| New JS module (IIFE, no Firestore) | gpt-5.4-mini-medium | — | 2026-05-13 | Unverified — will auto-escalate to Sonnet if Mini fails |
| Speech API / media capture integration | claude-4.6-sonnet | — | 2026-05-13 | Estimated — mobile APIs need decent reasoning |
| Cross-module wiring (3+ files) | claude-4.6-sonnet | — | 2026-05-13 | From outcome log: per-user feature toggles |
| Pure regex / dictionary logic | gpt-5.3-codex-spark-preview | — | 2026-05-13 | Unverified — will auto-escalate to Codex 5.3 if Spark fails |
| Gemini prompt integration | claude-4.6-opus | claude-4.6-opus | 2026-05-13 | From outcome log: unit work parser |
| Firestore multi-read (query, no writes) | gpt-5.4-mini-medium | — | 2026-05-13 | Unverified — will auto-escalate to Sonnet if Mini fails |
| Firestore write path (new collection/doc) | claude-4.6-opus | claude-4.6-opus | 2026-05-13 | Vertex Core rule — never below Strong |
| Firestore rules / auth changes | claude-4.6-opus | claude-4.6-opus | 2026-05-13 | Vertex Core rule |
| Firebase config / project migration | claude-4.6-opus | claude-4.6-opus | 2026-05-13 | Vertex Core rule |
| Dispatcher modal (read-only Firestore) | gpt-5.4-mini-medium | — | 2026-05-13 | Unverified — will auto-escalate |
| Hamburger menu / nav chrome | claude-4.5-haiku-thinking | — | 2026-05-13 | From outcome log: workspace chrome cluster |
| Dictation hub labels / hints / copy | claude-4.5-haiku-thinking | — | 2026-05-13 | From outcome log: dictation hub cluster |
| Shadow Mode / Office Override | claude-4.6-opus | claude-4.6-opus | 2026-05-13 | Vertex Core rule — privacy/consent paths |
| Governance / docs-only edits | claude-4.5-haiku-thinking | — | 2026-05-13 | From outcome log: .cursorrules audit |
| Storage rules / upload paths | claude-4.6-sonnet | — | 2026-05-13 | From outcome log: storage rules tightening |
| Boot sequence / performance | claude-4.6-sonnet | — | 2026-05-13 | From outcome log: field app fast-boot |
