# Personal Bot v2 -- Demo Plan

**Purpose:** Strip the full architecture down to what creates the most impressive demo in limited time.

---

## The Hero Moment

The single most impressive thing we can show:

> User opens the app, taps a button or says **"Update my board"**, and within seconds the app pulls their real Gmail inbox, scans their Google Drive files, pulls their Google Calendar events, and an AI produces a conversational summary: "You have 3 new emails about the launch, the design spec was updated in Drive, and you have a team standup in 1 hour. I'd suggest reviewing that spec before the meeting."

**Why this wins:** It's not another task app. It's an AI assistant that actually *understands your work context* across Google services. The compound intelligence is the differentiator.

---

## Demo Script (3-4 minutes)

### Act 1: Setup (30 seconds)
- Show the app is connected to a real Google account (Settings -> Google: Connected)
- Show 2 existing projects with some tasks ("My App", "Marketing Campaign")
- Briefly show the Dashboard is currently empty/stale

### Act 2: The Board Update (60 seconds) -- THE HERO
- Tap the [Update] button on Dashboard (or say "Update my board")
- Show the progress: "Scanning emails... Checking Drive... Syncing calendar..."
- Board Status Card populates with AI summary:
  - "3 new emails about launch timeline"
  - "design-spec.pdf updated 2 hours ago in My App Drive"
  - "Team standup in 1 hour"
  - "Fix login bug is overdue by 2 days"
- Show suggested actions at the bottom

### Act 3: Voice Follow-ups (60 seconds)
- Say "Mark the login bug as in progress" -> task updates instantly
- Say "What files are in my app project?" -> lists Drive folder contents
- Say "Schedule a review meeting tomorrow at 3pm" -> creates event on Google Calendar (show it appear in both the app AND actual Google Calendar)

### Act 4: Project Drill-down (30 seconds)
- Tap into "My App" project
- Show tabs: Tasks (with the updated login bug) | Files (Drive files) | Emails (related emails)
- Quick tap through each to show the Google integration depth

### Act 5: Closing (30 seconds)
- Return to Dashboard, show the updated board status
- "Everything you just saw -- emails, files, calendar, tasks -- managed from one place, by voice."

---

## What to Build (Demo Scope)

### MUST HAVE (Critical Path)

These are the features that make or break the demo:

#### 1. Unified Google OAuth
- Single "Connect Google" flow with Gmail + Calendar + Drive scopes
- `google_integrations` table in Supabase
- `googleAuthClient.js` service (token exchange, refresh, scope management)
- `google.js` route (auth-url, callback, status, disconnect)

#### 2. Google Calendar Pull-Sync (one-way: Google -> App)
- `calendarSyncService.js` - pull events from Google Calendar into `calendar_events`
- Add `google_event_id` column to `calendar_events`
- Show [GCal] badges on synced events in CalendarScreen
- **CUT for demo:** Push-sync (App -> Google), conflict resolution, incremental syncToken
- **Simplified:** Just pull events for next 7 days on board update or manual sync

#### 3. Google Drive Read-Only Integration
- `driveService.js` - list files in a folder, read file metadata
- Add `drive_folder_id` to `projects` table
- **For demo:** Pre-create Drive folders manually, link them to projects in DB
- **CUT for demo:** Auto-creating folders on project create, uploading files, dual-write
- Just need: list files in a project's Drive folder, show them in UI

#### 4. Board Update Engine
- `boardUpdateEngine.js` - orchestrates: email scan + Drive scan + calendar pull + housekeeping
- `boardSummaryGenerator.js` - sends all data to Gemini for synthesis
- `/board-update` endpoint
- `run_board_update` Gemini function declaration
- `board_updates` table (store snapshots)

#### 5. Dashboard Screen (Tab 1)
- Board Status Card (shows last update summary, tap for detail)
- [Update] button with loading/progress states
- Project cards (task counts + Drive file count + email count)
- Upcoming strip (next 48h events)

#### 6. Updated AI (add 3 critical functions only)
- `run_board_update` - triggers compound update
- `list_drive_files` - list project Drive contents
- `sync_calendar` - trigger calendar pull
- **CUT for demo:** `upload_to_drive`, `read_drive_file`, `draft_email` (nice but not hero features)

### NICE TO HAVE (if time permits)

These make the demo smoother but aren't the hero moment:

- Calendar push-sync (create event -> appears in Google Calendar)
- Files tab in ProjectDetail
- Emails tab in ProjectDetail
- GoogleSettingsScreen (can just show connection status in Settings)
- `read_drive_file` (summarize a doc's contents via voice)
- `draft_email` (create Gmail draft via voice)

### CUT ENTIRELY (post-demo)

- Board update history
- Auto-sync / background sync
- Offline queueing
- Conflict resolution
- File upload to Drive
- Incremental sync tokens
- `drive.file` -> just use `drive.readonly` for demo (simpler, read-only is fine)

---

## Simplified Architecture (Demo Version)

```
+------------------+         +------------------+         +------------------+
|   iOS App        |  REST   |   Express.js     |         |   Supabase       |
|   (Expo/RN)      |-------->|   Backend        |-------->|   (PostgreSQL)   |
|                  |         |                  |         +------------------+
|  - Dashboard     |  WS     |  - Voice WS      |
|  - Tasks         |-------->|  - Deepgram STT  |         +------------------+
|  - Voice FAB     |         |  - Gemini AI     |-------->|   Google APIs    |
|  - Calendar      |         |  - Board Engine  |         |   (googleapis)   |
|  - Settings      |         |                  |         |  Gmail: readonly |
+------------------+         +------------------+         |  Calendar: read  |
                                                          |  Drive: readonly |
                                                          +------------------+
```

### Simplified Scopes (Read-Only for Demo)

```
Scopes:
  - gmail.readonly          (read emails)
  - calendar.readonly       (read calendar events)
  - drive.readonly          (read Drive files)
  - userinfo.email          (user identity)
```

All read-only. No write operations to Google. This means:
- We pull emails, calendar events, and Drive file lists INTO the app
- We don't push events back to Google Calendar (yet)
- We don't upload files to Drive (yet)
- We don't draft/send emails (yet)

**This is fine for the demo** because the hero moment is the *pull + synthesis*, not the push-back.

---

## Build Order (Critical Path)

### Step 1: Google OAuth Foundation
**Files to create/modify:**
- `backend/src/services/google/googleAuthClient.js` - OAuth2 client with expanded scopes
- `backend/src/routes/google.js` - auth-url, callback, status endpoints
- Supabase: create `google_integrations` table

**Verify:** Can connect Google account, store tokens, see "Connected" status.

### Step 2: Google Service Clients
**Files to create:**
- `backend/src/services/google/gmailService.js` - refactor from existing gmailClient.js
- `backend/src/services/google/calendarSyncService.js` - pull events from Google Calendar
- `backend/src/services/google/driveService.js` - list files in a Drive folder

**Verify:** Can call each service independently and get real data back.

### Step 3: Board Update Engine
**Files to create:**
- `backend/src/services/boardEngine/boardUpdateEngine.js` - orchestrates all 4 scans
- `backend/src/services/boardEngine/boardSummaryGenerator.js` - Gemini synthesis
- `backend/src/routes/board-update.js` - POST /board-update endpoint
- Supabase: create `board_updates` table

**Verify:** POST /board-update returns a complete AI summary with email, Drive, calendar, and task data.

### Step 4: Schema Updates
- `calendar_events`: add `google_event_id TEXT`, `sync_source TEXT DEFAULT 'app'`
- `projects`: add `drive_folder_id TEXT`
- Pre-populate: manually create Drive folders, add IDs to existing projects

### Step 5: AI Updates
**Files to modify:**
- `backend/src/services/logicAi/geminiClient.js` - add 3 new function declarations
- `backend/src/services/logicAi/intentExecutor.js` - handle new intents
- `backend/src/services/logicAi/voiceCommandHandler.js` - include Google data in context

**Verify:** "Update my board" via voice triggers the full pipeline.

### Step 6: Dashboard Screen
**Files to create/modify:**
- `mobile/src/screens/DashboardScreen.tsx` - new home screen
- `mobile/src/services/api.ts` - add board-update, drive, google endpoints
- `mobile/src/navigation/TabNavigator.tsx` - replace Projects tab with Dashboard

**Verify:** Dashboard shows board status, projects with Google metadata, upcoming events.

### Step 7: UI Polish for Demo
- CalendarScreen: show [GCal] badges on synced events
- ProjectDetailScreen: add Files tab (read-only list from Drive)
- SettingsScreen: update Google section (show connected services)
- VoiceOverlay: board update progress states

---

## Pre-Demo Setup Checklist

Before the demo, prepare:

1. **Google Cloud Project** with OAuth consent screen configured
2. **Real Gmail account** with some emails (seed a few if needed)
3. **Real Google Calendar** with 3-4 upcoming events
4. **Real Google Drive** with a "Personal Bot" folder containing:
   - "My App" subfolder with 3-4 files (design-spec.pdf, etc.)
   - "Marketing Campaign" subfolder with 2-3 files
5. **Supabase** with projects pre-created + `drive_folder_id` set
6. **Tasks** pre-populated (including one overdue for dramatic effect)
7. **Backend running** on accessible URL
8. **App built** via `expo run:ios` on physical device or simulator

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Google OAuth breaks on stage | Pre-authorize before demo. Have a fallback with hardcoded tokens. |
| Google API rate limit | All read-only, small data. Should be fine. Test in advance. |
| Gemini returns bad summary | Test exact board state beforehand. Have a known-good state to demo from. |
| Voice recognition fails | Text input fallback in VoiceOverlay. Type the command instead. |
| Slow API response | Board update has progress indicator. Set expectations: "It's pulling from 3 Google services..." |
| Calendar/Drive shows no data | Pre-populate. Verify data exists before demo starts. |

---

## What Makes This Demo Stand Out

1. **It's real.** Real Gmail, real Calendar, real Drive. Not mock data.
2. **Compound intelligence.** One command synthesizes 4 data sources. No other task app does this.
3. **Voice-first but not voice-only.** Shows the button flow too -- accessible to all.
4. **The AI summary is actually useful.** It doesn't just list data -- it connects dots ("review the spec before your meeting").
5. **Immediate follow-up actions.** After the summary, you can voice-command the suggested actions. The loop is tight.
