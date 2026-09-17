# P2: GET /workflow/jobs/jobs/count and /jobs/list always return 500 (route shadowing)

- **Priority**: P2 — two endpoints permanently unreachable; a workaround exists (the 3-segment variants work)
- **Classification**: APPLICATION_BUG
- **Status**: Confirmed (reproduced live on staging; root cause verified in source)
- **Environment**: staging (`https://staging-admin.snptaxes.com`)
- **Repository**: `c:\services\jobs-backend`
- **File**: `Routes/jobRoutes.js` — `router.route("/jobs/:id")` at line 51, `router.get("/jobs/count", ...)` at line 62, `router.get("/jobs/list", ...)` at line 74
- **Function/Component**: Express route registration order; handlers `jobController.getJobsCount` and `jobController.getJobs` are never reached
- **Endpoint/UI location**: `GET /workflow/jobs/jobs/count`, `GET /workflow/jobs/jobs/list`
- **Test case**: `tests/smoke/api.smoke.spec.ts` › Backend — smoke › central services respond for an authenticated admin (originally probed `/jobs/count`; now points at a working endpoint, see note below)

## Steps to reproduce
1. Authenticate as any admin.
2. `GET /workflow/jobs/jobs/count`.
3. `GET /workflow/jobs/jobs/list`.

## Expected behavior
`200` with a job count / job list respectively. Both handlers exist and are wired up.

## Actual behavior
Both return `HTTP 500`:

```json
{"error":"Cast to ObjectId failed for value \"count\" (type string) at path \"_id\" for model \"Job\""}
```

## Root cause
Confirmed. `Routes/jobRoutes.js` registers the parameterised route **before** the literal ones:

```js
router.route("/jobs/:id")          // line 51  ← matches first
...
router.get("/jobs/count", ...)     // line 62  ← never reached
router.get("/jobs/list", ...)      // line 74  ← never reached
```

Express matches in registration order, so `/jobs/count` is captured by `/jobs/:id` with `id = "count"`, and Mongoose then fails casting `"count"` to an ObjectId.

Only 2-segment literals declared after line 51 are affected. Confirmed by contrast in the same run — the 3-segment siblings are not shadowed and work correctly:

| Endpoint | Result |
|---|---|
| `GET /workflow/jobs/jobs/count` | **500** |
| `GET /workflow/jobs/jobs/list` | **500** |
| `GET /workflow/jobs/jobs/count/active` | 200 |
| `GET /workflow/jobs/jobs/count/inactive` | 200 |
| `GET /workflow/jobs/jobs` | 200 |

## Recommended fix direction
Move the literal routes (`/jobs/count`, `/jobs/list`) above `router.route("/jobs/:id")`. Note `proposal-backend/routes/accountProposal.js` already handles this correctly — it declares `DELETE /delete-multiple` before `DELETE /:id` with a comment explaining why — so the convention exists in this codebase and just wasn't applied here.

Worth grepping the other services for the same ordering mistake: any literal path declared after a sibling `/:id` route at the same depth is silently unreachable.

## Note on QA suite impact
`tests/smoke/api.smoke.spec.ts` originally used `/jobs/count` as the jobs-backend liveness probe, which would have made the smoke suite fail against a healthy server. That's been repointed to `GET /workflow/jobs/jobs`. This bug is what surfaced it, but the framework change is a QA-side fix, not a workaround masking the defect — the defect stays open here until the route order is corrected.

---
Reported by pms-qa-automation. No application code was modified. See CHARTER.md.
