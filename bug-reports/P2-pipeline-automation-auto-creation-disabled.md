# P2: Pipeline automation does not auto-create workflow items on job creation

- **Priority**: P2 — a documented feature is disabled; a manual workaround exists (create the items directly)
- **Classification**: APPLICATION_BUG (behaviour diverges from the product walkthrough)
- **Status**: Confirmed by source inspection
- **Environment**: applies to all environments; staging runs this code
- **Repository**: `c:\services\jobs-backend`
- **File**: `Controller/jobController.js` (createJob, ~line 190; the automation call at line 427)
- **Endpoint**: `POST /workflow/jobs/jobs` (create job)

## What the product doc says
The "PMS Solutions – Full Updated User Walkthrough" (section 13, "Create a Job" →
"Important: Pipeline Automation" / "Automatic Creation Example") states that
selecting a Pipeline Template on job creation **automatically creates** an
Organizer, Proposal and/or Invoice as configured on the template:

```
Create Job → Select Pipeline Automation → System applies the template →
Organizer / Proposal / Invoice → Automatically Created (if configured)
```

## Actual behaviour
Creating a job does **not** run the stage's automations. In `createJob` the call
that would run them is **commented out**:

```js
// Controller/jobController.js:427
// runStageAutomations(job, stageObj.automations);
```

So no organizer/proposal/invoice is generated when a job is created, regardless
of the pipeline template's automation configuration.

## How automations actually run
Automations only fire through a **separate, explicit** endpoint —
`runStageAutomationsAndMoveJob` (`jobController.js:597`, exported at 875), i.e.
`POST /workflow/jobs/jobs/stage/automations` — which moves the job to a stage
and enqueues its automations to a **Redis/BullMQ worker** (`redis/account.worker.js`)
that processes them asynchronously (`case "Create Organizer"` →
`createOrganizer(...)`, `"Send Invoice"`, `"Send Proposal/Els"`, …). So the
feature exists but is (a) not triggered on job creation and (b) asynchronous /
worker-dependent, not the synchronous "created as part of the Job workflow" the
doc describes.

## Impact
The walkthrough's central "Pipeline Automation" value proposition (job creation
auto-generates the workflow items) does not hold. Users must either move the job
through stages to trigger automations via the worker, or create each Organizer /
Proposal / Invoice manually (which the doc also documents under "Manual Creation
of Additional Items", and which the QA automation covers).

## Evidence
- `jobController.js:427` — `runStageAutomations(...)` commented out inside `createJob`.
- `jobController.js:597` / `:875` — automations reachable only via `runStageAutomationsAndMoveJob`.
- `redis/account.worker.js` — the automation handlers (`Create Organizer`, `Send Invoice`, `Send Proposal/Els`) run in an async worker.

## Recommended direction (for the app team — QA does not fix)
Decide the intended behaviour: if job creation should auto-create items, re-enable
`runStageAutomations` in `createJob` (and confirm the worker path is reliable);
otherwise update the product walkthrough so it doesn't promise synchronous
auto-creation on job creation.

---
Reported by pms-qa-automation. No application code was modified. Per the QA
charter, this defect is reported, not fixed. The workflow video covers the
supported "manual creation" path instead. See CHARTER.md.
