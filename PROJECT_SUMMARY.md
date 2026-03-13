# SmoothStream (Personal Bot) - Project Summary

## What It Does

SmoothStream is an AI-powered project management app for iOS that reads your Gmail, Google Calendar, and Google Drive, then tells you what needs your attention. It turns emails into projects and tasks, prioritizes your day based on your free time, and lets you manage everything through simple text commands.

---

## Architecture Overview

```
Mobile App (React Native / Expo)
       |
       | REST API (HTTP) + WebSocket (voice/text commands)
       v
Backend (Node.js / Express, port 3000)
       |
       |--- Supabase (PostgreSQL + Auth + Storage)
       |--- Google Gemini AI (intent parsing + summaries)
       |--- Google APIs (Gmail, Calendar, Drive)
       |--- Deepgram (speech-to-text)
```

- **Mobile**: React Native with Expo, TypeScript, bottom tab navigation
- **Backend**: Express.js on port 3000, `http.createServer` for WebSocket support
- **Database**: Supabase (PostgreSQL) with JWT auth (ES256)
- **AI**: Google Gemini `gemini-3.1-flash-lite-preview` with 22 function declarations
- **STT**: Deepgram streaming via WebSocket + batch transcription

---

## Feature Inventory

### 1. Board Update Engine (Compound AI Scan)
**What**: One-tap scan that reads Gmail, Drive, Calendar, and task state, then produces an AI summary with actionable suggestions.

**How it works**:
1. Scans Gmail using email rules (sender filters)
2. Scans Google Drive for modified files per project
3. Syncs Google Calendar bidirectionally
4. Runs housekeeping analysis (overdue tasks, stale projects, upcoming deadlines)
5. Feeds everything to Gemini AI which returns a summary + suggested actions
6. User can accept/dismiss each suggestion individually

**Key files**:
- `backend/src/services/boardEngine/boardUpdateEngine.js` - Orchestrator
- `backend/src/services/boardEngine/boardSummaryGenerator.js` - AI prompt + JSON parsing
- `backend/src/routes/board-update.js` - API endpoints (trigger, history, apply)
- `mobile/src/screens/DashboardScreen.tsx` - UI with selectable suggestion cards

**Endpoints**:
- `POST /api/v1/board-update` - Trigger full board update
- `GET /api/v1/board-update/history` - Past board updates
- `POST /api/v1/board-update/apply` - Execute selected suggestions

### 2. AI Text Commands
**What**: Natural language text input that parses user intent and executes CRUD operations.

**How it works**:
1. User types a command (e.g. "Mark the literature review as done")
2. Backend fetches user context (projects, tasks, calendar, emails)
3. Gemini parses intent into one of 22 function calls
4. Intent executor performs the corresponding Supabase operation
5. Result returned to user

**22 supported intents**: create_project, list_projects, delete_project, create_task, update_task, list_tasks, list_events, create_event, update_event, delete_event, run_housekeeping, auto_cleanup, check_emails, create_task_from_email, sync_calendar, run_board_update, upload_to_drive, list_drive_files, read_drive_file, draft_email, accept_suggestion, respond/clarify

**Key files**:
- `backend/src/services/logicAi/geminiClient.js` - 22 function declarations + system prompt
- `backend/src/services/logicAi/intentExecutor.js` - Executes parsed intents
- `backend/src/services/logicAi/voiceCommandHandler.js` - Orchestrates context + parsing + execution
- `mobile/src/components/AiInputBar.tsx` - Inline text input UI

### 3. Project & Task Management
**What**: Full CRUD for projects and tasks with AI-powered editing.

**Features**:
- Create/archive/restore/delete projects
- Create/update/delete tasks with priority, due dates, tags, descriptions
- Subtask support (parent_task_id)
- Collapsible project sections in task list
- AI task editing: type a natural language instruction to modify any task field
- "Note" button to append text to task description
- Task reordering

**Key files**:
- `backend/src/routes/projects.js` - Project CRUD
- `backend/src/routes/tasks.js` - Task CRUD + daily summary + AI edit
- `mobile/src/screens/TasksScreen.tsx` - Task list with collapsible sections
- `mobile/src/screens/ProjectsScreen.tsx` - Project list with templates
- `mobile/src/screens/ProjectDetailScreen.tsx` - 3-tab detail view (Tasks | Files | Emails)

**Endpoints**:
- `GET/POST /api/v1/projects`, `GET/PUT/DELETE /api/v1/projects/:id`
- `GET/POST /api/v1/tasks`, `PUT/DELETE /api/v1/tasks/:id`
- `POST /api/v1/tasks/:id/ai-edit` - AI-powered task editing
- `POST /api/v1/tasks/:id/subtasks` - Create subtask
- `PUT /api/v1/tasks/reorder` - Bulk reorder

### 4. Daily Summary ("Today's Focus")
**What**: AI-generated workflow recommendation that considers tasks, calendar, and free time.

**How it works**:
1. Fetches all non-done tasks across active projects
2. Fetches today's calendar events
3. Computes free time blocks between events (8 AM - 6 PM workday)
4. Sends tasks + calendar + free time to Gemini
5. AI recommends what to focus on given available time

**Key files**:
- `backend/src/routes/tasks.js` (GET /api/v1/tasks/daily-summary)
- `mobile/src/screens/TasksScreen.tsx` - Displays summary at top

### 5. Google Integration (Unified OAuth)
**What**: Single OAuth flow connecting Gmail, Calendar, and Drive.

**Services**:
- **Gmail**: Fetch emails by sender/label filters, import to Supabase, create tasks from emails
- **Calendar**: Bidirectional sync with Google Calendar, push/pull events
- **Drive**: Per-project folders, file upload/download/list, auto-create root "Personal Bot" folder

**Key files**:
- `backend/src/services/google/googleAuthClient.js` - Unified OAuth (Gmail + Calendar + Drive scopes)
- `backend/src/services/google/calendarSyncService.js` - Bidirectional calendar sync
- `backend/src/services/google/driveService.js` - Drive file management
- `backend/src/services/gmail/gmailClient.js` - Gmail API wrapper
- `backend/src/routes/google.js` - OAuth endpoints
- `backend/src/routes/gmail.js` - Email rule management
- `backend/src/routes/drive.js` - Drive file endpoints
- `mobile/src/screens/GoogleSettingsScreen.tsx` - Connect/disconnect + service status

**Email Rules System**:
- Rules filter emails by sender address
- Rules with `project_id` map emails to a specific project
- Rules without `project_id` ("boss rules") can trigger new project creation
- Board update uses rules to scan and import emails

### 6. Calendar Management
**What**: Local calendar with Google Calendar sync.

**Features**:
- Create/update/delete events with date, time, all-day, recurrence
- Bidirectional Google Calendar sync (push local changes, pull remote changes)
- Events linked to projects
- Calendar-aware daily summary

**Key files**:
- `backend/src/routes/calendar.js` - CRUD + sync endpoint
- `mobile/src/screens/CalendarScreen.tsx` - Day-grouped event list

### 7. File Attachments
**What**: File uploads stored in Supabase Storage, linked to tasks or projects.

**Features**:
- Upload files (max 10MB) to tasks or projects
- Signed download URLs (1 hour validity)
- Google Drive integration for project-level files

**Key files**:
- `backend/src/routes/attachments.js` - Upload/download/delete (Supabase Storage)
- `backend/src/routes/drive.js` - Google Drive operations

### 8. Housekeeping / Health Check
**What**: Automated analysis of project health.

**Checks**: Overdue tasks, stale projects, tasks missing priorities, past calendar events, upcoming deadlines (48h window)

**Key files**:
- `backend/src/routes/housekeeping.js` - GET /api/v1/housekeeping
- `mobile/src/screens/SettingsScreen.tsx` - Health check modal

### 9. Voice Input (WebSocket)
**What**: Real-time speech-to-text via Deepgram streaming WebSocket.

**How it works**:
1. Mobile connects WebSocket to `ws://host:3000/voice/stream?token=JWT`
2. Audio chunks streamed to Deepgram
3. Final transcripts processed as text commands through AI pipeline
4. Also supports text_command messages (bypasses STT)

**Key files**:
- `backend/src/services/voice/voiceStreamRouter.js` - WebSocket handler
- `backend/src/services/voice/voiceSession.js` - Session management
- `backend/src/services/voice/deepgramClient.js` - Deepgram API
- `mobile/src/components/AiInputBar.tsx` - Text input (primary)
- `mobile/src/components/VoiceOverlay.tsx` - Voice modal (legacy)

### 10. Meeting Notes (Partial)
**What**: Record meetings, transcribe with Deepgram, summarize with AI.

**Status**: Backend complete, frontend is placeholder screen.

**Key files**:
- `backend/src/routes/meeting-notes.js` - CRUD + summarize endpoint
- `backend/src/services/voice/meetingTranscriber.js` - Batch transcription
- `backend/src/services/logicAi/meetingSummarizer.js` - AI summarization

---

## Database Schema (Supabase PostgreSQL)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `projects` | User projects | id, user_id, title, description, status ('active'/'archived'), drive_folder_id |
| `tasks` | Project tasks | id, title, description, status, priority, due_date, project_id (FK), parent_task_id, position, tags TEXT[] |
| `templates` | Project templates | id, title, is_system, template_data JSONB |
| `meeting_notes` | Meeting recordings | id, user_id, audio_url, transcript, summary, status |
| `action_items` | Meeting action items | id, meeting_note_id, title, accepted |
| `calendar_events` | Calendar events | id, user_id, title, start_time TIMESTAMPTZ, end_time, all_day, recurrence, project_id, google_event_id |
| `attachments` | File attachments | id, user_id, task_id, project_id, file_name, storage_path |
| `google_integrations` | Google OAuth tokens | id, user_id, google_access_token, google_refresh_token, token_expiry, last_email_sync, scopes |
| `email_rules` | Email filter rules | id, user_id, rule_name, sender_filter, label_filter, project_id (nullable = boss rule) |
| `imported_emails` | Cached Gmail emails | id, user_id, gmail_message_id, subject, sender, body_text, project_id, received_at |
| `board_updates` | Board update history | id, user_id, trigger, summary, suggested_actions JSONB, email_data, drive_data, calendar_data, housekeeping_data |

**Important schema notes**:
- `tasks` does NOT have `user_id` — scoped via `project_id` -> `projects.user_id`
- `projects` uses `status` ('active'/'archived'), not a boolean `archived` column
- `imported_emails` uses `sender` (not `sender_email`), `labels TEXT[]` (not `label`)
- `email_rules` without `project_id` = "boss" rules (can trigger new project creation)

---

## Mobile App Structure

```
mobile/
  src/
    screens/
      LoginScreen.tsx          — Email/password auth
      DashboardScreen.tsx      — Board updates, suggestions, projects overview
      TasksScreen.tsx          — Collapsible task list, daily summary, AI edit
      ProjectsScreen.tsx       — Project list with templates
      ProjectDetailScreen.tsx  — 3-tab detail (Tasks | Files | Emails)
      CalendarScreen.tsx       — Day-grouped events, Google sync
      SettingsScreen.tsx       — Health check, cache, sign out
      GoogleSettingsScreen.tsx — Google OAuth connect/status
      GmailSettingsScreen.tsx  — Email rules management
      MeetingNotesScreen.tsx   — Placeholder
    components/
      AiInputBar.tsx           — Inline AI text input + response card
      VoiceOverlay.tsx         — Full-screen voice modal (legacy)
      SmoothStreamLogo.tsx     — Custom logo
    navigation/
      RootNavigator.tsx        — Auth-gated stack (Login vs MainTabs)
      TabNavigator.tsx         — Bottom tabs: Dashboard, Tasks, AI, Calendar, Settings
    services/
      api.ts                   — All API functions (base URL: http://127.0.0.1:3000/api/v1)
    theme/
      colors.ts                — iOS-style color palette (primary #007AFF)
      typography.ts            — Font sizes (h1: 34, h2: 28, body: 17, caption: 13)
    lib/
      supabase.ts              — Supabase client singleton
```

**Key dependencies**: expo ~55, react-native 0.83, @react-navigation 7.x, @supabase/supabase-js 2.x, lucide-react-native (icons)

---

## Backend Structure

```
backend/
  server.js                    — Entry point, Express + WebSocket setup
  src/
    routes/
      projects.js              — Project CRUD (6 endpoints)
      tasks.js                 — Task CRUD + daily summary + AI edit (8 endpoints)
      templates.js             — Template listing (2 endpoints)
      meeting-notes.js         — Meeting notes CRUD + summarize (4 endpoints)
      calendar.js              — Calendar CRUD + sync (6 endpoints)
      housekeeping.js          — Health check (1 endpoint)
      attachments.js           — File upload/download (4 endpoints)
      gmail.js                 — Gmail OAuth + email rules (8 endpoints)
      google.js                — Unified Google OAuth (4 endpoints)
      drive.js                 — Google Drive files (4 endpoints)
      board-update.js          — Board update trigger/history/apply (3 endpoints)
    services/
      logicAi/                 — AI intent parsing (Gemini) + execution
      boardEngine/             — Compound board update orchestration
      gmail/                   — Gmail API wrapper
      google/                  — Google OAuth + Calendar + Drive
      voice/                   — Deepgram STT + WebSocket sessions
    middleware/
      auth.js                  — JWT verification middleware
    lib/
      supabase.js              — Supabase client singleton
  scripts/
    check-and-migrate.js       — Schema migration checker
    reset-demo.js              — Reset all demo data for fresh run
```

**Key dependencies**: express 4.x, @google/generative-ai 0.21, @supabase/supabase-js 2.x, googleapis 144.x, ws 8.x, jsonwebtoken 9.x, multer 1.4

---

## Environment Variables (backend/.env)

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default 3000) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_JWT_SECRET` | JWT verification (optional) |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |
| `GOOGLE_REDIRECT_URI` | OAuth2 callback URL |
| `GEMINI_API_KEY` | Google Generative AI API key |
| `DEEPGRAM_API_KEY` | Deepgram STT API key |

---

## Authentication Flow

1. User signs up / signs in via Supabase Auth (email + password)
2. Supabase returns JWT (ES256 signed)
3. Mobile stores session via AsyncStorage
4. Every API request includes `Authorization: Bearer <JWT>`
5. Backend decodes JWT with `jwt.decode()` to extract `sub` (user ID)
6. Google OAuth is separate: user connects via Settings > Google Account

---

## Testing

**78 integration tests** (Jest + Supertest against live Supabase):

| Test File | Count | Coverage |
|-----------|-------|----------|
| `projects.test.js` | 16 | CRUD + archive + restore + hard-delete |
| `tasks.test.js` | 14 | CRUD + subtasks + filters |
| `calendar.test.js` | 14 | Date-range filters, all-day events |
| `housekeeping.test.js` | 5 | Board health checks |
| `intent-executor.test.js` | 13 | AI intent execution |
| `voice-websocket.test.js` | 3 | WebSocket protocol |
| `templates.test.js` | Various | Template listing |
| `meeting-notes.test.js` | Various | Meeting note CRUD |

**Run tests**: `cd backend && npm test`

**Test user**: `testuser2@gmail.com` / `TestPassword123` (user ID: `ba8eab5c-51ef-4911-b5d0-177910965a5b`)

---

## Demo Setup

**Persona**: Dr. Alex Chen, Research Analyst managing 3 PI projects

**Email accounts** (3 PIs):
- Dr. Sarah Mitchell: `sarahchendr@gmail.com`
- Dr. James Park: `jamesparkprof26@yahoo.com`
- Dr. Priya Sharma: `priyasharma1101@hotmail.com`

**Reset for demo**:
```bash
cd backend && node scripts/reset-demo.js
```
This clears: imported_emails, board_updates, projects, tasks, and resets last_email_sync.

**Demo flow**:
1. Open app (empty state)
2. Tap "Update Board" on Dashboard
3. AI scans Gmail, finds emails from PIs, suggests creating projects + tasks
4. User reviews and accepts suggestions
5. Projects and tasks appear in the app
6. User can interact via AI text input ("Mark X as done", "What's on my calendar?", etc.)

---

## Deployment

**Current state**: Local development only
- Backend: `cd backend && node server.js` (or `npm run dev` for watch mode)
- Mobile: `cd mobile && npx expo start --ios`
- No Docker, CI/CD, or cloud deployment configured
- Backend runs on localhost:3000, mobile connects to 127.0.0.1:3000

---

## Multi-Agent Development Model

The project was built using a 10-agent coordination system where each agent has a dedicated mailbox folder:

| Agent | Folder | Role |
|-------|--------|------|
| Project Manager | `project_manager/` | Central coordination, status tracking |
| Architecture Designer | `architecture_designer/` | System design, API contracts |
| Backend Engineer | `backend_engineer/` | Express API, services, integrations |
| Frontend Engineer | `frontend_engineer/` | React Native screens, components |
| Logic AI Designer | `logic_ai_designer/` | Gemini prompts, intent system |
| Voice AI Engineer | `voice_ai_engineer/` | Deepgram STT, WebSocket |
| Test Engineer | `test_engineer/` | Integration tests, demo scenarios |
| UX Designer | `ux_designer/` | UI/UX design specifications |
| Documentation Engineer | `documentation_engineer/` | Docs and specs |
| Senior Engineer | `senior_engineer/` | Code review, version control |

Agents communicate via markdown inbox files. Each writes to `project_manager/inbox_from_[role].md`.

---

## Key Documents

| File | Purpose |
|------|---------|
| `PROJECT_BLUEPRINT.md` | Complete architecture and rebuild guide (27 KB) |
| `communication_protocol.md` | Multi-agent workflow rules |
| `hackathon_app.pdf` | 19-page presentation slides |
| `test_engineer/DEMO_SCENARIO.md` | Demo walkthrough script |
| `backend_engineer/api_contracts.md` | REST API endpoint specs |
| `architecture_designer/GOOGLE_INTEGRATION_ARCHITECTURE.md` | v2 Google design |
