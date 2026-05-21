import { Divider, H1, H2, Stack, Table, Text } from "cursor/canvas";

export default function ModelScorecardCanvas() {
  return (
    <Stack gap={16}>
      <H1>Model Scorecard</H1>
      <Text tone="secondary" size="small">
        Running log of recent task shapes, tiers, and confidence scores.
      </Text>

      <Divider />

      <H2>Latest Logged Tasks</H2>
      <Table
        headers={[
          "Date",
          "Task",
          "Class",
          "Arch",
          "Tier",
          "Conf Start",
          "Conf After",
          "Tier Fit",
          "Outcome",
          "Note",
        ]}
        rows={[
          [
            "2026-05-21",
            "Rename fix tracker to Bug Report Tracker; update refs in rules/docs/runner",
            "LOW",
            "T1",
            "Gemini 3 Flash",
            "92%",
            "95%",
            "ok",
            "ok",
            "Cursor: Gemini 3 Flash. Renamed canvas + updated 4 files.",
          ],
          [
            "2026-05-21",
            "4-issue field bugfix: PWA splash, header bleed, chat overflow, addendum scroll",
            "LOW-MED",
            "T3",
            "Opus 4.6",
            "88%",
            "94%",
            "ok",
            "ok",
            "Cursor: Opus 4.6. Multi-file; CSS + DOM restructure + PWA manifest.",
          ],
          [
            "2026-05-21",
            "Frontier delegation rule: offload cheap background subtasks in frontier chats",
            "LOW",
            "T1",
            "GPT-5.4 Mini",
            "92%",
            "95%",
            "ok",
            "ok",
            "Cursor: GPT-5.4 Mini. Frontier chats now offload cheap background work.",
          ],
          [
            "2026-05-21",
            "Compile modal X → Schedule double-prompt: nav guard bypass after \"Not yet\"",
            "LOW",
            "T2",
            "Opus 4.6",
            "90%",
            "95%",
            "could_use_smaller",
            "ok",
            "Cursor: Opus 4.6 (user override). Sonnet would suffice for traced single-line fix.",
          ],
          [
            "2026-05-21",
            "Trust hardening sprint: 15 items, 13 files — alerts to toasts, crash guards, splash, logos",
            "LOW-MED",
            "T3",
            "Opus 4.6",
            "88%",
            "94%",
            "ok",
            "ok",
            "Cursor: Opus 4.6. Parallel subagents (3); field + dispatcher + branding.",
          ],
          [
            "2026-05-20",
            "KI-004: contextHook outbox callbacks + B6 SW cache — 8 files, 7 call sites, deploy",
            "LOW-MED",
            "T2",
            "Sonnet 4.6",
            "90%",
            "95%",
            "ok",
            "ok",
            "Cursor: Sonnet 4.6. Multi-file feature; hook registry + IDB schema + Firestore patches across 5 modules.",
          ],
          [
            "2026-05-20",
            "Issues-found #22: compile modal schedule btn removed; header/nav-guard z-index cascade fix",
            "LOW",
            "T2",
            "Sonnet 4.6",
            "90%",
            "94%",
            "ok",
            "ok",
            "Cursor: Sonnet 4.6. Field app UI; header→z:10000, nav guard→z:100001, bypass guard when modal visible.",
          ],
          [
            "2026-05-20",
            "Kit System analysis + MVP readiness audit + overnight build plan",
            "LOW",
            "T4",
            "Opus 4.6",
            "95%",
            "97%",
            "could_use_smaller",
            "ok",
            "Cursor: Opus 4.6. Read-only analysis; Gemini Flash sufficient.",
          ],
          [
            "2026-05-20",
            "Customer Appointment Confirmation: form, save/load, dispatcher+tech badges",
            "LOW-MED",
            "T2",
            "Opus 4.6",
            "92%",
            "96%",
            "ok",
            "ok",
            "Cursor: Opus 4.6. 3-file feature; form+Firestore+card rendering.",
          ],
          [
            "2026-05-20",
            "SDK post-run verification: 65b+65d real diffs confirmed; canvas+state updated",
            "LOW",
            "T4",
            "Sonnet 4.6",
            "96%",
            "97%",
            "ok",
            "ok",
            "Cursor: Sonnet 4.6. Build runner / SDK archetype; ghost-pass detector worked on 65b.",
          ],
        ]}
        striped
      />

      <Divider />

      <Text tone="secondary" size="small">
        Source: `PROJECT_STATUS/MODEL_DOSSIER.md` · latest 10 rows, newest first.
      </Text>
    </Stack>
  );
}
