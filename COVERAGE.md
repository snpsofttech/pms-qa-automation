# PMS QA — Feature Coverage Matrix

The single source of truth for "does automation cover everything we built?" Every
feature the admin and client apps implement is listed with the tags that place it in
a run level, its current automation status, and the Phase‑1 breadth target.

Built from a read-only feature inventory of `pms-frontend-multitenant` (admin) and
`pms-client-multitenant` (client), 2026-09-18. Backend endpoint depth is tracked
separately (see §API/Tenancy) and will be enriched once the service catalog sweep
completes.

---

## 1. Tagging scheme (two axes → composable levels)

Each test carries **one domain tag + one depth tag** (Playwright `@tag` in the title
or `tag:` option). "Levels" are not separate folders — they are `--grep` filters over
the same tests, so a feature is written once and appears in every level it belongs to.

**Domain / surface tags**
`@accounts @contacts @import @jobs @pipelines @tasks @organizers @proposals`
`@invoices @payments @documents @templates @bulk @chat @email @team @settings`
`@nav @insights @admin-ui @client-ui @api @tenancy @security`

**Depth tags**
`@happy` golden path · `@e2e` full cross-feature workflow · `@negative` validation/
error/permission · `@edge` boundary/edge behavior

### Run profiles (proposed npm scripts → your six levels)

| Your level | Command | Selector |
|---|---|---|
| 1. Happy Path (~15–20 min) | `npm run test:happy` | `--grep @happy` |
| 2. End-to-End (~45–60 min) | `npm run test:e2e` | full suite (or `--grep @e2e`) |
| 3. All Admin Screens | `npm run test:admin-screens` | `--grep @admin-ui` |
| 4. All Client Screens | `npm run test:client-screens` | `--grep @client-ui` |
| 5. Template Validations | `npm run test:templates` | `--grep @templates` |
| 6. Bulk Actions | `npm run test:bulk` | `--grep @bulk` |
| (also) Negative sweep | `npm run test:negative` | `--grep @negative` |

Status legend: ✅ covered · 🟡 partial (create only / no negatives) · ❌ gap ·
🚫 excluded (with reason) · ⚠️ stub/no-op in app (test asserts current behavior or file defect)

---

## 2. Admin app coverage

### 2.1 Accounts / Contacts / Import  `@accounts @contacts @import @admin-ui`
| Feature | Tags | Status | Phase-1 target / notes |
|---|---|---|---|
| Create account (Company) | `@accounts @happy` | ✅ | account-contact-drawer.spec + workflow |
| Create account (Individual) | `@accounts @happy` | ✅ | account-contact-drawer.spec |
| Account+Contact drawer negatives (name/company/dup/contact validation) | `@accounts @contacts @negative` | ✅ | account-contact-drawer.spec (8 cases) |
| Client-type toggle (Individual/Company field vis) | `@accounts @happy` | ✅ | account-contact-drawer.spec |
| Edit account | `@accounts @happy` | ❌ | AccountForm edit |
| Delete account | `@accounts @negative` | ❌ | + delete w/ dependent jobs/docs |
| Account dashboard tabs + Info render | `@accounts @admin-ui` | ✅ | account-info.spec (open account → Info tab) |
| Tag assignment (react-select) | `@accounts @happy` | ✅ | in business-workflow |
| Notes CRUD | `@accounts @happy` | ❌ | AccountDashboard/Notes |
| Create contact (New Contact drawer) | `@contacts @happy @negative @edge` | ✅ | create-contact.spec (5 cases: required, all-fields, first-name-req, manual name, multi-phone) |
| Edit / delete contact | `@contacts @happy` | ❌ | edit from list / Account Info (later group) |
| Associate contacts to account (add new + link existing) | `@contacts @happy` | ✅ | account-contact-drawer.spec (Add Contact + Link Existing) |
| Import contacts (CSV) | `@import @happy @negative` | ❌ | mapping, preview, partial-failure rows |
| Import accounts (CSV) | `@import @happy @negative` | ❌ | same |
| Upload folder to account | `@import @documents @happy` | ❌ | bulk folder upload |

### 2.2 Jobs / Pipelines  `@jobs @pipelines @admin-ui`  (AUTHORITATIVE inventory)
| Feature | Tags | Status | Phase-1 target / notes |
|---|---|---|---|
| Create job (single) | `@jobs @happy` | ✅ | business-workflow |
| Create job (bulk, multi-account) | `@jobs @bulk @happy` | ❌ | JobDrawer multi-account → `{jobs,failed}` |
| Create job with stage automations | `@jobs @happy` | ❌ | AutomationDrawer path |
| Edit job | `@jobs @happy` | ❌ | EditJobDrawer (pipeline/stage read-only) |
| **Delete job (single, JobList row menu)** | `@jobs @happy` | ✅ | your #1 — tests/admin/jobs/jobs.spec.ts |
| Delete job (Kanban hover-trash) | `@jobs @happy` | ❌ | alternate path (board) |
| Move job between **stages** (drag/drop) | `@jobs @happy` | ❌ | your #3 — *stage* move, not cross-pipeline |
| Move → automation drawer (apply/skip) | `@jobs @happy @edge` | ❌ | runStageAutomation; deselect-all edge |
| Job list: bulk delete selected | `@jobs @bulk @happy` | ✅ | jobs.spec.ts (selects only QA rows, never select-all) |
| Job list: filters (assignee/pipeline/status/priority) | `@jobs @admin-ui @edge` | ❌ | note Priority "All" filter bug |
| Job list: pagination | `@jobs @admin-ui` | ❌ | 25/50/100 |
| Archive / restore job | `@jobs @happy` | ⚠️❌ | firm-list Archive = stub toast; account-tab archive/restore real |
| Account-scoped Kanban (multi-pipeline) | `@jobs @admin-ui` | ❌ | Workflow tab |
| Create/edit pipeline template + reorder stages | `@pipelines @templates @happy` | ❌ | PipelineTemplate + StagesSection |
| Attach stage automations to template | `@pipelines @templates @happy` | ❌ | drives move-drawer |
| Delete pipeline (with jobs present) | `@pipelines @negative` | ❌ | |
| **Pipeline auto-create on job creation** | `@jobs` | 🚫 | disabled in app (jobController.js:427) — bug P2 filed |

### 2.3 Tasks  `@tasks @admin-ui`
| Feature | Tags | Status | Notes |
|---|---|---|---|
| Create task (via + menu) | `@tasks @happy` | ✅ | create-task.spec (account + name → Create) |
| Edit task (priority/status/subtasks) | `@tasks @happy` | ❌ | |
| Delete task | `@tasks @happy` | ❌ | pending + completed |
| Subtasks add/delete/check | `@tasks @edge` | ❌ | |

### 2.4 Organizers  `@organizers @admin-ui`
| Feature | Tags | Status | Notes |
|---|---|---|---|
| Create organizer (from template) | `@organizers @happy` | ✅ | create-organizer.spec (select template → Create) |
| **Delete organizer** | `@organizers @happy` | ❌ | your #2 |
| Send organizer to client | `@organizers @happy` | 🟡 | covered via workflow |
| Organizer **template** CRUD + sections | `@organizers @templates @happy` | ❌ | OrganizerTemplate |
| Bulk send organizer (multi-account) | `@organizers @bulk @happy` | ❌ | BulkActions/SendOrganizer |

### 2.5 Proposals / Engagement Letters  `@proposals @admin-ui`
| Feature | Tags | Status | Notes |
|---|---|---|---|
| Create proposal (multi-step wizard) | `@proposals @happy` | 🔨 | create-proposal.spec FIXME — per-step rich editors + step toggles (heavy) |
| Add/edit services & invoice line items | `@proposals @happy @edge` | ❌ | ServicesInvoicesStep, save-as-service |
| **Send for signature** | `@proposals @happy` | ❌ | your #6 (proposal side) |
| Delete proposal | `@proposals @happy` | ❌ | |
| Proposal **template** CRUD | `@proposals @templates @happy` | ❌ | ProposalTemp steps |
| Firm proposal list / new | `@proposals @admin-ui` | ❌ | AllProposalList / NewProposalForm |

### 2.6 Invoices / Billing / Payments  `@invoices @payments @admin-ui`
| Feature | Tags | Status | Notes |
|---|---|---|---|
| Create invoice | `@invoices @happy` | ✅ | create-invoice.spec (+ menu, line item) + workflow |
| Edit / delete invoice | `@invoices @happy` | ❌ | + delete w/ payment |
| Record offline payment | `@payments @happy` | ✅ | offline-payment.spec (tick pending invoice, pay) |
| Preview / download / send invoice | `@invoices @happy` | 🟡 | Billing view done; download/print ❌ |
| Invoice **template** CRUD + line items | `@invoices @templates @happy` | ❌ | InvoiceTemplates |
| Services & Categories CRUD | `@invoices @templates @happy` | ❌ | Services&Category |

### 2.7 Documents / Folders  `@documents @admin-ui`  (detailed inventory)
| Feature | Tags | Status | Notes |
|---|---|---|---|
| Folder create (rename/move/delete later) | `@documents @happy` | 🟡 | create-folder.spec (create ✅) |
| File upload (≤50MB, rejects audio/video) | `@documents @happy @negative` | 🟡 | upload done in doc-approval helper; UI drawer + validation ❌ |
| Folder upload (zip client-side) | `@documents @happy` | ❌ | FolderUploadDrawer |
| Apply folder template to account | `@documents @templates @happy` | ❌ | double-error-UI edge |
| **Send for approval (from tree + on-upload)** | `@documents @happy` | ✅🟡 | your #5 — helper+workflow cover; tree/on-upload path ❌ |
| **Send for signature (DocuSeal builder)** | `@documents @happy` | 🚫 | your #6 (doc side) — DocuSeal cross-origin iframe, excluded |
| Approve / disapprove (+reason) — admin view | `@documents @happy` | ✅ | workflow steps 15/16 |
| Invoice-lock / payment-gated document | `@documents @payments` | 🚫 | depends on payment (AffiniPay) — excluded |
| Lock / unlock file & folder | `@documents @happy` | ❌ | |
| Bulk: move / trash / lock / download | `@documents @bulk @happy` | ❌ | select-all cascade |
| Trash: page loads (restore/delete later) | `@documents @happy` | 🟡 | trash.spec (page renders ✅) |
| Trash: permanent delete (type-DELETE) | `@documents @negative` | ❌ | 60d text vs 2h countdown = defect |
| Document viewer (pdf/office/img/txt, zoom/rotate) | `@documents @admin-ui @edge` | ❌ | keyboard shortcuts |
| Audit trail view | `@documents @admin-ui` | ❌ | |
| Approvals tab / Signatures tab (read views) | `@documents @admin-ui` | ❌ | |
| **"Draft copies"** | `@documents` | ❓ | your #4 — NOT implemented (0 refs). Needs product decision |

### 2.8 Templates  `@templates @admin-ui`  (11+ types — your #7)
| Template type | Tags | Status | Notes |
|---|---|---|---|
| Task template | `@templates @happy` | ❌ | TasksTemp |
| Email template | `@templates @happy` | ✅ | email-template.spec (name + sender + subject) |
| Job template | `@templates @happy` | ✅ | job-template.spec (Firm Templates → Jobs tab → create) |
| Client-facing job status template | `@templates @happy` | ✅ | client-facing-status.spec (color + name + desc) |
| Folder template | `@templates @documents @happy` | ✅ | folder-template.spec (name → Create) |
| Chat template | `@templates @happy` | ✅ | chat-template.spec (name + sender + subject) |
| Invoice template | `@templates @invoices @happy` | ✅ | invoice-template.spec (name + payment + line item) |
| Organizer template | `@templates @organizers @happy` | ✅ | organizer-template.spec (name + organizer + section) |
| Proposal template | `@templates @proposals @happy` | ❌ | (2.5) |
| Pipeline template | `@templates @pipelines @happy` | ✅ | pipeline-template.spec (name + availableTo + 2 stages) |
| Tags | `@templates @happy` | ✅ | tags.spec (Add Tag: name + color → Create) |
| Common: duplicate / delete / delete-when-referenced | `@templates @negative` | ❌ | |

### 2.9 Bulk Actions  `@bulk @admin-ui`  (your #8)
| Feature | Tags | Status | Notes |
|---|---|---|---|
| Bulk manage tags (accounts/contacts) | `@bulk @happy` | ❌ | ManageTags |
| Bulk manage teams | `@bulk @happy` | ❌ | ManageTeams |
| Bulk contact settings | `@bulk @happy` | ❌ | ManageContactSettings |
| Bulk send email | `@bulk @email @happy` | ❌ | SendEmail |
| Bulk send organizer | `@bulk @organizers @happy` | ❌ | SendOrganizer |
| Bulk job delete | `@bulk @jobs @happy` | ❌ | (2.2) |
| Bulk chat archive/delete | `@bulk @chat @happy` | ❌ | (2.10) |
| Bulk document move/trash/lock/download | `@bulk @documents @happy` | ❌ | (2.7) |
| Edge: apply to 0 selected / partial failure | `@bulk @negative` | ❌ | |

### 2.10 Chat / Communication & Email  `@chat @email @admin-ui`
| Feature | Tags | Status | Notes |
|---|---|---|---|
| New chat (account) via + menu | `@chat @happy` | 🔨 | create-chat.spec FIXME — drawer won't complete w/ account+subject (candidate app bug) |
| Reply / edit (24h) / delete message | `@chat @happy @negative` | ❌ | edit-after-24h negative |
| Client tasks in chat (add/check/resend) | `@chat @happy` | ❌ | |
| Bulk archive/delete/pin chats | `@chat @bulk` | ❌ | pin is local-only (defect) |
| Internal comms (team↔team) | `@chat @happy` | ❌ | 10-min edit window |
| Email: compose/send (Gmail sync) | `@email @happy` | 🚫🟡 | Gmail-gated on staging; template select ok; assert gate |
| Email: reply/forward | `@email @negative` | ❌ | reply-all/forward payload bug |
| Inbox+ notifications (filters/bulk) | `@nav @bulk` | ❌ | dead-filter defects |

### 2.11 Team / Users / Permissions  `@team @admin-ui`
| Feature | Tags | Status | Notes |
|---|---|---|---|
| Invite / create team member | `@team @happy` | ❌ | AddEditTeamMemberDrawer |
| Edit member + 26 permission toggles | `@team @happy @edge` | ❌ | ~19 hard-disabled |
| Deactivate / delete / resend activation | `@team @happy` | ❌ | delete uses window.confirm |
| Groups: create/edit/delete | `@team @happy` | ❌ | leader/members |
| Team-member activation flow (email link) | `@team @e2e` | ❌ | token verify → set password |
| Role-blocked routes (team_member → firm settings) | `@team @security @negative` | ❌ | direct-URL access |

### 2.12 Settings / Nav / Insights  `@settings @nav @insights @admin-ui`
| Feature | Tags | Status | Notes |
|---|---|---|---|
| My Account: edit profile / avatar | `@settings @happy` | ❌ | |
| Login details (password-verify gate) | `@settings @security` | ❌ | |
| Change password → forced logout | `@settings @e2e` | ❌ | |
| Notification preferences toggles | `@settings @happy` | ❌ | |
| Connect Gmail (OAuth) | `@settings @email` | 🚫 | staging OAuth → prod redirect; assert unavailable |
| **Firm Settings save** | `@settings @negative` | ⚠️ | ALL Save buttons no-op — assert non-persistence / file defect |
| Theme settings (localStorage) | `@settings @happy` | ❌ | 15 presets + custom |
| Sidebar nav (role/permission filtering) | `@nav @admin-ui @security` | 🟡 | navSidebar helper exists; permission-hide ❌ |
| Global "+" quick-create menu | `@nav @happy` | ❌ | offline-payment handler bug |
| Insights KPIs | `@insights @admin-ui` | ⚠️ | static demo data — assert renders / file defect |

---

## 3. Client app coverage  `@client-ui`

| Feature | Tags | Status | Notes |
|---|---|---|---|
| Login (single + multi-account select) | `@client-ui @happy @edge` | 🟡 | single done; multi-account modal, 0-account edge ❌ |
| Forgot / reset / activate password | `@client-ui @happy @negative` | 🟡 | activate covered; forgot/reset ❌ |
| Account switching (re-scope all data) | `@client-ui @edge` | ❌ | cross-cutting; stale accountId risk |
| Home dashboard widgets | `@client-ui @admin-ui` | 🟡 | seen in workflow; per-widget ❌ |
| Complete organizer (conditional/repeatable/file) | `@organizers @client-ui @happy @edge` | 🟡 | basic complete done; conditional/repeat/required-file ❌ |
| Sign proposal (draw + type + terms) | `@proposals @client-ui @happy @negative` | 🟡 | type-mode done; draw-mode, no-terms negative ❌ |
| View / pay invoice (AffiniPay) | `@payments @client-ui @happy` | 🚫🟡 | view done; **payment excluded**; pay-already-paid negative |
| Payments history | `@invoices @client-ui` | ❌ | overdue auto-flip side-effect |
| Documents: view / download | `@documents @client-ui @happy` | 🟡 | view done; download/bulk ❌ |
| Documents: e-sign (DocuSeal) | `@documents @client-ui` | 🚫 | excluded (cross-origin) |
| Documents: approve / disapprove (+reason) | `@documents @client-ui @happy @negative` | ✅ | workflow; disapprove-without-reason negative ❌ |
| Payment-gated doc unlock | `@documents @payments @client-ui` | 🚫 | payment-dependent |
| Trash: restore / permanent delete | `@documents @client-ui @negative` | ❌ | |
| Chat: send/reply/edit/delete + tasks | `@chat @client-ui @happy` | ❌ | attachments, 24h edit |
| Settings / profile edit | `@settings @client-ui @happy` | ❌ | email immutable |

---

## 4. API / Tenancy / Security  `@api @tenancy @security`

| Area | Tags | Status | Notes |
|---|---|---|---|
| Auth: login contract + rejections | `@api @happy @negative` | ✅ | login.spec |
| Service auth-boundary sweep (15 svc) | `@api @security` | ✅ | service-auth-boundary |
| Cross-tenant read isolation (accounts/contacts) | `@tenancy @security` | ✅ | red until fix deployed (P0) |
| Cross-tenant write isolation | `@tenancy @security` | ✅ | account-contact-write-isolation |
| Jobs tenancy | `@tenancy` | 🟡 | BLOCKED — no data in tenant B |
| Known auth gaps (sidebar/client-sidebar/folder) | `@security` | ✅ | red until fix (P1) |
| Field-exposure (password hash) | `@security` | ✅ | contact API |
| Email-decouple regression | `@api` | ✅ | email-decouple |
| **Per-service functional/tenancy depth (13 svc)** | `@api @tenancy` | ❌ | backend catalog pending (rate-limited); enrich then expand |

---

## 5. Reality checks — not-implemented / stubs (do NOT write happy tests for these)

- **Cross-pipeline job move** — not a feature; only stage moves within a pipeline.
- **Document "draft copies"** — not implemented; closest is approval-gated upload.
- **Firm Settings save** — every Save button is a no-op; no persistence.
- **Insights** — hardcoded demo data; no API/filters.
- **Firm-list job "Archive"** — stub toast "to be implemented" (account-tab archive is real).
- **Client pinned chats** — local-only, lost on refresh.
- **Email reply-all/forward** — send identical payload as reply.
- **Inbox+ filters** — several categories have key mismatches (dead).

These are candidate **defect reports**, and tests here assert the *current* behavior
(so a future fix flips the test), per CHARTER.md.

---

## 6. Phased plan (breadth-first, per your direction)

**Phase 0 — scaffolding** (prereq)
Retrofit `@domain @depth` tags onto existing specs; add the run-profile npm scripts;
add reusable page objects/fixtures for the untouched domains.

**Phase 1 — breadth: one `@happy` test per feature row above** (the bulk of the work)
Priority order within breadth (highest-value first): job delete + stage-move + bulk
delete → organizer create/delete + templates → all template-type creation → bulk
actions → documents (folder CRUD, upload, move, trash restore) → tasks → proposals
wizard → team/groups → chat → client screens (multi-account, organizer conditional,
disapprove-no-reason) → settings/nav. Target: every implemented feature exercised once.

**Phase 2 — depth:** add `@negative` + `@edge` per feature (validation, permissions,
partial-failure, the reality-check assertions).

**Phase 3 — exhaustive `@e2e` chains** and the per-service API depth (§4 last row).

**Excluded (genuine, documented):** DocuSeal document e-signature (cross-origin
iframe), invoice payment + payment-gated document (AffiniPay live charge).

Estimates and per-feature test counts are added as Phase 1 is scoped.
