/**
 * AGENT INSTRUCTIONS — mandatory done checklist before reporting any fix complete:
 *
 * Canvas path: C:\Users\daday\.cursor\projects\c-Projects-PROJECT-DISPATCHER-TOOL\canvases\bug-report-tracker.canvas.tsx
 * Slack source: #issues-found (C0B4AKT9NFL)
 * Session ship: commit 3b6b26a (2026-05-21) — bugs #24–#27 below
 *
 * Work ONE item at a time (lowest # still pending). After each fix:
 * [ ] 1. Set status 'in_progress' when starting
 * [ ] 2. Code fix + deploy if field app
 * [ ] 3. Set status 'completed' in THIS file + userTestSteps (numbered device test)
 * [ ] 4. git commit + push
 * [ ] 5. firebase deploy --only hosting (field app)
 * [ ] 6. Report done · WAIT for user proceed before next item
 */
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Stack,
  Stat,
  Table,
  Text,
  useHostTheme,
} from 'cursor/canvas';

type BugStatus = 'pending' | 'in_progress' | 'completed';

type Bug = {
  id: string;
  title: string;
  status: BugStatus;
  file: string;
  lineRef: string;
  model: string;
  rootCause: string;
  fix: string;
  before: string;
  after: string;
  userTestSteps: string[];
  commit?: string;
};

const SESSION_BUGS: Bug[] = [
  {
    id: '24',
    title: 'PWA Splash Screen Blocking Login',
    status: 'completed',
    file: 'technician/index.html',
    lineRef: '~9043 (showLoginShell function)',
    model: 'GPT-5.4 Mini (T0 exact fix once diagnosed)',
    rootCause:
      'When no saved tech in localStorage (fresh PWA, new device), the splash screen (z-index: 999999) was never removed because finishFirst() inside subscribeToMyTickets() only runs after login — but the splash blocked the login form. Chicken-and-egg.',
    fix:
      'Added splash removal (opacity fade + remove) at the start of showLoginShell(). Also created technician/manifest.json with proper start_url and added link rel="manifest", apple-touch-icon, and apple-mobile-web-app-capable meta tags.',
    before:
      'Splash screen (z-index 999999) persists on fresh PWA until post-login finishFirst() — login form unreachable.',
    after:
      'showLoginShell() fades and removes splash immediately. manifest.json + PWA meta tags added for proper install behavior.',
    userTestSteps: [
      'Delete the Vertex Core app from iPhone homescreen',
      'In Safari, navigate to vertex-core-db.web.app/technician/index.html',
      'Tap Share → Add to Home Screen → Add',
      'Open the new homescreen icon — should show login form (not stuck spinner)',
      'Select DAN DAY and tap Continue — should load schedule',
    ],
    commit: '3b6b26a',
  },
  {
    id: '25',
    title: 'Yellow/Content Bleed-Through Behind Header',
    status: 'completed',
    file: 'technician/index.html',
    lineRef: '~77-96 (CSS: body.ws-active .app-top-shell and .workspace-site-banner-sticky)',
    model: 'GPT-5.4 Mini (T0 CSS value change)',
    rootCause:
      'In workspace mode, header had background: transparent and site banner had no background. Conversation content scrolled behind both, creating visible text/color artifacts.',
    fix:
      'Changed header to rgba(15, 23, 42, 0.96) with backdrop-filter: blur(16px). Added matching blurred background to .workspace-site-banner-sticky.',
    before:
      'body.ws-active .app-top-shell { background: transparent; }\n.workspace-site-banner-sticky { no background }',
    after:
      'Header: rgba(15, 23, 42, 0.96) + backdrop-filter: blur(16px).\nSite banner: matching blurred dark background.',
    userTestSteps: [
      'Force-reload PWA',
      'Open a historical job with conversation messages',
      'Scroll the chat up — messages should NOT bleed through behind the DAN/Schedule buttons or the PLANET FITNESS banner',
      'Header and banner should appear solid dark with slight blur',
    ],
    commit: '3b6b26a',
  },
  {
    id: '26',
    title: 'Chat Items Going Behind Composer Text Box',
    status: 'completed',
    file: 'technician/index.html',
    lineRef: '~7238-7260 (addendum DOM move) + ~1268 (CSS padding)',
    model: 'Sonnet 4.6 (T2 DOM restructure)',
    rootCause:
      'The #workspaceAddendumSection and #workspaceAddendumTimeline were positioned outside #workspaceLockScope (outside the scroll container). The fixed-position composer dock at the bottom overlapped these elements. Since the screen had overflow: hidden and fixed height, the addendum content at the bottom was obscured.',
    fix:
      'Moved both addendum elements inside #ct-message-list (after #ct-post-chat-actions) so they scroll with the conversation and benefit from the composer clearance padding-bottom. Added padding-bottom: var(--vc-chat-scroll-clearance, 104px) to .workspace-addendum-timeline-wrap.',
    before:
      '#workspaceAddendumSection and #workspaceAddendumTimeline outside #workspaceLockScope — fixed composer overlaps bottom content.',
    after:
      'Addendum section + timeline inside #ct-message-list after #ct-post-chat-actions. Timeline wrap uses --vc-chat-scroll-clearance padding.',
    userTestSteps: [
      'Force-reload PWA',
      'Open a historical job that has supplemental history entries',
      'Scroll to the bottom of the chat — all supplemental history entries should be fully visible above the "Message Vertex..." text input',
      'No text should be cut off or hidden behind the composer',
    ],
    commit: '3b6b26a',
  },
  {
    id: '27',
    title: 'Schedule Button Not Working in Chat Mode',
    status: 'completed',
    file: 'technician/index.html',
    lineRef: '~8720 (switchScreen function)',
    model: 'N/A (no fix needed)',
    rootCause:
      'Schedule button switchScreen("schedule") was verified working. On historical jobs without unsubmitted reports, it navigates directly. When hasUnsubmittedReport() returns true (after adding addendum notes + recompile), the nav guard sheet shows — user may have interpreted this as "not working."',
    fix:
      'No code change needed for the button itself. The header background fixes (#25) and DOM restructure (#26) may have also improved click targeting. Verified working via Playwright.',
    before:
      'User reported Schedule pill unresponsive in chat mode — likely nav guard UX confusion when hasUnsubmittedReport() is true.',
    after:
      'switchScreen("schedule") confirmed working. Nav guard appears when unsubmitted report exists (expected). Header fixes may improve click targeting.',
    userTestSteps: [
      'Force-reload PWA',
      'Open any job card to enter workspace/chat',
      'Tap the Schedule button in the top header bar',
      'If nav guard appears ("Unsent field report"), tap "Leave Without Sending" — should return to schedule',
      'If no nav guard, should navigate directly to schedule',
    ],
    commit: '3b6b26a',
  },
];

export default function BugReportTracker() {
  const theme = useHostTheme();
  const completed = SESSION_BUGS.filter((i) => i.status === 'completed').length;
  const pending = SESSION_BUGS.filter((i) => i.status === 'pending').length;
  const inProgress = SESSION_BUGS.filter((i) => i.status === 'in_progress').length;

  return (
    <Stack gap={24}>
      <Stack gap={4}>
        <H1>Bug Report Tracker</H1>
        <Text tone="secondary" size="small">
          Session ship commit 3b6b26a · 2026-05-21 · One bug at a time — say switched to [model]
          for #N — proceed
        </Text>
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value={String(completed)} label="Completed" tone="success" />
        <Stat value={String(pending)} label="Pending" tone={pending > 0 ? 'warning' : undefined} />
        <Stat value={String(inProgress)} label="In progress" tone={inProgress > 0 ? 'info' : undefined} />
        <Stat value={String(SESSION_BUGS.length)} label="Session total" />
      </Grid>

      <Divider />

      <H2>Bug reports overview</H2>
      <Table
        headers={['#', 'Bug', 'Status', 'File', 'Root cause', 'Fix']}
        rows={SESSION_BUGS.map((bug) => [
          bug.id,
          bug.title,
          bug.status,
          bug.file,
          bug.rootCause.length > 90 ? bug.rootCause.slice(0, 87) + '...' : bug.rootCause,
          bug.fix.length > 90 ? bug.fix.slice(0, 87) + '...' : bug.fix,
        ])}
        rowTone={SESSION_BUGS.map((bug) =>
          bug.status === 'completed' ? 'success' : undefined
        )}
        striped
      />

      <Divider />

      <H2>Bug handoff details</H2>

      {SESSION_BUGS.map((bug) => (
        <Card key={bug.id}>
          <CardHeader
            trailing={
              <Text size="small" tone="success" weight="semibold">
                {bug.status}
              </Text>
            }
          >
            #{bug.id} — {bug.title}
          </CardHeader>
          <CardBody>
            <Stack gap={12}>
              <Table
                headers={['Field', 'Value']}
                rows={[
                  ['Status', bug.status],
                  ['File', bug.file],
                  ['Line / function', bug.lineRef],
                  ['Recommended model', bug.model],
                  ['Commit', bug.commit ?? '—'],
                ]}
                rowTone={[undefined, undefined, undefined, undefined, 'success']}
              />

              <Stack gap={4}>
                <Text weight="semibold" size="small">
                  Root cause
                </Text>
                <Text size="small">{bug.rootCause}</Text>
              </Stack>

              <Stack gap={4}>
                <Text weight="semibold" size="small">
                  Fix
                </Text>
                <Text size="small">{bug.fix}</Text>
              </Stack>

              <Stack gap={4}>
                <H3>Before</H3>
                <Text
                  size="small"
                  style={{
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    color: theme.text.secondary,
                  }}
                >
                  {bug.before}
                </Text>
              </Stack>

              <Stack gap={4}>
                <H3>After</H3>
                <Text
                  size="small"
                  style={{
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    color: theme.text.secondary,
                  }}
                >
                  {bug.after}
                </Text>
              </Stack>

              <Stack gap={4}>
                <Text weight="semibold" size="small">
                  How to test (on your device)
                </Text>
                {bug.userTestSteps.map((step, idx) => (
                  <Text key={idx} size="small">
                    {idx + 1}. {step}
                  </Text>
                ))}
              </Stack>
            </Stack>
          </CardBody>
        </Card>
      ))}

      <Divider />

      <Text tone="tertiary" size="small">
        Prior bugs #1–#23 tracked in git history (pre-3b6b26a canvas). New work continues
        from #28 onward.
      </Text>
    </Stack>
  );
}
