# Personal Bot -- Complete Project Blueprint

**Purpose:** This document describes everything needed to rebuild Personal Bot from scratch. It covers what the app is, how it works, every component involved, the UX flows, architecture, database schema, AI strategy, and how all pieces integrate.

---

## 1. What This App Is

Personal Bot is a **voice-driven personal project and task manager** for iOS. The user speaks into the app, and an AI assistant interprets the command to create projects, manage tasks, schedule calendar events, check emails, and maintain board health -- all through natural conversation.

**Core premise:** The voice is the primary input. The visual UI is the structured display layer. You should be able to manage your entire workflow without touching a button.

**What makes it different from a basic task app:**
- AI-powered intent parsing (not keyword matching -- actual conversational understanding)
- Smart context inference (knows which project you mean, detects duplicate tasks, suggests refinements)
- Housekeeping mode ("clean up my board" analyzes overdue tasks, stale projects, missed meetings)
- Gmail integration (import emails, create tasks from emails via voice)
- File attachments with local caching for offline access

---

## 2. Architecture Overview

```
+------------------+         +------------------+         +------------------+
|   iOS App        |  REST   |   Express.js     |  SQL    |   Supabase       |
|   (Expo/RN)      |-------->|   Backend        |-------->|   (PostgreSQL)   |
|                  |         |   Port 3000      |         |   + Storage      |
|  - 5 tab screens |  WS     |                  |  REST   |   + Auth         |
|  - VoiceOverlay  |-------->|  - Voice WS      |-------->|                  |
|  - Local storage |         |  - Deepgram STT  |         +------------------+
+------------------+         |  - Gemini AI     |
                             |  - Gmail API     |         +------------------+
                             |                  |-------->|   Deepgram       |
                             +------------------+   WS    |   (Speech-to-    |
                                                          |    Text)         |
                                                          +------------------+
                                                          +------------------+
                                                          |   Google Gemini  |
                                                          |   2.5 Flash      |
                                                          |   (Intent Parse) |
                                                          +------------------+
```

### Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Mobile | React Native + Expo (TypeScript) | Cross-platform with native module access via dev builds |
| Backend | Node.js + Express | Lightweight, real-time WS support, JS ecosystem |
| Database | Supabase (PostgreSQL) | Auth, real-time, storage, row-level security in one |
| File Storage | Supabase Storage | Integrated with auth, signed URLs for secure access |
| Speech-to-Text | Deepgram | Real-time streaming STT via WebSocket, high accuracy |
| AI/NLU | Google Gemini 2.5 Flash | Function calling for structured intent parsing, low latency |
| Gmail | Google Gmail API (googleapis) | REST API for email fetch, OAuth2 for auth |

### Data Flow for a Voice Command

```
User speaks "Add a task called fix the login bug to my app project"
    |
    v
[expo-av] captures audio chunks (PCM 16-bit, 16kHz mono)
    |
    v
[WebSocket] streams audio to backend ws://host:3000/voice/stream?token=JWT
    |
    v
[VoiceSession] receives chunks, forwards to Deepgram live streaming
    |
    v
[Deepgram] returns partial transcripts (streaming) and final transcript
    |
    v
[VoiceCommandHandler] receives final transcript:
    1. Fetches user context from Supabase (projects, tasks, events, emails)
    2. Formats context with today's date, task lists grouped by project
    3. Appends conversation history for multi-turn support
    4. Calls Gemini parseIntent(transcript, context)
    |
    v
[Gemini 2.5 Flash] with 14 function declarations:
    - Reads system instruction (personality, inference rules, guardrails)
    - Reads context (projects with tasks, calendar, emails)
    - Returns function call: { name: "create_task", args: { projectId: "xxx", title: "Fix the login bug" } }
    |
    v
[IntentExecutor] executes the function call against Supabase:
    - Inserts task into tasks table
    - Returns: { success: true, message: 'Created task "Fix the login bug"' }
    |
    v
[WebSocket] sends result back to mobile:
    { type: "action", intent: {...}, result: { success: true, message: "..." } }
    |
    v
[VoiceOverlay] displays success card with green checkmark
    - Auto-dismisses after 3 seconds
    - Haptic feedback (success vibration)
```

---

## 3. Database Schema

10 tables in Supabase PostgreSQL:

### Core Tables

```sql
-- Projects: top-level containers for tasks
projects (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  template TEXT DEFAULT 'checklist',  -- 'kanban', 'checklist', 'sprint'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- Tasks: work items within projects
-- NOTE: tasks do NOT have user_id. Ownership is via project_id -> projects.user_id
tasks (
  id UUID PK DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- Templates: predefined project structures
templates (
  id UUID PK DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'kanban', 'checklist', 'sprint'
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Meeting notes: voice recordings with AI summaries
meeting_notes (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  transcript TEXT,
  summary TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- Action items: proposed tasks from meeting summaries
action_items (
  id UUID PK DEFAULT gen_random_uuid(),
  meeting_note_id UUID REFERENCES meeting_notes(id),
  title TEXT NOT NULL,
  accepted BOOLEAN DEFAULT false,
  task_id UUID REFERENCES tasks(id),
  created_at TIMESTAMPTZ DEFAULT now()
)
```

### Calendar

```sql
calendar_events (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,   -- Combined date+time as single TIMESTAMPTZ
  end_time TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  recurrence TEXT,                    -- 'daily', 'weekly', 'monthly', or null
  reminder_minutes INTEGER,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)
```

### File Attachments

```sql
attachments (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,   -- Path in Supabase Storage bucket "attachments"
  created_at TIMESTAMPTZ DEFAULT now()
)
```

### Gmail Integration

```sql
email_integrations (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  google_access_token TEXT NOT NULL,
  google_refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  gmail_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

email_rules (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rule_name TEXT NOT NULL,
  sender_filter TEXT,
  label_filter TEXT,
  date_range_days INTEGER DEFAULT 7,
  auto_import BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
)

imported_emails (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  gmail_message_id TEXT NOT NULL,
  subject TEXT,
  sender TEXT,            -- Email address
  sender_name TEXT,       -- Display name
  received_at TIMESTAMPTZ,
  snippet TEXT,
  labels TEXT[],          -- Array of Gmail label IDs
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, gmail_message_id)
)
```

### Key Schema Notes
- **Tasks have no user_id.** Ownership is determined by `task.project_id -> project.user_id`. All task queries must scope through projects first.
- **Calendar events use `start_time TIMESTAMPTZ`** -- a single combined date+time column, NOT separate date and time columns.
- **`imported_emails` uses `sender` (not `sender_email`) and `labels TEXT[]` (array, not singular).**

---

## 4. Backend API

Base URL: `http://<host>:3000/api/v1`

### REST Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /health | Server health check |
| GET/POST/PUT/DELETE | /projects | Full CRUD, user-scoped |
| GET/POST/PUT/DELETE | /tasks | Full CRUD, scoped via project ownership |
| GET | /templates | List system templates |
| GET/POST | /meeting-notes | Meeting note CRUD |
| GET/POST/PUT/DELETE | /calendar | Calendar event CRUD with date range filters |
| GET | /housekeeping | Health report (overdue, stale, unset, past events, deadlines) |
| GET/POST/DELETE | /attachments | File upload (multipart), list, download URL, delete |
| GET | /gmail/auth-url | Google OAuth2 authorization URL |
| GET | /gmail/callback | OAuth callback, stores tokens |
| GET | /gmail/status | Connection status |
| GET | /gmail/emails | Fetch emails with filters |
| GET/POST/DELETE | /gmail/rules | Email rule CRUD |
| POST | /gmail/sync | Trigger email import based on rules |
| POST | /voice/transcribe | Batch meeting transcription |
| POST | /voice/command | Text command fallback |

### WebSocket

`ws://<host>:3000/voice/stream?token=<JWT>`

Messages:
- **Client -> Server:** `{ type: "text_command", transcript: "..." }` (text input) or raw audio chunks (binary)
- **Server -> Client:** `{ type: "partial", transcript: "..." }` (interim transcript)
- **Server -> Client:** `{ type: "final", transcript: "...", confidence: 0.95 }` (final transcript)
- **Server -> Client:** `{ type: "action", intent: { name, args }, result: { success, message, data } }` (AI action result)
- **Server -> Client:** `{ type: "error", message: "..." }` (error)

### Auth Pattern

All routes extract user ID from JWT Bearer token:
```js
function getUserId(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return jwt.decode(token)?.sub || null;  // decode only, not verify (Supabase uses ES256)
}
```

---

## 5. AI Intent System

### Model: Google Gemini 2.5 Flash

Configured with:
- `temperature: 0.1` (deterministic for reliable parsing)
- `systemInstruction` defining personality, inference rules, and guardrails
- `tools: [{ functionDeclarations }]` with 14 functions

### 14 Function Declarations

| Function | Purpose | Key Params |
|---|---|---|
| `create_project` | New project | title (required) |
| `list_projects` | Show projects with task counts | (none) |
| `create_task` | Add task to project | projectId, title (required) |
| `update_task` | Modify task status/priority | taskId (required) |
| `list_tasks` | Query tasks with filters | projectId, status, priority (all optional) |
| `create_event` | Schedule calendar event | title, date (required) |
| `list_events` | Query events by date range | fromDate, toDate (optional) |
| `update_event` | Modify event | eventId (required) |
| `delete_event` | Remove event (guarded) | eventId (required) |
| `run_housekeeping` | Board health analysis | (none) |
| `check_emails` | Search imported emails | sender, label, since (all optional) |
| `create_task_from_email` | Turn email into task | emailId (required) |
| `respond` | Conversational response | message (required), suggestedActions |
| `clarify` | Ask follow-up question | promptText (required) |

### AI Personality & Rules

The system instruction makes the AI a **conversational personal project manager**, not just an intent parser:

1. **Smart context inference:** Auto-selects the only project, matches partial names ("marketing project" -> "Marketing Campaign Q2"), resolves relative dates ("tomorrow", "next Friday")
2. **Duplicate detection:** Before creating a task, checks if a similar one exists or is already done
3. **Duration inference:** "This should take 2 days" -> sets due_date to today+2
4. **Task refinement:** Vague tasks ("work on the app") trigger sub-task suggestions
5. **Status awareness:** "Mark the design task as done" -> fuzzy matches, warns if already done
6. **Guardrails:** Deletes require exact name match, never invents IDs, low confidence triggers clarify

### Context Object (sent to Gemini with every request)

```json
{
  "userId": "uuid",
  "today": "Saturday, March 7, 2026",
  "todayISO": "2026-03-07",
  "dayOfWeek": "Saturday",
  "projects": [
    {
      "index": 1, "id": "uuid", "title": "My App",
      "pendingTasks": 3, "completedTasks": 5, "totalTasks": 8,
      "tasks": [
        { "id": "uuid", "title": "Fix login bug", "status": "todo", "priority": "high" }
      ]
    }
  ],
  "recentTasks": [ ... ],
  "upcomingEvents": [ ... ],
  "recentEmails": [ ... ],
  "conversationHistory": "[Turn 1] User: ...\n[Turn 1] Assistant: ..."
}
```

### Conversation History

Per-user in-memory Map. Cleared after successful CRUD actions. Kept for clarify/respond turns. Max 6 turns (12 entries).

---

## 6. Voice Pipeline

### Components (7 files in `backend/src/services/voice/`)

1. **voiceStreamRouter.js** - Attaches WebSocket server to HTTP server at `/voice/stream`. Extracts JWT from query params. Creates one `VoiceSession` per connection.
2. **voiceSession.js** - Per-connection state machine. Handles control messages (`start`, `stop`, `text_command`). Streams audio to DeepgramClient. Receives transcripts and calls `onFinalTranscript`.
3. **deepgramClient.js** - Wraps Deepgram SDK. Opens live streaming connection with `model: "nova-2"`, `language: "en"`, `smart_format: true`. Returns partial and final transcripts.
4. **audioProcessor.js** - Validates audio format, chunks binary data for streaming.
5. **voiceRestRouter.js** - REST fallback for batch transcription and text commands.
6. **meetingTranscriber.js** - Batch transcription for uploaded meeting audio files.
7. **index.js** - Barrel export.

### Text Command Shortcut

When the user types instead of speaks, `VoiceSession` handles `text_command` messages by bypassing Deepgram entirely and calling `onFinalTranscript` directly with the typed text.

---

## 7. Mobile App Structure

### Navigation

```
RootNavigator (Native Stack)
  |
  |-- [Not authenticated] --> LoginScreen
  |
  |-- [Authenticated] -->
        |-- MainTabs (Bottom Tab Navigator)
        |     |-- Projects tab (ProjectsScreen)
        |     |-- Tasks tab (TasksScreen)
        |     |-- Voice FAB (VoiceOverlay trigger, not a real tab)
        |     |-- Calendar tab (CalendarScreen)
        |     |-- Settings tab (SettingsScreen)
        |
        |-- ProjectDetail (pushed from Projects)
        |-- GmailSettings (pushed from Settings)
```

### Screen Descriptions

| Screen | What It Does |
|---|---|
| **LoginScreen** | Email/password auth via Supabase. Toggle between sign-in and sign-up. |
| **ProjectsScreen** | FlatList of projects with status badges, template labels. "+" button creates new project via modal. Tap project -> ProjectDetail. |
| **TasksScreen** | Global view of all tasks across projects. Priority color bars, status indicators. |
| **ProjectDetailScreen** | Single project view. Checklist of tasks with checkbox toggle. Progress bar. "+" to add task. Paperclip to attach files. Attachment chips below tasks. |
| **CalendarScreen** | SectionList grouped by day. Event cards with status dot, time range, project tag. "+" creates event via modal (date/time pickers, project picker, all-day toggle). Pull-to-refresh. |
| **SettingsScreen** | Grouped iOS-style list: Gmail Integration (-> GmailSettings), Board Health Check (opens modal with housekeeping results), Storage (cache size + clear), Sign Out. |
| **GmailSettingsScreen** | Gmail OAuth connection. Email rules list with add/delete. Imported emails with "Create Task" action. Manual sync button. |

### VoiceOverlay Component

Full-screen modal triggered by the center FAB in the tab bar. States:

1. **Idle** - Mic button, text input field for typing
2. **Listening** - Pulsing blue mic, "Listening..." text, live partial transcript
3. **Processing** - Spinner while Gemini parses intent
4. **Done (success)** - Green mic with checkmark, success result card, auto-dismiss 3s
5. **Done (response)** - Blue mic, AI response card with suggested action pills
6. **Clarifying** - Blue pulsing mic, clarification bubble, "Listening for your answer..."
7. **Error** - Red mic with "!" icon, error message, "Tap to retry"

### Design System

- **Colors:** iOS System Blue (#007AFF), System backgrounds, semantic red/green/orange
- **Typography:** San Francisco, H1 34pt Bold, H2 28pt Semibold, Body 17pt, Caption 13pt
- **Spacing:** 8px grid, 16px margins, 12px rounded corners

---

## 8. Gmail Integration Flow

```
User taps "Gmail Integration" in Settings
    |
    v
GmailSettingsScreen shows "Connect Gmail" button
    |
    v
Taps button -> calls GET /api/v1/gmail/auth-url
    |
    v
Opens Google OAuth consent screen in browser
    |
    v
User authorizes -> Google redirects to /api/v1/gmail/callback?code=xxx
    |
    v
Backend exchanges code for access_token + refresh_token
    |
    v
Stores tokens in email_integrations table
    |
    v
Screen now shows "Connected: user@gmail.com"
    |
    v
User creates email rules (e.g., "From: boss@company.com, Label: Project-X, Last 7 days")
    |
    v
User taps "Sync Now" -> POST /api/v1/gmail/sync
    |
    v
Backend fetches emails matching rules via Gmail API
    |
    v
Upserts into imported_emails table (deduplicates by gmail_message_id)
    |
    v
Emails appear in list. User can:
  - Tap email -> see details + "Create Task from Email" button
  - Say "check my emails from Sarah" -> AI calls check_emails
  - Say "make a task from that email" -> AI calls create_task_from_email
```

---

## 9. Housekeeping Flow

### Voice-Triggered
```
User says "Clean up my board" or "What needs attention?"
    |
    v
Gemini calls run_housekeeping (no params)
    |
    v
IntentExecutor queries Supabase:
  1. Overdue tasks (due_date < today, status != done)
  2. Stale projects (no task updates in 7+ days)
  3. Untriaged tasks (missing due_date or priority)
  4. Past events (start_time < now, still "scheduled")
  5. Upcoming deadlines (due_date within 48h)
    |
    v
Formats as conversational message:
  "Here's your board health check:
   Overdue tasks (2):
     - 'Fix login bug' was due 2026-03-05 (My App)
   ..."
    |
    v
Sent to VoiceOverlay as respond-type message
```

### Manual-Triggered
```
User taps "Board Health Check" in Settings
    |
    v
Calls GET /api/v1/housekeeping
    |
    v
Returns structured JSON with all categories
    |
    v
Displayed in modal with summary bar (overdue count, attention count, upcoming count)
and collapsible category sections with tappable issue cards
```

---

## 10. File Structure

```
Personal Bot/
|-- backend/
|   |-- server.js                        # Express + HTTP + WS entry point
|   |-- .env                             # API keys (gitignored)
|   |-- .env.example                     # Template for env vars
|   |-- package.json
|   |-- src/
|       |-- lib/
|       |   |-- supabase.js              # Supabase client singleton
|       |-- routes/
|       |   |-- projects.js              # CRUD
|       |   |-- tasks.js                 # CRUD
|       |   |-- templates.js             # Read-only
|       |   |-- meeting-notes.js         # CRUD
|       |   |-- calendar.js              # CRUD with date filters
|       |   |-- housekeeping.js          # Health analysis
|       |   |-- attachments.js           # File upload/download
|       |   |-- gmail.js                 # OAuth + rules + sync
|       |-- services/
|           |-- voice/
|           |   |-- index.js
|           |   |-- voiceStreamRouter.js
|           |   |-- voiceSession.js
|           |   |-- deepgramClient.js
|           |   |-- audioProcessor.js
|           |   |-- voiceRestRouter.js
|           |   |-- meetingTranscriber.js
|           |-- logicAi/
|           |   |-- geminiClient.js      # Gemini SDK + 14 function declarations
|           |   |-- intentExecutor.js    # CRUD execution for all intents
|           |   |-- voiceCommandHandler.js # Context fetch + parse + execute
|           |   |-- meetingSummarizer.js  # Meeting summary extraction
|           |-- gmail/
|               |-- gmailClient.js       # Gmail API wrapper
|
|-- mobile/
|   |-- app.json                         # Expo config
|   |-- package.json
|   |-- index.ts                         # Entry point
|   |-- src/
|       |-- lib/
|       |   |-- supabase.ts              # Supabase client + auth helpers
|       |   |-- localStorage.ts          # File caching + offline storage
|       |-- services/
|       |   |-- api.ts                   # All typed API fetch wrappers
|       |-- theme/
|       |   |-- colors.ts               # iOS design system colors
|       |   |-- typography.ts           # Font sizes and weights
|       |-- components/
|       |   |-- VoiceOverlay.tsx         # Voice capture + WS + intent display
|       |-- navigation/
|       |   |-- RootNavigator.tsx        # Auth gate
|       |   |-- TabNavigator.tsx         # Bottom tabs + VoiceFAB
|       |-- screens/
|           |-- LoginScreen.tsx
|           |-- ProjectsScreen.tsx
|           |-- ProjectDetailScreen.tsx
|           |-- TasksScreen.tsx
|           |-- CalendarScreen.tsx
|           |-- SettingsScreen.tsx
|           |-- GmailSettingsScreen.tsx
|           |-- MeetingNotesScreen.tsx
```

---

## 11. Environment Variables

```bash
# Backend (.env)
PORT=3000

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxxxx
SUPABASE_JWT_SECRET=xxxxx

# Deepgram (Speech-to-Text)
DEEPGRAM_API_KEY=xxxxx

# Google Gemini (AI Intent Parsing)
GEMINI_API_KEY=xxxxx

# Google OAuth (Gmail Integration)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/gmail/callback
```

```bash
# Mobile (hardcoded in api.ts, supabase.ts)
BASE_URL=http://<LAN_IP>:3000/api/v1
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxxxx
```

---

## 12. How to Build From Scratch

### Step 1: Set Up Supabase
1. Create Supabase project
2. Disable email confirmation in Auth settings
3. Run all CREATE TABLE SQL (10 tables)
4. Create Storage bucket "attachments" (private)
5. Enable RLS on all tables with `auth.uid() = user_id` policies

### Step 2: Backend
1. `mkdir backend && cd backend && npm init -y`
2. Install: `express cors dotenv jsonwebtoken @supabase/supabase-js @google/generative-ai @deepgram/sdk ws multer googleapis`
3. Create `src/lib/supabase.js` (client singleton)
4. Build routes one at a time: projects -> tasks -> templates -> calendar -> housekeeping -> attachments -> gmail
5. Build voice pipeline: deepgramClient -> audioProcessor -> voiceSession -> voiceStreamRouter
6. Build AI pipeline: geminiClient (system instruction + 14 functions) -> intentExecutor -> voiceCommandHandler
7. Wire everything in server.js

### Step 3: Mobile
1. `npx create-expo-app mobile --template blank-typescript`
2. Install: `@supabase/supabase-js @react-native-async-storage/async-storage @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack react-native-screens react-native-safe-area-context lucide-react-native expo-av expo-document-picker expo-file-system expo-haptics expo-auth-session expo-crypto`
3. Create theme files (colors, typography)
4. Create supabase.ts and api.ts
5. Build screens: Login -> Projects -> ProjectDetail -> Tasks -> Calendar -> Settings -> GmailSettings
6. Build VoiceOverlay component
7. Build navigation: RootNavigator (auth gate) -> TabNavigator (5 tabs)
8. Build localStorage.ts for offline caching

### Step 4: Development Build
1. Update app.json with bundle ID, permissions, plugins
2. `npx expo prebuild --platform ios`
3. `npx expo run:ios` (requires Xcode)

### Step 5: Connect Everything
1. Set backend .env with all API keys
2. Set mobile BASE_URL to your LAN IP
3. Start backend: `cd backend && node server.js`
4. Start mobile: `cd mobile && npx expo run:ios`
5. Test: Login -> Create project -> Voice command "add a task called hello world" -> Verify task appears

---

## 13. Key Design Decisions & Gotchas

1. **JWT decode, not verify:** Supabase uses ES256 (asymmetric). The backend uses `jwt.decode()` with manual expiry check instead of `jwt.verify()`, because verify requires the public key which isn't easily available.

2. **Tasks scoped through projects:** Never query tasks with `user_id`. Always get user's project IDs first, then query tasks with `.in("project_id", projectIds)`.

3. **Calendar uses TIMESTAMPTZ:** Don't split into separate date and time columns. Combine as `${date}T${time}:00` when creating events from Gemini's separate date/startTime params.

4. **Voice text fallback:** Since expo-av mic capture requires a native build (not Expo Go), the VoiceOverlay has a text input field that sends `{ type: "text_command", transcript: "..." }` over the WebSocket, bypassing Deepgram entirely.

5. **Gemini function calling, not chat:** The AI doesn't generate free text. It ALWAYS returns a function call (one of 14 declarations). If it generates text instead, the client wraps it in a `respond` function call as fallback.

6. **Conversation history is per-user, in-memory:** Not persisted to DB. Cleared after successful CRUD actions. Only maintained for clarify/respond multi-turn flows. Max 12 entries.

7. **Supabase anon key format:** May look like `sb_publishable_...` instead of the typical `eyJ...` JWT format. Both work.

8. **Multer for file uploads:** Uses memory storage (buffer), not disk. 10MB limit. Uploaded to Supabase Storage, metadata saved to attachments table.
