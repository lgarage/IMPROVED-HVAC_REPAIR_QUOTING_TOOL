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
    status: 'pending',
    file: 'index.html, service_call.js',
    lineRef: 'index.html ~7131 (#vcTicketDetailsSaveBtn onclick); service_call.js ~1664 (persistTicketDetailsModal)',
    model: 'GPT-5.4 Mini (T0 — change closeAfter to true on Save onclick)',
    rootCause:
      'Slice 57a added an explicit Save button that calls persistTicketDetailsModal({ closeAfter: false }) so dispatchers could save without closing. User expects Save to persist and close the modal (same as Close after save).',
    fix:
      'Change Save button onclick from persistTicketDetailsModal({ closeAfter: false }) to persistTicketDetailsModal({ closeAfter: true }). Optional: keep showSaveCue before close if brief flash is desired.',
    before:
      'onclick="persistTicketDetailsModal({ closeAfter: false })" on #vcTicketDetailsSaveBtn',
    after:
      'onclick="persistTicketDetailsModal({ closeAfter: true })" on #vcTicketDetailsSaveBtn',
    userTestSteps: [],
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
    status: 'pending',
    file: 'conversational_timeline.js, technician/index.html',
    lineRef:
      'conversational_timeline.js ~481-517 (buildContextText, seedFromTicket); ~678-717 (system bubble render); technician/index.html ~10394-10418 (renderWorkspaceCustomerEvidence — customerEvidenceUrls)',
    model: 'Sonnet 4.6 (T2 — seed text + inline thumbs or media entries)',
    rootCause:
      'On first workspace load, seedFromTicket() posts one system bubble with only Job, Customer, Site. Missing: (1) ticket.issue description; (2) dispatcher-supplied photos in ticket.customerEvidenceUrls (schedule shows "📷 N Photos Attached" but timeline seed ignores them). Photos today render only in #workspaceCustomerEvidence above the chat, not in the first context card.',
    fix:
      '(1) buildContextText: add Description/Issue from ticket.issue. (2) seedFromTicket: if customerEvidenceUrls.length, attach images in the first context block — prefer meta.isHtml system entry with thumb grid (reuse customer-evidence-thumb styles) OR append system media entries per URL (meta.storageUrl, mediaType photo, uploadStatus complete, seed ticket-context-photo). (3) Consider evidencePhotoUrls if dispatch pre-attached field evidence. Update hasContextSeed or migrate seed when description/photos missing on revisit.',
    before:
      'First bubble: Job + Customer + Site text only; customerEvidenceUrls rendered separately in #workspaceCustomerEvidence',
    after:
      'First context card shows Job, Customer, Site, Description, and thumbnail grid for supplied photos (tap → lightbox)',
    userTestSteps: [],
  },
  {
    id: '31',
    title: 'Dispatch board day view: job block text garbled until hover',
    status: 'pending',
    file: 'index.html, service_call.js',
    lineRef:
      'index.html ~823-897 (.gantt-job-block, .board-view-day rules, :hover z-index 5); service_call.js ~2077-2107 (day view block innerHTML)',
    model: 'Sonnet 4.6 (T2 — CSS stacking / overlap in gantt day view)',
    rootCause:
      'Day-view timeline blocks (.gantt-job-block) show overlapping illegible text (customer names stacked) at rest. On :hover, box-shadow + z-index: 5 "cleans up" readable layout. Likely multiple blocks same slot, flex/overflow in fixed 42px height, or ghost offset from default styles — needs repro on PLANET FITNESS 8–10 AM block.',
    fix:
      'Repro in board-view-day: inspect DOM for duplicate .gantt-job-block at same left/width. Ensure default state uses same truncation/stacking as hover (z-index per block, line-height, overflow hidden on .gantt-job-block-inner). Remove double-render or offset ghost if present. Verify single job SC-1003 shows one clean name without hover.',
    before:
      'Resting .gantt-job-block: garbled overlapping white text on blue bar; :hover only raises z-index: 5 and box-shadow',
    after:
      'Customer name, time row, and contact line readable without hover; hover may still elevate for emphasis only',
    userTestSteps: [],
  },
  {
    id: '32',
    title: 'Service Requests reorder: cards vanish after drag (need data-id + UX)',
    status: 'pending',
    file: 'service_call.js, index.html',
    lineRef:
      'service_call.js ~907-914 (saveBoardOrder), ~1927-1945 (glass-card HTML); ~882-894 (initDragAndDrop)',
    model: 'GPT-5.4 Mini (T0 add data-id) + Sonnet 4.6 (T2 reorder UX polish)',
    rootCause:
      'saveBoardOrder() reads card.getAttribute("data-id") but renderServiceBoard() never sets data-id on .glass-card — visualIds are all null, newDb becomes [], localStorage twinPillarsServiceDB wiped, renderServiceBoard() shows empty list. User must reload to restore from Firestore/cloud resync.',
    fix:
      '(1) Add data-id="${sc.id}" on each .glass-card in renderServiceBoard. (2) saveBoardOrder: append any db tickets missing from visualIds (do not drop). (3) UX: improve initDragAndDrop — placeholder gap, live reorder preview, optional ↑↓ buttons; separate ondragstart for sidebar reorder vs board drag (today both use drag()).',
    before:
      'glass-card: no data-id; saveBoardOrder → newDb=[] → all cards disappear after dragend',
    after:
      'Reorder persists order in localStorage; cards stay visible; siblings shift smoothly during drag',
    userTestSteps: [],
  },
  {
    id: '33',
    title: 'Service Requests panel: compact cards to show more jobs',
    status: 'pending',
    file: 'index.html, service_call.js',
    lineRef:
      'index.html ~623-649 (.dispatch-left-panel, .panel-content), ~1115-1138 (.glass-card); service_call.js ~1927-1945 (card HTML)',
    model: 'Sonnet 4.6 (T2 — compact card CSS + optional dense layout toggle)',
    rootCause:
      'Left sidebar shows ~5 jobs at a time because each .glass-card is tall (padding 10–12px, full address line, tech avatars, full-width status select, margin-bottom 8px). Panel is fixed 380px wide but vertical density is the bottleneck as job volume grows.',
    fix:
      'Add compact/dense card variant: smaller padding, single-line title+SC#, truncated address, inline status chip or smaller select, optional hide tech strip when unassigned. Consider resizable left panel height share or full-height column. Target 10–15 visible cards on typical laptop without losing tap targets (min 44px rows).',
    before:
      'Large glass-card blocks; user sees ~5 jobs before scroll',
    after:
      'Dense list shows many more jobs per viewport; still readable and draggable',
    userTestSteps: [],
  },
  {
    id: '34',
    title: 'Service Requests list filtered by board day/week/month',
    status: 'pending',
    file: 'service_call.js, index.html',
    lineRef:
      'service_call.js ~1905-1947 (left panel render — no date filter), ~614-645 (getGanttDateContextForMap / gantt date logic); index.html ~3141+ (board Day/Week/Month + boardDateSelector)',
    model: 'Sonnet 4.6 (T2 — share date scope with dispatch board)',
    rootCause:
      'Dispatch board Gantt filters jobs by currentBoardView + boardDateSelector (day/week/month), but Service Requests left panel lists ALL non-archived open tickets regardless of date. No way to browse "this week\'s jobs" in the sidebar without matching the timeline scope.',
    fix:
      'Filter serviceRequestList with same date window as Gantt (reuse getGanttDateContextForMap; include Unassigned tickets for that date). Sync list when user changes Day/Week/Month or date picker. Show scope label in panel header (e.g. "4 jobs · Week of May 18"). Optional: independent list filter if board view differs.',
    before:
      'Sidebar: all open tickets; board: day/week/month filtered only on timeline',
    after:
      'Sidebar list matches selected day/week/month (and date); count badge reflects filtered set',
    userTestSteps: [],
  },
  {
    id: '35',
    title: 'Invoicing: Generate Invoice pulls AI report (retire paste-parse)',
    status: 'pending',
    file: 'service_call.js, invoice.js, index.html',
    lineRef:
      'service_call.js ~3311-3391 (convertToInvoice); invoice.js ~102-120 (parsePastedNotes), ~10-56 (clearInvoiceForm); index.html ~5015-5034 (#invPasteArea section); dispatcher/js/ai_report_reviewer.js',
    model: 'Sonnet 4.6 (T2) or Opus 4.6 if Firestore compile schema',
    rootCause:
      'Today: Invoice Generator section 1 requires paste + parsePastedNotes() (+ Gemini on blur). convertToInvoice() only prefills customer/site, equip stub, ticket.issue in invNotes — not full AI compile / customer-facing report. User wants one-click Generate Invoice from ticket modal to populate all invoice fields from built AI agent output (techNotes, compiled report, structured reviewer JSON).',
    fix:
      '(1) Extend convertToInvoice(ticketId) to load ticket.techNotes + Firestore compile/submitted report (NotesParser / timeline cache / ai_report_reviewer schema by job type) into invNotes, invDiag, invWork, parts, labor. (2) Deprecate or hide invPasteArea + parsePastedNotes for primary workflow; keep optional advanced paste if needed. (3) Map customer-facing vs internal fields per shared/client_portal_logic. Show loading state on Generate Invoice while fetching.',
    before:
      'Paste tech notes → parse/Gemini → manual verify; Generate Invoice copies basic ticket fields only',
    after:
      'Generate Invoice on ticket (or invoice tab) auto-fills client, call, equipment, diagnosis, work, parts, labor, customer-facing report from AI agent — no paste step',
    userTestSteps: [],
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
    status: 'pending',
    file: 'index.html, shared/entitlements.js, dispatcher/js/activity_feed.js',
    lineRef:
      '#sidebar-nav-pulse ~2739; switchTab pulse ~8169; vcHasFeature("interOfficeFeed") ~8507; FEATURE_CATALOG interOfficeFeed ~49',
    model: 'GPT-5.4 Mini (T0 — hide nav + hard-off gate)',
    rootCause:
      'Pulse shipped behind interOfficeFeed entitlement but product decision 2026-05-21 is to retire the live feed to icebox — nav and listeners should not run even if tenant has pro/enterprise plan.',
    fix:
      '(1) Force-hide #sidebar-nav-pulse and block switchTab("pulse") regardless of entitlement (or set interOfficeFeed default/plans all false + migration note). (2) Ensure PulseActivityFeed.stop() on load; never start listeners. (3) Optional: remove Pulse from Settings feature catalog UI or mark deprecated. Inter-office internal_comms on tickets unchanged.',
    before: 'Pro/enterprise tenants see Pulse nav; switchTab starts PulseActivityFeed Firestore listeners',
    after: 'No Pulse nav or view; no background feed listeners; feature documented in ROADMAP icebox / IDEA_TRACKER parked',
    userTestSteps: [],
  },
  {
    id: '38',
    title: 'Future improvement F2: hide Executive Insights UI (code preserved — icebox)',
    status: 'pending',
    file: 'index.html, shared/entitlements.js, dispatcher/js/insights_manager.js',
    lineRef:
      '#nav-insights ~2776 (Reports flyout); #view-insights ~4218; switchTab insights ~8223; FEATURE_CATALOG executiveInsights ~67',
    model: 'GPT-5.4 Mini (T0 — hide nav + hard-off gate)',
    rootCause:
      'Executive Insights shipped in Reports submenu (Phase 15/17) but product decision 2026-05-21 is to retire the dashboard to icebox — nav should not appear and insights tab should not load even if tenant has executiveInsights entitlement.',
    fix:
      '(1) Hide or remove #nav-insights from Reports flyout; block switchTab("insights") and redirect if hash #insights. (2) Do not call VcInsightsManager.initInsightsDashboard on tab switch. (3) Optional: set executiveInsights default/plans all false in entitlements.js. Custom Report Studio (#nav-report-studio) unchanged.',
    before: 'Reports flyout shows Executive Insights; opening tab loads charts and refreshInsights()',
    after: 'Reports flyout only Custom Report Studio (or empty insights slot hidden); no #view-insights activation',
    userTestSteps: [],
  },
  {
    id: '39',
    title: 'Future improvement F3: hide phone simulator UI (code preserved — icebox)',
    status: 'pending',
    file: 'index.html, dispatcher/js/shadow_mode.js (simulator badge sync only)',
    lineRef:
      'Sidebar Preview Field App ~2795-2806; Service Intake Field app btn ~3108; openTechnicianAppPreview ~7993; #fieldAppSimulatorModal ~10034',
    model: 'GPT-5.4 Mini (T0 — hide nav/buttons + no-op openTechnicianAppPreview)',
    rootCause:
      'Phone simulator shipped for dispatcher preview (vc_shadow_viewer iframe + bezel modal) but product decision 2026-05-21 is to retire it to icebox — sidebar and intake shortcuts should not open the modal.',
    fix:
      '(1) Remove or hide sidebar Preview Field App <li> and Service Intake Field app button. (2) Early-return in openTechnicianAppPreview() (optional user-facing toast). (3) Ensure modal stays hidden on load. Leave 📱 Edit in Field App UI modal and vcShadowModal/shadowMode unchanged unless scope expands.',
    before: 'Dispatcher can open phone bezel simulator from sidebar or Service Intake; iframe loads technician/index.html with shadow params',
    after: 'No Preview Field App nav or Field app button; openTechnicianAppPreview is a no-op; documented in ROADMAP icebox / IDEA_TRACKER parked',
    userTestSteps: [],
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
