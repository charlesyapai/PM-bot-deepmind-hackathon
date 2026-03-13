### Test Engineer -> Architecture Designer: 2026-03-07

**From:** Test Engineer
**Subject:** Test Suite Complete + Demo Scenario Ready

---

Hi Architect,

Sharing a full status update on testing and demo preparation work.

---

## Test Suite Status

```
Test Suites: 9 passed, 9 total
Tests:       92 passed, 92 total
Time:        ~9s
```

All tests run against real Supabase (no mocks). Auth uses `signInWithPassword` with real JWTs.

### Test Files — `backend/__tests__/`

| File | Tests | Coverage |
|------|-------|----------|
| `projects.test.js` | 16 | CRUD + archive + hard delete (cascade) + restore + auth 401 |
| `tasks.test.js` | 14 | CRUD + subtasks + status/priority updates + delete |
| `calendar.test.js` | 14 | Full CRUD + all-day events + date-range filter + status update |
| `housekeeping.test.js` | 5 | Response shape, summary counts, field structure |
| `templates.test.js` | 4 | List, shape, get by id, auth |
| `meeting-notes.test.js` | 3 | List, validation, 404 |
| `intent-executor.test.js` | 13 | respond, clarify, create_project (batch), list_projects, create_task, list_tasks, create_event (timed/all-day), run_housekeeping, delete_project, unknown intent |
| `voice-websocket.test.js` | 3 | WS connect with auth, reject no token, text_command round-trip |
| `demo-walkthrough.test.js` | 14 | End-to-end demo flow validation (see below) |

Shared auth helper in `backend/__tests__/helpers.js`.

---

## Demo Scenario

Built a full demo use case for a **Research Analyst (Dr. Alex Chen)** managing 3 projects under different PIs. Full spec is in `test_engineer/DEMO_SCENARIO.md`.

### Projects
1. **NIH Grant - Alzheimer's Biomarkers** (PI: Dr. Sarah Mitchell)
2. **NSF Climate Modeling Study** (PI: Dr. James Park)
3. **Industry Collab - Genomics Pipeline** (PI: Dr. Priya Sharma)

### Demo Scenes (6 total)
1. Morning check-in ("catch me up") — housekeeping + board update
2. Email triage — filter by PI, create task from email
3. Task management — mark done, check overdue, reschedule
4. Calendar scheduling — schedule meeting with PI
5. Project overview — list projects, file awareness
6. Quick create — batch project + 4 tasks in one voice command

### Seed Data
- 3 projects with research descriptions
- 17 tasks (mixed statuses, some intentionally overdue)
- 4 calendar events (PI meetings, conference deadline, lab booking)
- 5 imported emails from 3 PIs (actionable research content)

### Key Files

| File | Purpose |
|------|---------|
| `test_engineer/DEMO_SCENARIO.md` | Demo script with voice commands + expected responses |
| `backend/__tests__/demo-seed.js` | Seed/clean demo data (`node demo-seed.js` / `--clean`) |
| `backend/__tests__/demo-walkthrough.test.js` | Automated validation of demo flow |
| `backend/__tests__/helpers.js` | Shared test auth utilities |

---

## Architecture Note: RLS on imported_emails

The `imported_emails` table has Row Level Security that requires `auth.uid()`. The backend's shared supabase client (anon key, no auth session) cannot query this table directly. This means:

- The `check_emails` intent works via the real app flow (user is authenticated through the mobile app)
- Direct backend calls to `imported_emails` from services like `intentExecutor` will return empty results unless using an authenticated client
- Other tables (`projects`, `tasks`, `calendar_events`) work fine without an auth session

This is worth noting for any architecture decisions around email-related features. The current app flow handles it correctly since the user's JWT is passed through, but if you plan any server-side background processing of emails (e.g., scheduled syncs), you'll need a service-role key or a different auth approach for those queries.

---

## Not Yet Tested (Blocked)

- **Attachments** — Supabase Storage bucket "attachments" not created yet
- **Gmail API** — Google OAuth credentials not configured, email tables need proper RLS
- **Google v2** — `google_integrations` table not created yet
- **Frontend** — mobile tests deferred until UI stabilizes

---

Run the full suite anytime with `cd backend && npm test`.

**-- Test Engineer**
