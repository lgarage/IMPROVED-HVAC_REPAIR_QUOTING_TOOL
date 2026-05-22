/**
 * AGENT INSTRUCTIONS
 *
 * LOGGING (every session): When the user reports a bug in chat, add/update a row here
 * immediately (status pending). See .cursor/rules/bug-report-tracker.mdc. Next id ≥ #28.
 * Sync this file AND canvases/bug-report-tracker.canvas.tsx in the repo.
 *
 * FIXING (one at a time): mandatory done checklist before reporting any fix complete:
 *
 * Canvas path: C:\Users\daday\.cursor\projects\c-Projects-PROJECT-DISPATCHER-TOOL\canvases\bug-report-tracker.canvas.tsx
 * Slack source: #issues-found (C0B4AKT9NFL)
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
  {
    id: '28',
    title: 'Dispatcher ticket modal should close after Save',
    status: 'completed',
    file: 'index.html',
    lineRef: 'index.html ~7154 (#vcTicketDetailsSaveBtn onclick closeAfter: false → true)',
    model: 'GPT-5.4 Mini (T0)',
    rootCause:
      'Save button called persistTicketDetailsModal({ closeAfter: false }) — modal stayed open after saving.',
    fix: 'Changed closeAfter: false → closeAfter: true on #vcTicketDetailsSaveBtn onclick.',
    before: 'onclick="persistTicketDetailsModal({ closeAfter: false })"',
    after: 'onclick="persistTicketDetailsModal({ closeAfter: true })"',
    userTestSteps: [
      'Open dispatcher → open any ticket (double-click from board)',
      'Edit a field (e.g. change issue text)',
      'Click Save — expect: changes saved AND modal closes',
    ],
  },
  {
    id: '29',
    title: 'Field app: cannot tap × after moving job to today',
    status: 'completed',
    file: 'technician/index.html',
    lineRef:
      'index.html ~2697 (.ct-compile-modal z-index 9000 → 11000); ~3032 (.ct-teaching-modal same)',
    model: 'Sonnet 4.6 (T2 — z-index stack + historical date sync)',
    rootCause:
      'User rescheduled a job to today (dispatcher), opened it on mobile. Compiled Report modal auto-opens on workspace entry. #ct-compile-modal z-index 9000 sits under body.ws-active .app-top-shell z-index 10000 — × in sheet header is untappable because the fixed header is on top.',
    fix:
      'Raised .ct-compile-modal z-index from 9000 to 11000 (above app-top-shell at 10000). Same fix applied to .ct-teaching-modal. Modal now renders above the header bar so × is always tappable.',
    before:
      '.ct-compile-modal { z-index: 9000; } — blocked by body.ws-active .app-top-shell { z-index: 10000; }',
    after:
      '.ct-compile-modal { z-index: 11000; } — always above header; × is tappable',
    userTestSteps: [
      'Force-reload PWA on iPhone (hold reload → Empty Cache and Hard Reload, or delete app and re-add)',
      'Open any job that has a compiled report',
      'Compiled Report sheet opens automatically',
      'Tap the × button in the sheet header — expect: sheet closes, chat is visible',
      'If on a job rescheduled to today: confirm compile modal still closes cleanly',
    ],
  },
  {
    id: '30',
    title: 'First workspace context bubble: description + dispatch photos',
    status: 'completed',
    file: 'conversational_timeline.js, technician/index.html',
    lineRef:
      'conversational_timeline.js ~481-517 (buildContextText, seedFromTicket) — v85',
    model: 'Sonnet 4.6 (T2)',
    rootCause:
      'buildContextText() only included Job, Customer, Site. ticket.issue (description) was omitted. customerEvidenceUrls (dispatch photos) were only shown in #workspaceCustomerEvidence panel above chat, never in the first context bubble.',
    fix:
      '(1) buildContextText: added Description from ticket.issue. (2) seedFromTicket: when customerEvidenceUrls present, builds an isHtml seed entry with the text block + 72px thumbnail strip. Plain text seed unchanged when no photos.',
    before:
      'First bubble: "Job: SC-XXXX\\nCustomer: ...\\nSite: ..." — no description, no photos',
    after:
      'First bubble includes Description line; if dispatch photos exist, shows 72px thumbnail grid below text',
    userTestSteps: [
      'Force-reload field app (clear cache)',
      'Open a NEW job card that has a description/issue entered in dispatcher',
      'Workspace context bubble should show Description line below Site',
      'On a job that has dispatch photos (customerEvidenceUrls): context bubble shows photo thumbnails below the text',
      'Tap a thumbnail — opens photo in new tab',
    ],
  },
  {
    id: '31',
    title: 'Dispatch board day view: job block text garbled until hover',
    status: 'completed',
    file: 'index.html',
    lineRef:
      'index.html ~823-841 (.gantt-job-block add z-index:1); ~857-868 (.board-view-day block/inner: height 42→46px, row 52→54px, justify-content flex-start, gap 2→1px)',
    model: 'Sonnet 4.6 (T2)',
    rootCause:
      'Two issues: (1) .gantt-job-block had no z-index, so sibling blocks at same time slot shared a stacking context — adjacent block text bled through the semi-transparent border-left. (2) 3-line content at ~37px exceeded the 34px available in a 42px block with 8px padding; justify-content:center caused partial clipping at both ends.',
    fix:
      'Added z-index:1 to .gantt-job-block (creates stacking context). Day view: block height 42→46px, row 52→54px, inner padding 4px→3px, justify-content:center→flex-start, gap 2→1px.',
    before:
      '.gantt-job-block: no z-index; day view height 42px, justify-content:center — 3 lines overflow',
    after:
      'z-index:1 on every block; day view height 46px, flex-start — 3 lines fit cleanly',
    userTestSteps: [
      'Open dispatcher → Dispatch Board tab → Day view',
      'Load a day with 2+ jobs for the same tech',
      'All job blocks should show clean customer name text at rest (no garbling)',
      'Confirm time row, name row, and detail row are all readable',
      'Hover — box-shadow enlarges, text stays clean',
    ],
  },
  {
    id: '32',
    title: 'Service Requests reorder: cards vanish after drag (need data-id + UX)',
    status: 'completed',
    file: 'service_call.js',
    lineRef: 'service_call.js ~1958 glass-card: added data-id="${sc.id}"; v79',
    model: 'GPT-5.4 Mini (T0 data-id fix)',
    rootCause:
      'saveBoardOrder() reads card.getAttribute("data-id") but renderServiceBoard() never set data-id on .glass-card — visualIds were all null, newDb became [], localStorage wiped.',
    fix: 'Added data-id="${sc.id}" to .glass-card in renderServiceBoard(). T2 UX polish (smooth drag preview) deferred.',
    before: 'glass-card: no data-id → all cards vanish after dragend',
    after: 'Each card has data-id; saveBoardOrder reads correct IDs → cards stay after drag',
    userTestSteps: [
      'Open dispatcher → Dispatch Board',
      'Drag a Service Request card to reorder in left panel',
      'Release — all cards should remain visible (no vanish)',
      'Refresh page — order should be persisted',
    ],
  },
  {
    id: '33',
    title: 'Service Requests panel: compact cards to show more jobs',
    status: 'completed',
    file: 'index.html',
    lineRef:
      'index.html ~1117-1139 (.glass-card padding 10→6px, margin 8→4px); ~1573-1592 (.tc-title font 14→13px, .tc-loc margin 8→4px + ellipsis); ~1487-1514 (.tc-tech-strip margin 6→2px, avatars 22→18px)',
    model: 'Sonnet 4.6 (T2)',
    rootCause:
      'Each .glass-card used 10px padding + 8px margin + 14px title + 8px loc margin + 22px tech avatars = ~140px per card, showing only ~5 cards before scroll.',
    fix:
      'CSS-only compact: padding 10→6px, margin-bottom 8→4px, tc-title font 14→13px margin 4→2px, tc-loc margin 8→4px (ellipsis added), tc-tech-strip margin 6→2px, avatars 22→18px. Target ~85px per card = ~10+ visible per viewport.',
    before:
      '~140px per card, ~5 visible',
    after:
      '~85px per card, ~10+ visible',
    userTestSteps: [
      'Open dispatcher → Dispatch Board',
      'Left panel should show more job cards before scrolling',
      'Cards should still show customer name, address, tech avatars, and status dropdown',
      'Drag a card to the Gantt — still works',
      'Double-click a card — ticket details open',
    ],
  },
  {
    id: '34',
    title: 'Service Requests list filtered by board day/week/month',
    status: 'completed',
    file: 'service_call.js, index.html',
    lineRef:
      'service_call.js ~1901-1935 (left panel: added date filter using getGanttDateContextForMap + scope label); index.html ~3090-3104 (added boardScopeLabel span); service_call.js?v=77',
    model: 'Sonnet 4.6 (T2)',
    rootCause:
      'renderServiceBoard() left panel listed ALL non-archived open tickets regardless of date, while Gantt timeline filtered by currentBoardView + boardDateSelector.',
    fix:
      'Added isDateVisible() filter to left panel loop using getGanttDateContextForMap() (same logic as Gantt). Unassigned tickets included (no tech requirement). Added #boardScopeLabel span in header showing "May 21", "Wk of May 18", or "May 2026".',
    before:
      'Sidebar: all open tickets regardless of date',
    after:
      'Sidebar filtered to same day/week/month as board; scope label shows date context',
    userTestSteps: [
      'Open dispatcher → Dispatch Board → Day view (pick a specific date)',
      'Left panel shows only jobs scheduled on that exact date',
      'Header shows "Service Requests [count] · May 21" (or current date)',
      'Switch to Week view — left panel shows all jobs in that week',
      'Switch to Month view — left panel shows all jobs in that month',
      'Unassigned jobs for that date still appear in the list',
    ],
  },
  {
    id: '35',
    title: 'Invoicing: Generate Invoice pulls AI report (retire paste-parse)',
    status: 'completed',
    file: 'service_call.js, index.html',
    lineRef:
      'service_call.js ~3369-3428 (convertToInvoice: techNotes → invNotes + async Firestore completed_reports fetch → invDiag, invWork); service_call.js?v=78',
    model: 'Sonnet 4.6 (T2)',
    rootCause:
      'convertToInvoice() only prefilled customer/site, equip, and basic ticket.issue text. sc.techNotes was not used. Firestore completed_reports (AI compiled report with equipmentFindings: diagnosis, actionsTaken) was never fetched.',
    fix:
      '(1) invNotes now includes sc.techNotes if present. (2) After sync setup, async Firestore query on completed_reports by ticketId — maps findings[].diagnosis → invDiag, findings[].actionsTaken+measurements → invWork. Multiple equipment units are labeled. Shows "✓ AI report loaded" when Firestore doc found.',
    before:
      'Generate Invoice: invNotes = "Original Ticket: SC-XX\\nReported Issue: ..."; invDiag/invWork empty',
    after:
      'Generate Invoice: invNotes includes tech notes; invDiag/invWork auto-filled from AI compiled report via Firestore',
    userTestSteps: [
      'Open a ticket that has been submitted by the field tech (compiled report exists)',
      'Click Generate Invoice button on the ticket',
      'Invoice tab opens with customer/address/date/labor already filled',
      'Within ~2 seconds: Diagnosis and Work Performed fields populate from the AI compiled report',
      'Status bar shows "✓ AI report loaded into invoice"',
      'If no AI report exists yet: fields stay blank (no error)',
    ],
  },
  {
    id: '36',
    title: 'Customer info sync: one update propagates everywhere',
    status: 'pending',
    file: 'customer_directory.js, service_call.js, invoice.js, quoting.js, technician/index.html',
    lineRef:
      'customer_directory.js ~41-85 (syncSingleCustomerToCloud), ~257-304 (syncCustomerToDirectory); service_call.js saveServiceCall; twinPillarsServiceDB + Firestore service_calls denormalized fields',
    model: 'Opus 4.6 (T3 — cross-system denormalization + Firestore fan-out)',
    rootCause:
      'Customer data lives in multiple stores: tp_customers_db / Firestore customers, denormalized copies on each service_calls ticket (customerName, locationAddress, custCity, etc.), invoice/quote forms, field app, schedule cards, maps. Updating name/address in one surface (directory, ticket modal, invoice, admin job sheet) does not fan-out to all tickets and UIs — stale copies until manual refresh or reload.',
    fix:
      'Define canonical customer record (CST id + locations). On any customer edit: (1) update directory + Firestore customers; (2) batch-update all service_calls / local twinPillarsServiceDB rows matching customerNum or name; (3) refresh open UI (service board, invoice if open, field tickets listener). Consider customerNum as stable key vs name. Document write paths in syncCustomerToDirectory / saveServiceCall / persistInvoiceCustomerToCRM.',
    before:
      'Customer edit updates one local store; other screens keep old denormalized ticket fields',
    after:
      'Single customer update refreshes directory, all linked tickets, dispatch board, invoice/quote prefill, and field app views',
    userTestSteps: [],
  },
  {
    id: '37',
    title: 'Future improvement F1: hide Pulse UI (code preserved — icebox)',
    status: 'completed',
    file: 'shared/entitlements.js, index.html',
    lineRef: 'entitlements.js ~55 interOfficeFeed plans all → false; v2',
    model: 'GPT-5.4 Mini (T0)',
    rootCause: 'Pro/enterprise tenants saw Pulse nav via interOfficeFeed entitlement.',
    fix: 'Set interOfficeFeed plans: { free:false, pro:false, enterprise:false } — vcHasFeature always returns false → syncPulseNav() keeps sidebar-nav-pulse hidden.',
    before: 'plans: { free:false, pro:true, enterprise:true }',
    after: 'plans: { free:false, pro:false, enterprise:false } — all off for pilot',
    userTestSteps: [
      'Hard-refresh dispatcher',
      'Check sidebar — Pulse nav item should not appear',
      'Open Settings → Features — Pulse toggle should show as off',
    ],
  },
  {
    id: '38',
    title: 'Future improvement F2: hide Executive Insights UI (code preserved — icebox)',
    status: 'completed',
    file: 'index.html',
    lineRef: 'index.html ~2783 #nav-insights: added style="display:none"',
    model: 'GPT-5.4 Mini (T0)',
    rootCause: 'Reports flyout showed Executive Insights nav link.',
    fix: 'Added style="display:none" to #nav-insights <a> element. Custom Report Studio unchanged.',
    before: '#nav-insights visible in Reports flyout',
    after: '#nav-insights hidden; Reports flyout shows only Custom Report Studio',
    userTestSteps: [
      'Hard-refresh dispatcher',
      'Click Reports in sidebar — flyout should only show Custom Report Studio, not Executive Insights',
    ],
  },
  {
    id: '39',
    title: 'Future improvement F3: hide phone simulator UI (code preserved — icebox)',
    status: 'completed',
    file: 'index.html',
    lineRef: 'index.html ~2802 sidebar <li> style="display:none"; ~3106 Field app btn display:none; ~8026 openTechnicianAppPreview early return',
    model: 'GPT-5.4 Mini (T0)',
    rootCause: 'Sidebar "Preview Field App" and intake "Field app" button both called openTechnicianAppPreview().',
    fix: 'Sidebar <li> display:none, Field app button display:none, openTechnicianAppPreview() early return added.',
    before: 'Dispatcher could open phone simulator from sidebar or intake header',
    after: 'Both entry points hidden; function is a no-op. Code preserved for re-enable.',
    userTestSteps: [
      'Hard-refresh dispatcher',
      'Check sidebar — "Preview Field App" should not appear',
      'Open Service Intake — "Field app" button in the header strip should not appear',
    ],
  },
  {
    id: '40',
    title: 'Chrome "Save address?" popup on dispatcher site/address forms',
    status: 'completed',
    file: 'index.html',
    lineRef:
      'Service Intake scContact* / scCust* / scParentBill*; Quoting cust* / contactNameInput; Customer Directory dirNew* (~3588–3660, ~4446–4513, ~7496–7549)',
    model: 'GPT-5.4 Mini (T0 — autocomplete off)',
    rootCause:
      'Chrome detects name + street + city + state + zip + email clusters and offers to save to Google Account. Invoice form already had autocomplete="off"; Service Intake, Quoting, and Customer Directory add-location fields did not.',
    fix:
      'Added autocomplete="off" on all site/contact/address inputs in those three surfaces (invoice unchanged).',
    before: 'Filling Zip / address on Service Intake or Customer Directory triggers Chrome Save address? dialog',
    after: 'Chrome should not prompt; if it still does once, tap No thanks — or Chrome Settings → Autofill → Addresses',
    userTestSteps: [
      'Hard-refresh dispatcher (Ctrl+Shift+R)',
      'Open Service Intake or Customer Directory → Add Customer',
      'Fill contact name, street, city, state, zip, email — tab out of Zip',
      'Expect: no Chrome Save address? popup',
    ],
  },
  {
    id: '41',
    title: 'Dispatcher ticket modal: crew changes should auto-set status',
    status: 'pending',
    file: 'service_call.js, dispatcher/js/ticket_manager.js',
    lineRef:
      'service_call.js ~1632-1638 (ticket modal tech multi-select callback), ~1694-1709 (persistTicketDetailsModal status sync); dispatcher/js/ticket_manager.js ~335-374 (multi-select change handler)',
    model: 'GPT-5.4 Mini (T1 autosave)',
    rootCause:
      'The assigned-tech checkbox dropdown updated crew selection, but the ticket modal only saved status when the user clicked Save. That left the sidebar card status stale until a manual save and made the assigned state lag behind the selection.',
    fix:
      'Wire the multi-select change handler to auto-persist the ticket modal on every checkbox toggle. Keep the existing state machine: Unassigned → Dispatched when crew is added, Dispatched → Unassigned when crew is cleared, and never downgrade Dispatched/In Progress/Completed.',
    before:
      'Checking or unchecking a tech only updated the dropdown summary; ticket status and sidebar badge stayed stale until manual save.',
    after:
      'Crew changes immediately save to localStorage + Firestore and rerender the board so the sidebar badge reflects the current status right away.',
    userTestSteps: [],
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
