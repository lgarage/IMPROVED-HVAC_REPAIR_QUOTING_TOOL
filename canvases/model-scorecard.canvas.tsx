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
            "KNOWN_ISSUES sync cadences doc update for 65e",
            "LOW",
            "T0",
            "GPT-5.4 Mini",
            "95%",
            "97%",
            "ok",
            "ok",
            "Cursor: GPT-5.4 Mini. Docs-only table; exact values from slices.",
          ],
          [
            "2026-05-19",
            "SDK cleanup: reset 3 ghost passes, aligned model_selector + MODEL_LOOKUP, no-SDK rule",
            "LOW-MED",
            "T2",
            "Opus 4.6",
            "90%",
            "95%",
            "could_use_smaller",
            "ok",
            "Cursor: Opus 4.6 (user-escalated). Governance + tooling — Sonnet sufficient.",
          ],
          [
            "2026-05-19",
            "Field app: issues-found #13 composer overlap — syncComposerClearance()",
            "LOW",
            "T2",
            "Sonnet 4.6",
            "88%",
            "93%",
            "ok",
            "ok",
            "Cursor: Sonnet 4.6. Dynamic dock measurement eliminates device variance.",
          ],
          [
            "2026-05-19",
            "Dossier efficiency overhaul: scorecard rebuilt, gotchas extracted, 10-row cap.",
            "LOW",
            "T2",
            "Sonnet 4.6",
            "88%",
            "95%",
            "ok",
            "ok",
            "Sonnet 4.6. Full restructure; scorecard aggregated from ~180 rows.",
          ],
          [
            "2026-05-19",
            "KI-007 screen glitch: `closeCompileModal` missing from `onWorkspaceClose`.",
            "LOW",
            "T2",
            "Sonnet 4.6",
            "86%",
            "94%",
            "ok",
            "ok",
            "Sonnet 4.6. Modal leaked onto schedule; gen-id cancel guard.",
          ],
          [
            "2026-05-19",
            "compile-notes-first bug: `saveCompileCache` on compile + `submitted` flag.",
            "LOW",
            "T2",
            "Sonnet 4.6",
            "88%",
            "93%",
            "ok",
            "ok",
            "Sonnet 4.6. Cache-on-compile pattern — survives ticket switch.",
          ],
          [
            "2026-05-19",
            "KI-006 past-day job UX: historical tap → compile modal → addendum.",
            "LOW",
            "T2",
            "Sonnet 4.6",
            "88%",
            "94%",
            "ok",
            "ok",
            "Sonnet 4.6. Tracker #5 closed; user device verify open.",
          ],
          [
            "2026-05-19",
            "Governance: issues-found reconciliation — 7 closed, 4 pending.",
            "LOW",
            "T4",
            "Gemini 3 Flash",
            "90%",
            "96%",
            "ok",
            "ok",
            "Gemini 3 Flash. Status audit across Slack/git/build_state; no app code.",
          ],
          [
            "2026-05-19",
            "SDK slice 64d — Vendor directory: Firestore CRUD UI. *(SDK automated)*",
            "HIGH",
            "T2-T3",
            "Composer 2.5",
            "82%",
            "90%",
            "ok",
            "ok",
            "Composer 2.5 (SDK). Ladder: c2.5 → codex → sonnet → kimi.",
          ],
          [
            "2026-05-19",
            "SDK slice 64e — localStorage quote import. *(SDK automated)*",
            "HIGH",
            "T2",
            "Composer 2.5",
            "82%",
            "90%",
            "ok",
            "ok",
            "Composer 2.5 (SDK). Ladder: c2.5 → codex → sonnet → kimi.",
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
