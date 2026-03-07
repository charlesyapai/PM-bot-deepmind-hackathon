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
