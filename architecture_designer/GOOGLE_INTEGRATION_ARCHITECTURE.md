# Personal Bot v2 -- Deep Google Integration Architecture & UX Plan

**Authors:** Architecture Designer + UX Designer
**Date:** 2026-03-07
**Status:** Proposed redesign

---

## Executive Summary

Personal Bot v1 is a voice-driven task/project manager with basic Gmail read-only integration. **v2 transforms it into a Google-native productivity hub** where every project is backed by a Google Drive folder, every event syncs bidirectionally with Google Calendar, and Gmail becomes a first-class input channel -- not just a read-only feed.

The core insight: **a "board update" becomes a compound operation** that pulls emails, reads Drive files, syncs calendar events, and produces an AI-synthesized status report -- all triggered by a single voice command or button press.

---

## 1. What Changes (v1 vs v2)

| Capability | v1 (Current) | v2 (Proposed) |
|---|---|---|
| Gmail | Read-only import, manual sync | Read + send drafts, auto-sync rules, email-to-task pipeline |
| Google Calendar | Local-only calendar_events table | **Bidirectional sync** with Google Calendar API |
| Google Drive | None | Per-project Drive folders, file upload/download, AI reads docs for context |
| Board Update | Manual housekeeping check | **Automated compound operation**: Gmail scan + Drive scan + Calendar sync + AI summary |
| OAuth Scope | `gmail.readonly`, `userinfo.email` | `gmail.readonly`, `gmail.send`, `calendar`, `drive.file`, `userinfo.email` |
| AI Functions | 14 intents | 20 intents (+ Drive ops, Calendar sync, Board Update, Draft email) |
| Attachments | Supabase Storage only | Supabase Storage + Google Drive (dual storage) |

---

## 2. Architecture Overview (v2)

```
+------------------+         +------------------+         +------------------+
|   iOS App        |  REST   |   Express.js     |  SQL    |   Supabase       |
|   (Expo/RN)      |-------->|   Backend        |-------->|   (PostgreSQL)   |
|                  |         |   Port 3000      |         |   + Storage      |
|  - 5 tab screens |  WS     |                  |  REST   |   + Auth         |
|  - VoiceOverlay  |-------->|  - Voice WS      |-------->|                  |
|  - Google Hub    |         |  - Deepgram STT  |         +------------------+
+------------------+         |  - Gemini AI     |
                             |  - Board Engine  |         +------------------+
                             |                  |-------->|   Google APIs    |
                             +------------------+         |                  |
                                                          |  - Gmail API     |
                                                          |  - Calendar API  |
                                                          |  - Drive API     |
                                                          +------------------+
                                                          +------------------+
                                                          |   Deepgram STT   |
                                                          +------------------+
                                                          +------------------+
                                                          |   Gemini 2.5     |
                                                          |   Flash          |
                                                          +------------------+
```

### New Backend Services

```
backend/src/services/
    google/
        googleAuthClient.js      # Unified OAuth2 client (replaces gmail-only OAuth)
        gmailService.js          # Gmail read + draft/send (replaces gmailClient.js)
        calendarSyncService.js   # Bidirectional Google Calendar sync
        driveService.js          # Drive folder management, file CRUD, content reading
    boardEngine/
        boardUpdateEngine.js     # Orchestrates compound board updates
        boardSummaryGenerator.js # AI-powered summary from all sources
```

---

## 3. Google OAuth Strategy (Unified)

### Single OAuth Flow, Expanded Scopes

Instead of separate OAuth flows per service, one unified Google sign-in covers all services.

```
Scopes requested:
  - https://www.googleapis.com/auth/gmail.readonly      (read emails)
  - https://www.googleapis.com/auth/gmail.send           (send drafts)
  - https://www.googleapis.com/auth/calendar             (read + write calendar)
  - https://www.googleapis.com/auth/drive.file           (manage files created by app)
  - https://www.googleapis.com/auth/userinfo.email       (user identity)
```

**Why `drive.file` not `drive`:** `drive.file` only grants access to files/folders the app creates. This is safer (principle of least privilege) and easier to get approved by Google. Users can still share existing Drive files into app-created folders.

### Token Storage (Updated Schema)

```sql
-- Replaces email_integrations
google_integrations (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  google_access_token TEXT NOT NULL,
  google_refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  gmail_address TEXT,
  scopes TEXT[],                          -- Track granted scopes
  calendar_sync_token TEXT,               -- Google Calendar incremental sync token
  drive_root_folder_id TEXT,              -- Root "Personal Bot" folder in Drive
  last_calendar_sync TIMESTAMPTZ,
  last_email_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)
```

---

## 4. Google Drive Integration

### Concept: Every Project Gets a Drive Folder

When a user creates a project, the backend automatically creates a corresponding Google Drive folder inside a root "Personal Bot" folder. Files attached to the project live in both Supabase Storage (for offline/fast access) and Google Drive (for sharing/collaboration).

```
Google Drive/
  Personal Bot/                          <-- Root folder (created on first connect)
    My App/                              <-- Per-project folder
      design-spec.pdf
      meeting-notes-2026-03-05.md
    Marketing Campaign Q2/
      campaign-brief.docx
      budget.xlsx
```

### Drive Data Flow

```
User says "Upload the design spec to my app project"
    |
    v
Gemini returns: { name: "upload_to_drive", args: { projectId, fileName } }
    |
    v
IntentExecutor:
    1. Gets project's drive_folder_id from DB
    2. Uploads file to Google Drive folder
    3. Creates attachment record in Supabase (with drive_file_id)
    4. Returns success with Drive link
```

```
Board Update triggers Drive scan:
    1. Lists all files in project's Drive folder
    2. For Google Docs/Sheets: reads content via export API
    3. Feeds file summaries to Gemini as project context
    4. AI reports: "3 new files added to Marketing Campaign since last check"
```

### Schema Addition

```sql
-- Extended projects table
ALTER TABLE projects ADD COLUMN drive_folder_id TEXT;
ALTER TABLE projects ADD COLUMN drive_folder_url TEXT;

-- Extended attachments table
ALTER TABLE attachments ADD COLUMN drive_file_id TEXT;
ALTER TABLE attachments ADD COLUMN drive_url TEXT;
ALTER TABLE attachments ADD COLUMN source TEXT DEFAULT 'upload'
  CHECK (source IN ('upload', 'drive', 'email'));
```

---

## 5. Google Calendar Bidirectional Sync

### Current Problem
v1 stores events only in `calendar_events` table. They don't appear in the user's actual Google Calendar, and external calendar events are invisible to the app.

### v2 Solution: Two-Way Sync

```
                    +-------------------+
                    |  calendar_events  |
                    |  (Supabase)       |
                    +--------+----------+
                             |
                      Sync Engine
                     (calendarSyncService)
                             |
                    +--------+----------+
                    | Google Calendar   |
                    | (user's calendar) |
                    +-------------------+
```

**Sync rules:**
1. **App -> Google:** When user creates/updates/deletes an event via voice or UI, push to Google Calendar API.
2. **Google -> App:** On board update or manual sync, pull new/changed events using incremental sync (`syncToken`). Insert/update `calendar_events` with `google_event_id`.
3. **Conflict resolution:** Last-write-wins with `updated_at` comparison. Google Calendar is source of truth for externally-created events.

### Schema Addition

```sql
ALTER TABLE calendar_events ADD COLUMN google_event_id TEXT;
ALTER TABLE calendar_events ADD COLUMN google_calendar_id TEXT DEFAULT 'primary';
ALTER TABLE calendar_events ADD COLUMN sync_status TEXT DEFAULT 'local'
  CHECK (sync_status IN ('local', 'synced', 'conflict'));
ALTER TABLE calendar_events ADD COLUMN last_synced_at TIMESTAMPTZ;
```

---

## 6. The Board Update Engine

This is the centerpiece of v2. A **board update** is a compound operation that answers: "What's going on across all my projects right now?"

### Trigger Methods
1. **Voice:** "Update my board" / "What's new?" / "Give me a status update"
2. **UI Button:** Dedicated button on Projects screen or Settings
3. **Scheduled:** Optional background job (future: push notifications)

### Board Update Pipeline

```
Trigger: "Update my board"
    |
    v
[1. EMAIL SCAN]
    - Fetch new emails matching user's rules (since last sync)
    - Upsert into imported_emails
    - Tag emails by project (AI matches sender/subject to projects)
    - Output: { newEmails: 5, byProject: { "My App": 2, "Marketing": 3 } }
    |
    v
[2. DRIVE SCAN]
    - For each active project with drive_folder_id:
      - List files modified since last board update
      - For Google Docs/Sheets: fetch content summary (first 500 chars)
    - Output: { modifiedFiles: 3, newFiles: 1, byProject: { ... } }
    |
    v
[3. CALENDAR SYNC]
    - Pull events from Google Calendar (incremental sync)
    - Upsert into calendar_events
    - Identify: upcoming (next 48h), conflicts, past-unresolved
    - Output: { synced: 12, upcoming: 3, conflicts: 0 }
    |
    v
[4. HOUSEKEEPING ANALYSIS]
    - Existing v1 logic: overdue tasks, stale projects, untriaged, etc.
    - Output: { overdue: 2, stale: 1, untriaged: 4 }
    |
    v
[5. AI SYNTHESIS]
    - Feed all outputs to Gemini with board-update system prompt
    - Gemini produces a structured, conversational summary:

    "Board Update Complete. Here's what's happening:

     My App:
       - 2 new emails from client@company.com (re: launch timeline)
       - design-spec.pdf was updated in Drive 2 hours ago
       - 'Fix login bug' is overdue by 2 days
       - Meeting with dev team tomorrow at 10am

     Marketing Campaign Q2:
       - 3 emails from agency (re: ad creative review)
       - New file: campaign-metrics.xlsx added to Drive
       - No overdue tasks, looking healthy

     Action items I'd suggest:
       1. Review the updated design spec
       2. Respond to client about launch timeline
       3. Mark 'Fix login bug' as in-progress or update due date"
    |
    v
[6. DELIVER]
    - Voice: Read summary via VoiceOverlay response card
    - UI: Render in BoardUpdateModal with expandable sections
    - Store: Save board update snapshot for history
```

### Schema Addition

```sql
board_updates (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  trigger TEXT NOT NULL CHECK (trigger IN ('voice', 'manual', 'scheduled')),
  summary TEXT,                          -- AI-generated summary
  email_data JSONB,                      -- Snapshot of email scan results
  drive_data JSONB,                      -- Snapshot of drive scan results
  calendar_data JSONB,                   -- Snapshot of calendar sync results
  housekeeping_data JSONB,               -- Snapshot of housekeeping results
  created_at TIMESTAMPTZ DEFAULT now()
)
```

---

## 7. Updated AI Intent System (20 Functions)

### New Function Declarations (6 additions)

| # | Function | Purpose | Key Params |
|---|---|---|---|
| 15 | `sync_calendar` | Trigger Google Calendar sync | direction: 'pull' \| 'push' \| 'both' |
| 16 | `run_board_update` | Trigger full board update | projectId (optional, for single-project focus) |
| 17 | `upload_to_drive` | Upload file to project's Drive folder | projectId, fileName |
| 18 | `list_drive_files` | List files in project's Drive folder | projectId |
| 19 | `read_drive_file` | Get content/summary of a Drive file | fileId or fileName + projectId |
| 20 | `draft_email` | Create a Gmail draft (reply or new) | to, subject, body, replyToEmailId (optional) |

### Updated System Instruction Additions

```
You are also aware of the user's Google ecosystem:
- Their Google Calendar events are synced. When they say "schedule a meeting",
  create it both locally AND on Google Calendar.
- Each project may have a Google Drive folder. When they mention files or documents,
  check the project's Drive folder first.
- When they say "update my board" or "what's new", trigger run_board_update
  which scans emails, Drive, calendar, and tasks holistically.
- When they say "draft a reply to that email", use draft_email to compose
  a Gmail draft they can review before sending.
- Never send an email directly -- always create a draft. The user must
  explicitly confirm sending.
```

### Updated Context Object

```json
{
  "userId": "uuid",
  "today": "Saturday, March 7, 2026",
  "googleConnected": true,
  "projects": [
    {
      "id": "uuid",
      "title": "My App",
      "driveFolderId": "abc123",
      "driveFiles": [
        { "name": "design-spec.pdf", "modifiedTime": "2026-03-07T14:00:00Z" }
      ],
      "pendingTasks": 3,
      "tasks": [...]
    }
  ],
  "upcomingEvents": [
    {
      "id": "uuid",
      "title": "Team Standup",
      "start_time": "2026-03-08T10:00:00Z",
      "source": "google_calendar",
      "googleEventId": "gcal_abc"
    }
  ],
  "recentEmails": [...],
  "lastBoardUpdate": "2026-03-07T08:00:00Z",
  "conversationHistory": "..."
}
```

---

## 8. Updated Backend API

### New Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /google/auth-url | Unified Google OAuth URL (all scopes) |
| GET | /google/callback | OAuth callback, stores tokens |
| GET | /google/status | Connection status + granted scopes |
| DELETE | /google/disconnect | Revoke tokens, clean up |
| POST | /board-update | Trigger full board update |
| GET | /board-update/history | Past board update summaries |
| GET | /drive/files/:projectId | List files in project Drive folder |
| POST | /drive/upload/:projectId | Upload file to project Drive folder |
| GET | /drive/download/:fileId | Download/export file from Drive |
| DELETE | /drive/files/:fileId | Remove file from Drive |
| POST | /calendar/sync | Trigger calendar sync |
| GET | /calendar/sync/status | Last sync time + stats |

### Deprecated Endpoints (replaced)

| Old | Replaced By |
|---|---|
| GET /gmail/auth-url | GET /google/auth-url |
| GET /gmail/callback | GET /google/callback |
| GET /gmail/status | GET /google/status |

Gmail-specific endpoints (`/gmail/emails`, `/gmail/rules`, `/gmail/sync`) remain but are now sub-features of the unified Google integration.

---

## 9. Updated File Structure

```
backend/src/
    routes/
        projects.js              # Updated: creates Drive folder on project create
        tasks.js
        templates.js
        meeting-notes.js
        calendar.js              # Updated: pushes to Google Calendar on write
        housekeeping.js
        attachments.js           # Updated: dual-writes to Drive + Supabase
        gmail.js                 # Kept: email rules + imported emails
        google.js                # NEW: unified OAuth + status + disconnect
        board-update.js          # NEW: board update trigger + history
        drive.js                 # NEW: Drive file CRUD
    services/
        google/
            googleAuthClient.js      # NEW: unified OAuth2 (replaces gmail OAuth)
            gmailService.js          # REFACTORED from gmailClient.js
            calendarSyncService.js   # NEW: bidirectional calendar sync
            driveService.js          # NEW: Drive folder/file operations
        boardEngine/
            boardUpdateEngine.js     # NEW: orchestrates compound updates
            boardSummaryGenerator.js # NEW: AI summary generation
        logicAi/
            geminiClient.js          # UPDATED: 20 function declarations
            intentExecutor.js        # UPDATED: handles new intents
            voiceCommandHandler.js   # UPDATED: richer context building
            meetingSummarizer.js
        voice/
            (unchanged)
```

---

## 10. UX Redesign

### Navigation (Updated)

```
RootNavigator (Native Stack)
  |
  |-- [Not authenticated] --> LoginScreen
  |
  |-- [Authenticated] -->
        |-- MainTabs (Bottom Tab Navigator)
        |     |-- Dashboard tab (NEW: replaces Projects as home)
        |     |-- Tasks tab (TasksScreen)
        |     |-- Voice FAB (VoiceOverlay trigger)
        |     |-- Calendar tab (CalendarScreen)
        |     |-- Settings tab (SettingsScreen)
        |
        |-- ProjectDetail (pushed from Dashboard)
        |-- ProjectFiles (pushed from ProjectDetail - Drive files)
        |-- GoogleSettings (pushed from Settings - replaces GmailSettings)
        |-- BoardUpdateDetail (pushed from Dashboard - full update report)
```

### Screen Changes

#### NEW: DashboardScreen (replaces ProjectsScreen as Tab 1)

The dashboard is the **command center**. It answers "what do I need to know right now?" at a glance.

```
+------------------------------------------+
|  Dashboard                    [Update]   |
+------------------------------------------+
|                                          |
|  BOARD STATUS              Last: 2h ago  |
|  +------------------------------------+  |
|  |  3 emails need attention           |  |
|  |  2 overdue tasks                   |  |
|  |  Meeting in 1h: Team Standup       |  |
|  |  1 new file in "My App" Drive      |  |
|  +------------------------------------+  |
|                                          |
|  PROJECTS                          +Add  |
|  +------------------------------------+  |
|  |  My App                     3/8    |  |
|  |  Google Drive: 4 files             |  |
|  |  Last email: 2h ago               |  |
|  +------------------------------------+  |
|  +------------------------------------+  |
|  |  Marketing Campaign Q2     5/12   |  |
|  |  Google Drive: 7 files             |  |
|  |  No recent emails                  |  |
|  +------------------------------------+  |
|                                          |
|  UPCOMING                                |
|  +------------------------------------+  |
|  |  10:00  Team Standup        [GCal] |  |
|  |  14:00  Client Call         [GCal] |  |
|  |  Due:   Fix login bug       [!]    |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
|  [Dashboard] [Tasks] [MIC] [Cal] [Set]  |
+------------------------------------------+
```

**Key elements:**
- **Board Status Card:** Summary from last board update. Tap to see full report. Shows time since last update.
- **[Update] Button:** Top-right, triggers a full board update. Shows spinner during update, then refreshes the card.
- **Project Cards:** Each shows task progress, Drive file count, last email activity. Tap -> ProjectDetail.
- **Upcoming Strip:** Next 48h of calendar events (from Google Calendar) + approaching due dates. [GCal] badge indicates synced events.

#### UPDATED: ProjectDetailScreen

```
+------------------------------------------+
|  < My App                     [...]     |
+------------------------------------------+
|  [Tasks]  [Files]  [Emails]             |
+------------------------------------------+
|                                          |
|  TASKS (active tab)                      |
|  +------------------------------------+  |
|  |  [ ] Fix login bug        HIGH  !  |  |
|  |  [ ] Add dark mode        MED      |  |
|  |  [x] Setup CI pipeline    DONE     |  |
|  +------------------------------------+  |
|  Progress: ========----  62%            |
|                                 [+ Task] |
|                                          |
+------------------------------------------+
```

```
+------------------------------------------+
|  < My App                     [...]     |
+------------------------------------------+
|  [Tasks]  [Files]  [Emails]             |
+------------------------------------------+
|                                          |
|  FILES (Google Drive)                    |
|  +------------------------------------+  |
|  |  design-spec.pdf       Modified 2h |  |
|  |  api-docs.md           Modified 1d |  |
|  |  wireframes.fig        Modified 3d |  |
|  +------------------------------------+  |
|                          [Upload] [Open] |
|                                          |
|  ATTACHMENTS (Local)                     |
|  +------------------------------------+  |
|  |  screenshot.png         3.2 MB     |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
```

```
+------------------------------------------+
|  < My App                     [...]     |
+------------------------------------------+
|  [Tasks]  [Files]  [Emails]             |
+------------------------------------------+
|                                          |
|  RELATED EMAILS                          |
|  +------------------------------------+  |
|  |  From: client@co.com     2h ago    |  |
|  |  Re: Launch timeline               |  |
|  |  "Can we push to next week..."     |  |
|  |           [Create Task] [Draft Reply]|  |
|  +------------------------------------+  |
|  +------------------------------------+  |
|  |  From: designer@co.com   1d ago    |  |
|  |  Updated mockups                    |  |
|  |  "Attached the new login flow..."  |  |
|  |           [Create Task] [Draft Reply]|  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
```

**Key changes:**
- **Tab strip** within project: Tasks | Files | Emails
- **Files tab:** Shows Google Drive files for this project. Upload button pushes to Drive. Tap file to open/preview.
- **Emails tab:** Shows imported emails AI-matched to this project. Quick actions: Create Task, Draft Reply.

#### UPDATED: CalendarScreen

```
+------------------------------------------+
|  Calendar                [Sync] [+]     |
+------------------------------------------+
|                                          |
|  TODAY - Saturday, Mar 7                 |
|  +------------------------------------+  |
|  |  10:00-11:00  Team Standup  [GCal] |  |
|  |  My App project                     |  |
|  +------------------------------------+  |
|  +------------------------------------+  |
|  |  14:00-15:00  Client Call   [GCal] |  |
|  |  External (no project)              |  |
|  +------------------------------------+  |
|                                          |
|  TOMORROW - Sunday, Mar 8                |
|  +------------------------------------+  |
|  |  All Day  Sprint Planning   [App]  |  |
|  |  My App project                     |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
```

**Key changes:**
- **[Sync] button:** Triggers calendar sync. Shows last sync time.
- **[GCal] / [App] badges:** Indicates whether event originated from Google Calendar or was created in-app.
- **Creating an event** now pushes to Google Calendar automatically.
- **External events** (from Google Calendar, no project match) show with "External" label.

#### UPDATED: SettingsScreen

```
+------------------------------------------+
|  Settings                                |
+------------------------------------------+
|                                          |
|  GOOGLE INTEGRATION                      |
|  +------------------------------------+  |
|  |  Google Account                    >|  |
|  |  Connected: charles@gmail.com       |  |
|  |  Gmail - Calendar - Drive           |  |
|  +------------------------------------+  |
|                                          |
|  BOARD                                   |
|  +------------------------------------+  |
|  |  Board Health Check                >|  |
|  |  Board Update History              >|  |
|  +------------------------------------+  |
|                                          |
|  EMAIL RULES                             |
|  +------------------------------------+  |
|  |  Manage Email Rules                >|  |
|  +------------------------------------+  |
|                                          |
|  APP                                     |
|  +------------------------------------+  |
|  |  Storage & Cache          12.4 MB  >|  |
|  |  Sign Out                          >|  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
```

#### NEW: GoogleSettingsScreen (replaces GmailSettingsScreen)

```
+------------------------------------------+
|  < Google Account                        |
+------------------------------------------+
|                                          |
|  charles@gmail.com          [Disconnect] |
|                                          |
|  CONNECTED SERVICES                      |
|  +------------------------------------+  |
|  |  Gmail          Connected     [i]  |  |
|  |  Calendar       Connected     [i]  |  |
|  |  Drive          Connected     [i]  |  |
|  +------------------------------------+  |
|                                          |
|  SYNC STATUS                             |
|  +------------------------------------+  |
|  |  Last email sync:    5 min ago     |  |
|  |  Last calendar sync: 12 min ago    |  |
|  |  Last Drive scan:    1 hour ago    |  |
|  |                                    |  |
|  |  Drive root folder:               |  |
|  |  Personal Bot/  (4 project folders)|  |
|  +------------------------------------+  |
|                                          |
|  AUTO-SYNC (Future)                      |
|  +------------------------------------+  |
|  |  Background sync       OFF        |  |
|  |  Sync interval         --         |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
```

### VoiceOverlay Updates

New voice command examples the AI handles:

| Voice Command | AI Function | Result |
|---|---|---|
| "Update my board" | `run_board_update` | Full compound update + summary |
| "What's new in my marketing project?" | `run_board_update(projectId)` | Single-project focused update |
| "Upload this to the app project" | `upload_to_drive(projectId)` | Prompts for file picker, uploads to Drive |
| "What files are in my marketing Drive?" | `list_drive_files(projectId)` | Lists Drive folder contents |
| "Read the design spec" | `read_drive_file(fileName, projectId)` | Fetches and summarizes doc content |
| "Draft a reply saying we'll push to next week" | `draft_email(replyToEmailId, body)` | Creates Gmail draft |
| "Sync my calendar" | `sync_calendar(direction: 'both')` | Pulls + pushes calendar events |
| "Schedule a meeting tomorrow at 2pm" | `create_event(...)` | Creates locally AND on Google Calendar |

### Board Update UX Flow (Voice)

```
User: "Update my board"
    |
    v
VoiceOverlay: Processing state with progress steps
    |  "Scanning emails..."        [1/4]
    |  "Checking Drive files..."   [2/4]
    |  "Syncing calendar..."       [3/4]
    |  "Generating summary..."     [4/4]
    |
    v
VoiceOverlay: Response card (scrollable)
    |
    |  "Board updated! Here's your status:
    |
    |   My App: 2 new emails, design spec
    |   updated in Drive, login bug overdue.
    |
    |   Marketing: 3 new emails from agency,
    |   new metrics spreadsheet in Drive.
    |
    |   Calendar: Team standup in 1 hour,
    |   client call at 2pm.
    |
    |   Suggested actions:
    |   [Review design spec]
    |   [Reply to client email]
    |   [Update login bug status]"
    |
    v
User can tap suggested actions or speak follow-up
```

### Board Update UX Flow (Manual/Button)

```
User taps [Update] on Dashboard
    |
    v
Dashboard: Board Status Card shows shimmer/skeleton loading
    Progress bar: "Scanning emails..."
    |
    v
Board Status Card updates with new summary
    Expandable sections:
    - Emails (tap to see list)
    - Drive Changes (tap to see files)
    - Calendar (tap to see events)
    - Task Health (tap to see issues)
    |
    v
[View Full Report] button at bottom -> BoardUpdateDetailScreen
```

---

## 11. Data Flow: Board Update Sequence Diagram

```
Mobile                  Backend                 Gmail API    Drive API    Calendar API
  |                       |                        |            |            |
  |-- POST /board-update->|                        |            |            |
  |                       |                        |            |            |
  |                       |--fetch new emails----->|            |            |
  |                       |<--email list-----------|            |            |
  |                       |                        |            |            |
  |                       |--list files per project------------>|            |
  |                       |<--file metadata/content-------------|            |
  |                       |                        |            |            |
  |                       |--incremental sync (syncToken)------------------>|
  |                       |<--new/changed events-----------------------------|
  |                       |                        |            |            |
  |                       |--[internal] run housekeeping queries             |
  |                       |                        |            |            |
  |                       |--Gemini: synthesize all data                     |
  |                       |<-structured summary                              |
  |                       |                        |            |            |
  |<-- { summary, emailData, driveData, calendarData, housekeepingData } ----|
  |                       |                        |            |            |
  |  Render Dashboard     |                        |            |            |
```

---

## 12. Calendar Sync Sequence

```
CREATE EVENT (App -> Google):
  1. User creates event via voice or UI
  2. Backend inserts into calendar_events (sync_status: 'local')
  3. Backend calls Google Calendar API: events.insert()
  4. Stores google_event_id, updates sync_status: 'synced'

PULL SYNC (Google -> App):
  1. Backend calls events.list(syncToken) or events.list(timeMin, timeMax)
  2. For each event:
     a. If google_event_id exists in calendar_events -> update fields
     b. If not -> insert new row (source: 'google_calendar')
  3. Store new syncToken for next incremental pull

CONFLICT: If same event modified in both places since last sync,
  compare updated_at vs Google's updated timestamp.
  Most recent wins. Flag as 'conflict' if within 1 minute of each other.
```

---

## 13. Migration Path from v1

### Phase 1: Unified Google OAuth (Week 1)
1. Create `google_integrations` table (replaces `email_integrations`)
2. Build `googleAuthClient.js` with expanded scopes
3. Migrate existing Gmail OAuth tokens to new table
4. Update `google.js` route (replaces gmail OAuth endpoints)
5. Keep existing gmail.js routes working (they now use unified token)

### Phase 2: Google Calendar Sync (Week 1-2)
1. Add `google_event_id`, `sync_status` columns to `calendar_events`
2. Build `calendarSyncService.js`
3. Update `calendar.js` route to push on create/update/delete
4. Add `/calendar/sync` endpoint
5. Update CalendarScreen UI with sync button and badges

### Phase 3: Google Drive Integration (Week 2)
1. Add `drive_folder_id` to `projects` table
2. Build `driveService.js`
3. Create Drive folders for existing projects (migration script)
4. Add `/drive/*` endpoints
5. Update ProjectDetailScreen with Files tab
6. Update `attachments.js` to dual-write

### Phase 4: Board Update Engine (Week 2-3)
1. Create `board_updates` table
2. Build `boardUpdateEngine.js` + `boardSummaryGenerator.js`
3. Add `/board-update` endpoint
4. Add 6 new Gemini function declarations
5. Build DashboardScreen
6. Update VoiceOverlay for board update flow

### Phase 5: Polish & Edge Cases (Week 3)
1. Offline handling (queue Google API calls when offline)
2. Error states (partial sync failures)
3. Rate limiting (Google API quotas)
4. Token refresh handling (automatic re-auth)

---

## 14. Key Design Decisions

1. **Drive scope is `drive.file`, not `drive`.** We only access files/folders the app creates. Users share existing files into our folders manually. This avoids the scary "access all your Drive files" consent screen.

2. **Calendar sync is incremental.** We use Google's `syncToken` to only fetch changes since last sync, not re-pull everything. This is fast and quota-friendly.

3. **Emails are never sent directly.** The `draft_email` function creates a Gmail draft. The user must review and send from Gmail. This prevents accidental sends via voice misinterpretation.

4. **Board updates are stored.** Each update creates a snapshot in `board_updates`. This lets users review past updates ("What did my board look like yesterday?") and provides training data for smarter AI summaries.

5. **Google is optional.** The app must work without Google connected. Projects still work, tasks still work, local calendar still works. Google integration enhances but doesn't gate core functionality.

6. **Dashboard replaces Projects as Tab 1.** The dashboard is the natural home screen -- it shows what matters now. Projects list moves into the dashboard as a section. This reduces cognitive load on launch.

7. **Files tab in ProjectDetail.** Rather than a separate screen, Drive files are a tab within the project. This keeps the mental model simple: a project contains tasks, files, and related emails.

8. **Single OAuth flow.** One "Connect Google" button grants all scopes at once. No per-service toggle confusion. The GoogleSettingsScreen shows what's connected and sync status.
