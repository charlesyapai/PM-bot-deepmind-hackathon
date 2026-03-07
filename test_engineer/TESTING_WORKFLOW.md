# Personal Bot -- Testing Workflow Guide

**Author:** Project Manager
**Date:** 2026-03-07
**For:** Test Engineer

---

## 1. Current System Overview

The app is a voice-driven personal project/task manager with:
- **Backend:** Express.js on port 3000, real Supabase PostgreSQL database
- **Mobile:** React Native (Expo) running on iOS Simulator (iPhone 16e, iOS 26.3)
- **AI:** Google Gemini 2.0 Flash for intent parsing (function calling)
- **STT:** Deepgram streaming via WebSocket
- **Auth:** Supabase Auth JWT (decoded with `jwt.decode()` on backend)

---

## 2. Test Environment Setup

### Backend Tests

```bash
cd backend/
npm install          # Installs jest, supertest (already in devDependencies)
npm test             # Runs jest --forceExit
```

**Config:** `package.json` has `"testEnvironment": "node"` and `"testMatch": ["**/__tests__/**/*.test.js"]`

**Key:** `server.js` exports `{ app, server }` and has a `require.main === module` guard, so tests can import `app` without starting the HTTP listener.

### Mobile Tests

```bash
cd mobile/
npm install jest-expo @testing-library/react-native @testing-library/jest-native --save-dev
npx jest
```

**Note:** Mobile tests need mocks for `lucide-react-native`, `@react-navigation`, `react-native-safe-area-context`, `react-native-screens`, and `expo-av`/`expo-audio`.

### Test User Credentials

- Email: `testuser2@gmail.com`
- Password: `TestPassword123`
- Supabase email confirmation is disabled (instant login)

---

## 3. What to Test -- v1 Feature Matrix

### 3.1 Backend API Endpoints (Integration Tests)

All endpoints require `Authorization: Bearer <jwt>` header. The JWT contains `sub` (user_id).

| Endpoint | Method | What to Test | File |
|---|---|---|---|
| `/api/v1/projects` | GET | List projects, filter by `?status=active\|archived`, `?updated_after=` | `projects.test.js` |
| `/api/v1/projects` | POST | Create with title (required), description, template_id | `projects.test.js` |
| `/api/v1/projects/:id` | GET | Single project, 404 for wrong user | `projects.test.js` |
| `/api/v1/projects/:id` | PUT | Update title, description, status, template_id | `projects.test.js` |
| `/api/v1/projects/:id` | DELETE | Soft archive (default), hard delete (`?hard=true` cascades tasks) | **NEW** |
| `/api/v1/projects/:id/restore` | POST | Unarchive project (set status back to active) | **NEW** |
| `/api/v1/tasks` | GET | List tasks, filter by `?project_id=` | `tasks.test.js` |
| `/api/v1/tasks` | POST | Create task with title, project_id, priority, due_date | `tasks.test.js` |
| `/api/v1/tasks/:id` | PUT | Update title, status, priority, description, due_date | `tasks.test.js` |
| `/api/v1/tasks/:id` | DELETE | Hard delete task | `tasks.test.js` |
| `/api/v1/templates` | GET | List all templates (3 seed) | `templates.test.js` |
| `/api/v1/meeting-notes` | GET/POST | List, create with title+transcript | `meeting-notes.test.js` |
| `/api/v1/calendar` | GET/POST/PUT/DELETE | CRUD calendar events, date-range filter | **NEW** |
| `/api/v1/housekeeping` | GET | Returns overdue tasks, stale projects, unset tasks, past events, upcoming deadlines | **NEW** |
| `/api/v1/attachments` | GET/POST/DELETE | File upload (multer), download signed URL, delete | **NEW** |
| `/api/v1/gmail/*` | Various | Status, connect, disconnect, rules CRUD, sync, email-to-task | **NEW** |

### 3.2 AI Intent System (Unit + Integration Tests)

The AI pipeline is: `voice/text -> Gemini parseIntent -> intentExecutor -> Supabase mutation -> response`

| Intent | What to Test | Key Assertions |
|---|---|---|
| `create_project` | Title extraction, optional tasks array batch creation | Project created, tasks inserted with project_id |
| `create_task` | Title, priority, due_date, project matching by name | Task created with correct fields |
| `update_task` | Status change, priority change | Task fields updated |
| `delete_task` | Task deletion by name/context | Task removed from DB |
| `delete_project` | Soft archive by project name | Project status set to "archived" |
| `list_projects` | Returns user's projects | Response includes project list |
| `list_tasks` | Filter by project, status | Response includes filtered tasks |
| `create_event` | Calendar event creation | Event in calendar_events table |
| `run_housekeeping` | Board health check | Returns categorized issues |
| `auto_cleanup` | Archive stale projects, complete past events | Projects archived, events updated |
| `respond` | General conversation | Text response returned |
| `clarify` | Ambiguous input | Question returned to user |

**Test approach for AI intents:**
1. Mock `geminiClient.parseIntent()` to return specific function call objects
2. Call `intentExecutor` directly with mocked intent + real Supabase
3. Assert database state changes and response messages

### 3.3 Voice Pipeline (Integration Tests)

The WebSocket voice pipeline: `ws://localhost:3000/voice/stream`

| Stage | What to Test | How |
|---|---|---|
| WS Connection | Connects with valid JWT auth param | WebSocket client with `?token=<jwt>` |
| Text Command | `{ type: "text_command", text: "create a project called Test" }` | Send JSON, assert response |
| Audio Streaming | Binary audio frames processed by Deepgram | Requires Deepgram API key |
| Session Cleanup | WS close triggers session teardown | Close connection, verify no leaks |
| Error Handling | Invalid JWT returns error | Connect without token, expect close |

**Simplified text command test (no mic needed):**
```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/voice/stream?token=<jwt>');
ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'text_command', text: 'list my projects' }));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  // Assert msg.type === 'intent_result' and msg.data contains projects
});
```

### 3.4 Frontend Screens (Component Tests)

| Screen | What to Test |
|---|---|
| LoginScreen | Email/password inputs, submit, error display, auth state transition |
| ProjectsScreen | Active/Archived tabs switch, project cards render, archive/restore/delete buttons, sort options, create modal |
| ProjectDetailScreen | Task list renders, task creation modal, status/priority toggles, attachment chips |
| TasksScreen | All-tasks view, filter by status, task cards |
| CalendarScreen | Day-grouped events, create event modal, project linking |
| SettingsScreen | All sections render, sign out confirmation, housekeeping modal |
| GmailSettingsScreen | Connection status, rules list, imported emails, sync button |
| VoiceOverlay | Mic button triggers overlay, text input mode, response cards display |

### 3.5 Auth Flow (End-to-End)

| Scenario | Expected |
|---|---|
| Valid credentials | Login success, token stored, MainTabs shown |
| Invalid credentials | Error message displayed, stays on LoginScreen |
| Expired JWT | API returns 401/403, redirect to login |
| No auth header | API returns 401 |

---

## 4. Testing Strategy

### Priority Order

1. **Backend API integration tests** -- highest ROI, catch data bugs
2. **AI intent unit tests** -- verify Gemini function call handling
3. **WebSocket text command tests** -- verify voice pipeline without mic
4. **Frontend component tests** -- verify UI renders correctly
5. **End-to-end flows** -- full user journey tests (manual or automated)

### Test Data Strategy

- Use the test user (`testuser2@gmail.com`) with real Supabase
- Create test fixtures at the start of each test suite (projects, tasks)
- Clean up fixtures in `afterAll` blocks
- For AI tests, mock the Gemini API response (avoid quota issues)

### Mocking Strategy

| Component | Mock? | Why |
|---|---|---|
| Supabase | No (real DB) | Integration tests should hit real Supabase for accuracy |
| Gemini AI | Yes (mock) | Free tier quota exhausted, responses are non-deterministic |
| Deepgram | Yes (mock) | Requires API key, audio input is complex to simulate |
| Auth JWT | Generate test tokens | Use `jwt.sign()` with test user sub to create valid tokens |

---

## 5. Existing Test Files

### Backend (`backend/__tests__/`)
- `projects.test.js` -- 11 test cases (GET list, POST create, GET by id, PUT update)
- `tasks.test.js` -- 15 test cases (GET tasks, POST task, PUT task, POST subtask, PUT reorder)
- `templates.test.js` -- 6 test cases (GET list, GET by id, config shape)
- `meeting-notes.test.js` -- 14 test cases (GET list, POST create, GET by id, POST summarize, PUT action item)

### Mobile (`mobile/__tests__/`)
- `navigation.test.tsx` -- 8 test cases (TabNavigator, RootNavigator, all tabs)
- `theme.test.ts` -- 29 test cases (color tokens, theme shape, typography scale)

### What's Missing (Needs New Tests)

**Backend:**
- `calendar.test.js` -- Calendar CRUD, date-range filtering
- `housekeeping.test.js` -- Health check response shape, overdue detection
- `attachments.test.js` -- File upload/download/delete with Supabase Storage
- `gmail.test.js` -- OAuth flow, rules CRUD, email import, sync
- `projects.test.js` -- Update for DELETE (archive/hard), POST restore
- `voice-websocket.test.js` -- WebSocket connection, text commands, auth
- `intent-executor.test.js` -- All 14 intent handlers with mocked Gemini

**Mobile:**
- `ProjectsScreen.test.tsx` -- Active/Archived tabs, sort, archive/restore/delete
- `LoginScreen.test.tsx` -- Auth flow
- `CalendarScreen.test.tsx` -- Event rendering, create modal
- `VoiceOverlay.test.tsx` -- Overlay states, text input

---

## 6. Running Tests

### Backend
```bash
cd backend/
npm test                        # Run all tests
npx jest projects.test.js       # Run specific file
npx jest --verbose              # Verbose output
```

### Mobile
```bash
cd mobile/
npx jest                        # Run all tests
npx jest --coverage             # With coverage report
```

### Manual Testing (Simulator)

The app runs on iOS Simulator at `/tmp/PersonalBotMobile`.

1. Start backend: `cd backend && node server.js`
2. Start Metro: `cd /tmp/PersonalBotMobile && npx expo start`
3. Open simulator and test flows manually
4. Check backend logs at `/tmp/backend.log`

### WebSocket Manual Test
```bash
# Install wscat if needed: npm i -g wscat
# Get a JWT by logging in via the app or Supabase dashboard

wscat -c "ws://127.0.0.1:3000/voice/stream?token=<JWT>"
> {"type":"text_command","text":"list my projects"}
```

---

## 7. Quality Gates

Before any release:
- [ ] All backend integration tests pass
- [ ] All mobile component tests pass
- [ ] Manual smoke test of: login -> create project -> create task -> voice command -> verify result
- [ ] No console errors in Metro bundler output
- [ ] No unhandled promise rejections in backend logs
- [ ] AI intent tests pass with mocked Gemini responses
- [ ] Archive/restore/delete flows work correctly
- [ ] Voice text command pipeline works end-to-end

---

## 8. v2 Google Integration Testing (NEW)

### 8.1 Overview

v2 adds deep Google integration: unified OAuth, Calendar pull-sync, Drive file listing, and the Board Update Engine. See `architecture_designer/GOOGLE_INTEGRATION_ARCHITECTURE.md` and `architecture_designer/DEMO_PLAN.md` for full context.

**Key constraint:** For the demo, all Google APIs are **read-only**. No writes to Google Calendar, Drive, or Gmail. This simplifies testing.

### 8.2 New Backend Endpoints to Test

| Endpoint | Method | What to Test | File |
|---|---|---|---|
| `/api/v1/google/auth-url` | GET | Returns valid Google OAuth URL with correct scopes | `google.test.js` |
| `/api/v1/google/callback` | GET | Exchanges code for tokens, stores in `google_integrations` | `google.test.js` |
| `/api/v1/google/status` | GET | Returns connection status + granted scopes | `google.test.js` |
| `/api/v1/google/disconnect` | DELETE | Removes tokens, returns disconnected status | `google.test.js` |
| `/api/v1/board-update` | POST | Triggers compound update, returns AI summary | `board-update.test.js` |
| `/api/v1/board-update/history` | GET | Returns past board updates (post-demo) | `board-update.test.js` |
| `/api/v1/drive/files/:projectId` | GET | Lists files in project's Drive folder | `drive.test.js` |
| `/api/v1/calendar/sync` | POST | Pulls events from Google Calendar | `calendar-sync.test.js` |

### 8.3 New AI Intents to Test

| Intent | What to Test | Key Assertions |
|---|---|---|
| `run_board_update` | Triggers full compound pipeline | Returns AI summary with email, drive, calendar, housekeeping data |
| `list_drive_files` | Lists files for a project | Returns file list with names and modified times |
| `sync_calendar` | Triggers calendar pull | Returns synced event count |

**Test approach:** Mock all Google API responses (Gmail, Calendar, Drive). Mock Gemini for summary generation. Assert that the Board Update Engine correctly orchestrates all 4 scans and passes data to Gemini.

### 8.4 Mocking Google APIs

| Service | Mock Strategy | Details |
|---|---|---|
| Google OAuth | Mock `googleapis` OAuth2 client | Return test tokens, skip actual OAuth flow |
| Gmail API | Mock `gmail.users.messages.list/get` | Return canned email list |
| Google Calendar | Mock `calendar.events.list` | Return canned event list |
| Google Drive | Mock `drive.files.list` | Return canned file metadata |
| Gemini (board summary) | Mock `parseIntent` or summary generator | Return canned AI summary |

```javascript
// Example mock for Google Calendar
jest.mock('googleapis', () => ({
  google: {
    calendar: () => ({
      events: {
        list: jest.fn().mockResolvedValue({
          data: {
            items: [
              { id: 'gcal_1', summary: 'Team Standup', start: { dateTime: '2026-03-08T10:00:00Z' }, end: { dateTime: '2026-03-08T11:00:00Z' } },
              { id: 'gcal_2', summary: 'Client Call', start: { dateTime: '2026-03-08T14:00:00Z' }, end: { dateTime: '2026-03-08T15:00:00Z' } }
            ],
            nextSyncToken: 'test-sync-token'
          }
        })
      }
    }),
    drive: () => ({
      files: {
        list: jest.fn().mockResolvedValue({
          data: {
            files: [
              { id: 'file_1', name: 'design-spec.pdf', modifiedTime: '2026-03-07T14:00:00Z', mimeType: 'application/pdf' },
              { id: 'file_2', name: 'api-docs.md', modifiedTime: '2026-03-06T10:00:00Z', mimeType: 'text/markdown' }
            ]
          }
        })
      }
    }),
    oauth2: () => ({
      userinfo: {
        get: jest.fn().mockResolvedValue({ data: { email: 'test@gmail.com' } })
      }
    })
  }
}));
```

### 8.5 Board Update Integration Test

The Board Update Engine is the hero feature. Test it end-to-end with mocked Google services:

```javascript
describe('POST /api/v1/board-update', () => {
  it('returns AI summary with data from all 4 sources', async () => {
    // Setup: mock Google services, have projects/tasks in DB
    const res = await request(app)
      .post('/api/v1/board-update')
      .set('Authorization', `Bearer ${testJwt}`)
      .expect(200);

    expect(res.body.summary).toBeTruthy();
    expect(res.body.emailData).toBeDefined();
    expect(res.body.driveData).toBeDefined();
    expect(res.body.calendarData).toBeDefined();
    expect(res.body.housekeepingData).toBeDefined();
  });

  it('works when Google is not connected (graceful degradation)', async () => {
    // No google_integrations row for this user
    const res = await request(app)
      .post('/api/v1/board-update')
      .set('Authorization', `Bearer ${testJwt}`)
      .expect(200);

    // Should still return housekeeping data, but email/drive/calendar are empty
    expect(res.body.emailData).toEqual({ newEmails: 0 });
    expect(res.body.driveData).toEqual({ files: [] });
    expect(res.body.calendarData).toEqual({ synced: 0 });
    expect(res.body.housekeepingData).toBeDefined();
  });
});
```

### 8.6 New Schema Assertions

Tests should verify these new columns exist and behave correctly:

| Table | New Column | Assertion |
|---|---|---|
| `calendar_events` | `google_event_id TEXT` | Populated after calendar sync, null for app-created events |
| `calendar_events` | `sync_source TEXT` | 'app' for local events, 'google' for synced events |
| `projects` | `drive_folder_id TEXT` | Populated when Drive folder linked, null otherwise |
| `google_integrations` | All columns | Created on OAuth connect, deleted on disconnect |
| `board_updates` | All columns | Created on each board update with JSONB snapshots |

### 8.7 Frontend Testing (v2)

| Screen | What to Test |
|---|---|
| DashboardScreen | Board status card renders, [Update] button triggers API call, loading/shimmer states, project cards show Drive/email metadata, upcoming strip shows events with badges |
| CalendarScreen | [GCal] and [App] badges render correctly, [Sync] button triggers calendar sync, external events show "External" label |
| ProjectDetailScreen | Tab strip renders (Tasks/Files/Emails), Files tab shows Drive files, Emails tab shows matched emails |
| SettingsScreen | Google integration row shows connected/disconnected state, tapping navigates to GoogleSettingsScreen |

### 8.8 Demo Smoke Test Checklist

Before the demo, manually verify this exact sequence:

- [ ] App opens to DashboardScreen
- [ ] Google shows "Connected" in Settings
- [ ] Tap [Update] on Dashboard
- [ ] Progress text cycles through 4 stages
- [ ] Board Status Card populates with AI summary mentioning emails, Drive files, calendar events, and task issues
- [ ] Project cards show Drive file counts
- [ ] Upcoming strip shows Google Calendar events with [GCal] badges
- [ ] Voice command "Update my board" triggers same flow via VoiceOverlay
- [ ] Voice command "What files are in my app project?" returns Drive file list
- [ ] Voice command "Mark the login bug as in progress" updates the task
- [ ] CalendarScreen shows synced events with [GCal] badges
- [ ] ProjectDetail Files tab shows Drive files for project
