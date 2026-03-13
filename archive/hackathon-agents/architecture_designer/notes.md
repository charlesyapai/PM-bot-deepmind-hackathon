# 📐 Architecture Design Document — Personal Bot

**Author:** Architecture Designer  
**Date:** 2026-03-07  
**Status:** ✅ v2 — PM Approved (updated with Charles's decisions)  
**Reference:** [project_requirements.md](../project_manager/project_requirements.md)

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Technology Stack Recommendation](#2-technology-stack-recommendation)
3. [Data Model (Initial)](#3-data-model-initial)
4. [Voice Pipeline Architecture](#4-voice-pipeline-architecture)
5. [API Design (High-Level)](#5-api-design-high-level)
6. [Extensibility Plan](#6-extensibility-plan)
7. [Offline Architecture](#7-offline-architecture)
8. [Resolved Decisions](#8-resolved-decisions)

---

## 1. System Architecture Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENT (React Native)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │  Voice   │  │  Task/   │  │ Template │  │  Meeting Notes     │  │
│  │  Input   │  │  Project │  │  Views   │  │  Recorder/Viewer   │  │
│  │  Module  │  │  CRUD UI │  │  Engine  │  │                    │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬───────────┘  │
│       │              │              │                  │             │
│  ┌────▼──────────────▼──────────────▼──────────────────▼───────────┐ │
│  │              Local State Manager (Zustand)                     │ │
│  │         + Offline Queue / Optimistic Updates                   │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           │                                         │
│  ┌────────────────────────▼───────────────────────────────────────┐ │
│  │              API Client Layer (REST + WebSocket)               │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
└───────────────────────────┼─────────────────────────────────────────┘
                            │ HTTPS / WSS
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API GATEWAY (e.g. AWS API Gateway)              │
│               Auth (JWT) · Rate Limiting · Routing                  │
└─────────┬───────────────────┬───────────────────┬───────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│  CORE API       │ │  VOICE SERVICE  │ │  AI SERVICE             │
│  (Node.js /     │ │  (Lightweight   │ │  (LLM Orchestration)    │
│   Express)      │ │   proxy to STT) │ │                         │
│                 │ │                 │ │  - Intent Parsing       │
│  - CRUD Ops     │ │  - Audio upload │ │  - Action Mapping       │
│  - Auth         │ │  - STT dispatch │ │  - Meeting Summarize    │
│  - Templates    │ │  - Streaming    │ │  - Prompt Management    │
│  - Search       │ │    results      │ │                         │
└────────┬────────┘ └────────┬────────┘ └────────┬────────────────┘
         │                   │                    │
         │                   ▼                    ▼
         │          ┌─────────────────┐  ┌─────────────────┐
         │          │  SPEECH-TO-TEXT │  │   LLM PROVIDER  │
         │          │  (Deepgram API) │  │  (OpenAI GPT-4o)│
         │          └─────────────────┘  └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER                                │
│  ┌──────────────────────┐  ┌──────────────────────────────────────┐  │
│  │   PostgreSQL (Supabase)│ │  Object Storage (S3 / Supabase      │  │
│  │   - Users              │ │  Storage)                           │  │
│  │   - Projects           │ │  - Audio recordings                 │  │
│  │   - Tasks / Subtasks   │ │  - Attachments                      │  │
│  │   - Templates          │ │                                     │  │
│  │   - Meeting Notes      │ │                                     │  │
│  │   - Action Items       │ │                                     │  │
│  └──────────────────────┘  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Summary

| Component         | Responsibility                                          | Communication                                                       |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| **Mobile Client** | UI rendering, voice capture, local state, offline queue | REST + WebSocket to API Gateway                                     |
| **API Gateway**   | Authentication, rate limiting, request routing          | Routes to microservices                                             |
| **Core API**      | Business logic, CRUD, template management               | Reads/writes PostgreSQL                                             |
| **Voice Service** | Audio upload handling, STT dispatch                     | Calls Deepgram API, returns transcriptions                          |
| **AI Service**    | Intent parsing, action mapping, meeting summarization   | Calls OpenAI API, returns structured actions                        |
| **Database**      | Persistent data storage                                 | PostgreSQL for structured data, S3/Supabase Storage for audio blobs |

### Key Design Decisions

1. **Modular service boundaries** — Voice, AI, and Core API are separated so they can be developed, tested, and scaled independently. This maps to agent responsibilities (Voice-AI Engineer, Logic-AI Designer, Backend Engineer).
2. **Thin mobile client** — Heavy processing (STT, AI) happens server-side. The mobile client captures audio, sends it upstream, and renders results. This keeps the app battery-efficient and fast on constrained hardware.
3. **Supabase as BaaS** — Supabase provides PostgreSQL + Auth + Storage + Realtime subscriptions out of the box, drastically reducing backend boilerplate for a hackathon.

---

## 2. Technology Stack Recommendation

### Mobile Framework: **React Native (Expo)**

| Factor             | Justification                                                                 |
| ------------------ | ----------------------------------------------------------------------------- |
| Cross-platform     | Single codebase for iOS + Android — critical for a small team                 |
| Ecosystem          | Huge library ecosystem; mature audio recording packages (`expo-av`)           |
| Developer velocity | Hot reload, Expo Go for quick testing on physical devices                     |
| Voice support      | Well-supported audio capture APIs via Expo AV                                 |
| Future-proof       | React Native's "New Architecture" (Fabric/TurboModules) improving performance |

**Why not Flutter?** Flutter is excellent, but React Native has a larger talent pool and richer npm ecosystem for rapid prototyping. For a hackathon timeline, developer familiarity and ecosystem breadth win.

**Why not Native (Swift/Kotlin)?** Maintaining two codebases is a non-starter for this team size.

---

### Backend: **Node.js (Express) on Supabase Edge Functions**

| Factor                  | Justification                                                      |
| ----------------------- | ------------------------------------------------------------------ |
| JavaScript full-stack   | Same language as React Native frontend — reduced context-switching |
| Supabase Edge Functions | Serverless, auto-scaling, zero DevOps for a hackathon              |
| Express patterns        | Well-understood, vast middleware ecosystem                         |
| Streaming support       | Node.js excels at streaming (important for voice + LLM responses)  |

**Why not Python?** Python is great for AI/ML, but since we're calling external APIs (OpenAI, Deepgram) rather than running models locally, the advantage disappears. Node.js gives us full-stack JS consistency.

---

### Database: **PostgreSQL (via Supabase)**

| Factor               | Justification                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Relational data      | Projects → Tasks → Subtasks is inherently relational. PostgreSQL handles this natively with foreign keys and JOINs |
| JSONB columns        | Templates have varying structures — JSONB columns give us schema flexibility within a relational model             |
| Supabase integration | Built-in auth, row-level security, realtime subscriptions, auto-generated REST API                                 |
| Extensibility        | PostgreSQL extensions (pg_vector for future AI search, pg_cron for scheduling)                                     |

**Why not NoSQL (MongoDB)?** The core data model is strongly relational. NoSQL would create denormalization headaches for the task hierarchy. JSONB in PostgreSQL gives us the flexibility of NoSQL where we actually need it (templates).

---

### AI / LLM Service: **OpenAI GPT-4o API**

| Factor               | Justification                                                                           |
| -------------------- | --------------------------------------------------------------------------------------- |
| Quality              | Best-in-class for intent parsing and summarization                                      |
| Function calling     | Native JSON function-calling support maps perfectly to our action execution model       |
| Speed                | GPT-4o is significantly faster than GPT-4-Turbo, suitable for real-time voice workflows |
| Developer experience | Excellent SDK, well-documented, reliable uptime                                         |

**Prompt architecture:** Use OpenAI's function-calling / tool-use API to define our actions as "tools" the model can call. This gives structured, parseable output rather than free-text. The Logic-AI Designer will own prompt design.

---

### Speech-to-Text: **Deepgram API**

| Factor    | Justification                                                                       |
| --------- | ----------------------------------------------------------------------------------- |
| Speed     | Sub-300ms latency for streaming STT — critical for voice-first UX                   |
| Accuracy  | Competitive with Google/AWS, excellent on conversational audio                      |
| Streaming | Full WebSocket streaming API — user sees words appear as they speak                 |
| Cost      | Competitive pricing, generous free tier for hackathon                               |
| Features  | Built-in punctuation, diarization (useful for meeting notes with multiple speakers) |

**Alternative considered:** Whisper (OpenAI). Whisper is excellent but requires batch processing (record → upload → process). Deepgram's streaming model is better for the real-time voice-first UX we need. We can use Whisper as a fallback for long meeting recordings where streaming isn't necessary.

---

### Hosting / Deployment

| Layer                      | Service                                                                       |
| -------------------------- | ----------------------------------------------------------------------------- |
| **Backend + Database**     | Supabase (managed PostgreSQL, Edge Functions, Auth, Storage)                  |
| **Additional API compute** | Supabase Edge Functions (Deno-based) or Vercel Serverless Functions (Node.js) |
| **Audio storage**          | Supabase Storage (S3-compatible)                                              |
| **Mobile distribution**    | Expo EAS Build + Expo EAS Submit (for App Store/Play Store)                   |
| **CI/CD**                  | GitHub Actions → Expo EAS                                                     |

---

### Full Stack Summary

```
┌─────────────────────────────────────────────┐
│              TECHNOLOGY STACK               │
├──────────────┬──────────────────────────────┤
│ Mobile       │ React Native (Expo)          │
│ State Mgmt   │ Zustand                      │
│ Backend      │ Node.js / Express            │
│ Hosting      │ Supabase Edge Functions       │
│ Database     │ PostgreSQL (Supabase)         │
│ Auth         │ Supabase Auth (JWT)           │
│ Storage      │ Supabase Storage (S3)         │
│ STT          │ Deepgram (streaming)          │
│ LLM          │ OpenAI GPT-4o                │
│ CI/CD        │ GitHub Actions + Expo EAS     │
└──────────────┴──────────────────────────────┘
```

---

## 3. Data Model (Initial)

### Entity-Relationship Diagram

```
┌──────────┐       ┌──────────────┐       ┌──────────────┐
│  Users   │ 1───N │   Projects   │ 1───N │    Tasks     │
│──────────│       │──────────────│       │──────────────│
│ id (PK)  │       │ id (PK)      │       │ id (PK)      │
│ email    │       │ user_id (FK) │       │ project_id   │
│ name     │       │ title        │       │ parent_task_id│ ← self-referencing for subtasks
│ avatar   │       │ description  │       │ title        │
│ created  │       │ template_id  │       │ description  │
│ updated  │       │ status       │       │ status       │
└──────────┘       │ created      │       │ priority     │
                   │ updated      │       │ position     │ ← ordering within template view
                   └──────────────┘       │ due_date     │
                          │               │ created      │
                          │               │ updated      │
                   ┌──────▼───────┐       └──────────────┘
                   │  Templates   │
                   │──────────────│
                   │ id (PK)      │
                   │ name         │       ┌──────────────────┐
                   │ type         │       │  Meeting Notes   │
                   │ config (JSONB)│      │──────────────────│
                   │ is_default   │       │ id (PK)          │
                   │ created      │       │ project_id (FK)  │
                   └──────────────┘       │ user_id (FK)     │
                                          │ audio_url        │
                                          │ raw_transcript   │
                                          │ summary          │
                                          │ duration_seconds  │
                                          │ status           │ ← 'recording','transcribing','summarizing','done','error'
                                          │ created          │
                                          │ updated          │
                                          └────────┬─────────┘
                                                   │ 1
                                                   │
                                                   │ N
                                          ┌────────▼─────────┐
                                          │  Action Items    │
                                          │──────────────────│
                                          │ id (PK)          │
                                          │ meeting_note_id  │
                                          │ task_id (FK)     │ ← linked to created task (nullable)
                                          │ description      │
                                          │ is_accepted      │
                                          │ created          │
                                          └──────────────────┘
```

### Core Entities

#### `users`

| Column         | Type        | Notes                 |
| -------------- | ----------- | --------------------- |
| `id`           | UUID (PK)   | Supabase Auth user ID |
| `email`        | VARCHAR     | Unique                |
| `display_name` | VARCHAR     |                       |
| `avatar_url`   | VARCHAR     | Nullable              |
| `created_at`   | TIMESTAMPTZ |                       |
| `updated_at`   | TIMESTAMPTZ |                       |

#### `projects`

| Column        | Type                  | Notes                             |
| ------------- | --------------------- | --------------------------------- |
| `id`          | UUID (PK)             |                                   |
| `user_id`     | UUID (FK → users)     | Owner                             |
| `title`       | VARCHAR               |                                   |
| `description` | TEXT                  | Nullable                          |
| `template_id` | UUID (FK → templates) | Active template view              |
| `status`      | ENUM                  | `active`, `archived`, `completed` |
| `created_at`  | TIMESTAMPTZ           |                                   |
| `updated_at`  | TIMESTAMPTZ           |                                   |

#### `tasks`

| Column           | Type                 | Notes                                                               |
| ---------------- | -------------------- | ------------------------------------------------------------------- |
| `id`             | UUID (PK)            |                                                                     |
| `project_id`     | UUID (FK → projects) |                                                                     |
| `parent_task_id` | UUID (FK → tasks)    | Nullable — self-referencing for subtask hierarchy                   |
| `title`          | VARCHAR              |                                                                     |
| `description`    | TEXT                 | Nullable                                                            |
| `status`         | VARCHAR              | Template-dependent (e.g., 'todo', 'in_progress', 'done' for Kanban) |
| `priority`       | ENUM                 | `low`, `medium`, `high`, `urgent`                                   |
| `position`       | INTEGER              | Ordering within its container                                       |
| `due_date`       | TIMESTAMPTZ          | Nullable                                                            |
| `created_at`     | TIMESTAMPTZ          |                                                                     |
| `updated_at`     | TIMESTAMPTZ          |                                                                     |

#### `templates`

| Column       | Type        | Notes                                                             |
| ------------ | ----------- | ----------------------------------------------------------------- |
| `id`         | UUID (PK)   |                                                                   |
| `name`       | VARCHAR     | e.g., "Kanban Board", "Sprint Board", "Checklist"                 |
| `type`       | ENUM        | `kanban`, `checklist`, `sprint`, `calendar`, `custom`             |
| `config`     | JSONB       | Flexible template configuration — columns, statuses, fields, etc. |
| `is_system`  | BOOLEAN     | System-provided vs. user-created                                  |
| `created_at` | TIMESTAMPTZ |                                                                   |

**JSONB `config` example for Kanban (with feature toggling):**

```json
{
  "columns": [
    { "id": "todo", "label": "To Do", "color": "#E2E8F0" },
    { "id": "in_progress", "label": "In Progress", "color": "#FED7AA" },
    { "id": "done", "label": "Done", "color": "#C6F6D5" }
  ],
  "default_status": "todo",
  "features": {
    "priority": { "enabled": true, "label": "Priority" },
    "due_date": { "enabled": true, "label": "Due Date" },
    "subtasks": { "enabled": true, "label": "Subtasks" },
    "description": { "enabled": true, "label": "Description" },
    "attachments": { "enabled": false, "label": "Attachments" }
  }
}
```

> **Design Decision (Q5):** Templates are partially customizable — users select from system-provided templates (Kanban, Checklist, Sprint, Calendar) and can toggle features on/off within each template via the `features` config. Fully custom templates are post-MVP.

#### `meeting_notes`

| Column             | Type                 | Notes                                                       |
| ------------------ | -------------------- | ----------------------------------------------------------- |
| `id`               | UUID (PK)            |                                                             |
| `project_id`       | UUID (FK → projects) | Nullable — can be standalone                                |
| `user_id`          | UUID (FK → users)    |                                                             |
| `title`            | VARCHAR              | Auto-generated or user-provided                             |
| `audio_url`        | VARCHAR              | Path in Supabase Storage                                    |
| `raw_transcript`   | TEXT                 | Full transcript from STT                                    |
| `summary`          | TEXT                 | AI-generated summary                                        |
| `duration_seconds` | INTEGER              |                                                             |
| `status`           | ENUM                 | `recording`, `transcribing`, `summarizing`, `done`, `error` |
| `created_at`       | TIMESTAMPTZ          |                                                             |
| `updated_at`       | TIMESTAMPTZ          |                                                             |

#### `action_items`

| Column            | Type                      | Notes                                                      |
| ----------------- | ------------------------- | ---------------------------------------------------------- |
| `id`              | UUID (PK)                 |                                                            |
| `meeting_note_id` | UUID (FK → meeting_notes) |                                                            |
| `task_id`         | UUID (FK → tasks)         | Nullable — populated when user accepts and links to a task |
| `description`     | TEXT                      | AI-proposed action item text                               |
| `is_accepted`     | BOOLEAN                   | Default `false` — user must confirm                        |
| `created_at`      | TIMESTAMPTZ               |                                                            |

#### `voice_commands` (audit log)

| Column             | Type              | Notes                                        |
| ------------------ | ----------------- | -------------------------------------------- |
| `id`               | UUID (PK)         |                                              |
| `user_id`          | UUID (FK → users) |                                              |
| `raw_transcript`   | TEXT              | What the user said                           |
| `parsed_intent`    | JSONB             | AI's interpretation (action, entity, params) |
| `execution_result` | JSONB             | What action was taken + success/failure      |
| `created_at`       | TIMESTAMPTZ       |                                              |

---

## 4. Voice Pipeline Architecture

### End-to-End Flow

```
 USER SPEAKS
     │
     ▼
┌─────────────┐
│ 1. CAPTURE  │  React Native (expo-av)
│    Audio    │  - PCM/WAV 16kHz mono
│    Stream   │  - Push-to-talk OR auto-detect silence
└──────┬──────┘
       │ audio chunks (WebSocket)
       ▼
┌─────────────┐
│ 2. STREAM   │  Voice Service (backend)
│    TO STT   │  - Forwards audio to Deepgram WebSocket
│             │  - Receives partial + final transcripts
└──────┬──────┘
       │ transcript text (WebSocket to client + to AI service)
       ▼
┌─────────────────┐
│ 3. DISPLAY      │  Mobile Client
│    LIVE TEXT     │  - Show real-time transcription (partial results)
│    (optional)   │  - User sees their words as they speak
└──────┬──────────┘
       │ final transcript (when user stops speaking)
       ▼
┌─────────────────┐
│ 4. AI INTENT    │  AI Service
│    PARSING      │  - Send transcript to GPT-4o with function-calling
│                 │  - Model returns structured action(s)
└──────┬──────────┘
       │ structured action JSON
       │ e.g. { "action": "create_task", "project": "Personal Bot",
       │        "title": "Write unit tests", "priority": "high" }
       ▼
┌─────────────────┐
│ 5. ACTION       │  Core API
│    EXECUTION    │  - Validate the parsed action
│                 │  - Execute against database (create/update/delete)
│                 │  - Return result
└──────┬──────────┘
       │ success/failure + updated entity
       ▼
┌─────────────────┐
│ 6. UI UPDATE    │  Mobile Client
│                 │  - Optimistic update already shown (via Zustand)
│                 │  - Confirm or rollback based on server response
│                 │  - Show success toast / error with retry option
└─────────────────┘
```

### Timing Budget (Target)

| Stage                       | Target Latency      | Notes                              |
| --------------------------- | ------------------- | ---------------------------------- |
| Audio capture → STT start   | < 100ms             | WebSocket already open             |
| STT processing (streaming)  | < 300ms per partial | Deepgram streaming                 |
| Final transcript → AI parse | < 1500ms            | GPT-4o function calling            |
| Action execution            | < 200ms             | DB write                           |
| UI update                   | < 50ms              | Optimistic, already shown          |
| **Total end-to-end**        | **< 2.5 seconds**   | From stop speaking to UI confirmed |

### Error Handling & Fallbacks

| Failure Point                          | Detection                                            | Fallback                                                                    |
| -------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| **Microphone access denied**           | Permission check on app launch                       | Show permission request screen with clear instructions                      |
| **Poor audio / no speech detected**    | Deepgram returns empty/low-confidence transcript     | Prompt user: "I didn't catch that — could you repeat?"                      |
| **STT service down**                   | WebSocket connection failure / timeout > 5s          | Queue audio locally; retry with exponential backoff; show offline indicator |
| **AI intent unclear / low confidence** | AI returns `confidence < 0.7` or `action: "clarify"` | Show parsed interpretation and ask user to confirm: "Did you mean...?"      |
| **AI service down**                    | API timeout > 10s                                    | Show transcript as plain text, let user manually create task from it        |
| **Action execution fails**             | DB error / validation failure                        | Rollback optimistic update, show error toast with retry                     |
| **Network offline**                    | No connectivity detected                             | Queue all commands locally; sync when back online (offline-first)           |

### Meeting Note Pipeline (Variant)

For longer meeting recordings, the pipeline differs:

1. **Record** — User records full meeting audio (stored locally + uploaded to Supabase Storage)
2. **Transcribe** — Batch STT via Deepgram's pre-recorded API (not streaming) — handles long audio efficiently
3. **Summarize** — Send full transcript to GPT-4o with summarization prompt
4. **Extract Actions** — GPT-4o identifies action items from the summary
5. **Present** — Show summary + proposed action items to user
6. **Link** — User accepts/rejects action items; accepted items become tasks linked to a project

---

## 5. API Design (High-Level)

### Architecture Style: **RESTful API** + **WebSocket** for real-time

**Why REST over GraphQL?** The data model is straightforward with well-defined entities. REST is simpler to implement, debug, and cache. GraphQL's flexibility adds complexity without proportional benefit for this MVP. WebSocket handles the one real-time need (voice streaming).

### Base URL Structure

```
https://api.personalbot.app/v1/
```

### Endpoint Overview

#### Authentication (Supabase Auth handles most of this)

| Method | Endpoint        | Description                    |
| ------ | --------------- | ------------------------------ |
| POST   | `/auth/signup`  | Register (proxied to Supabase) |
| POST   | `/auth/login`   | Login (proxied to Supabase)    |
| POST   | `/auth/logout`  | Logout                         |
| POST   | `/auth/refresh` | Refresh JWT token              |

#### Projects

| Method | Endpoint                 | Description             |
| ------ | ------------------------ | ----------------------- |
| GET    | `/projects`              | List user's projects    |
| POST   | `/projects`              | Create project          |
| GET    | `/projects/:id`          | Get project detail      |
| PUT    | `/projects/:id`          | Update project          |
| DELETE | `/projects/:id`          | Delete project          |
| PUT    | `/projects/:id/template` | Switch project template |

#### Tasks

| Method | Endpoint              | Description                                                  |
| ------ | --------------------- | ------------------------------------------------------------ |
| GET    | `/projects/:id/tasks` | List tasks in a project (supports filters: status, priority) |
| POST   | `/projects/:id/tasks` | Create task                                                  |
| GET    | `/tasks/:id`          | Get task detail                                              |
| PUT    | `/tasks/:id`          | Update task (title, status, priority, position, etc.)        |
| DELETE | `/tasks/:id`          | Delete task                                                  |
| POST   | `/tasks/:id/subtasks` | Create subtask                                               |
| PUT    | `/tasks/:id/reorder`  | Reorder tasks (drag-and-drop support)                        |

#### Templates

| Method | Endpoint         | Description                                      |
| ------ | ---------------- | ------------------------------------------------ |
| GET    | `/templates`     | List available templates (system + user-created) |
| GET    | `/templates/:id` | Get template detail + config                     |
| POST   | `/templates`     | Create custom template                           |

#### Meeting Notes

| Method | Endpoint                               | Description                                            |
| ------ | -------------------------------------- | ------------------------------------------------------ |
| GET    | `/meeting-notes`                       | List user's meeting notes                              |
| POST   | `/meeting-notes`                       | Create meeting note (upload audio)                     |
| GET    | `/meeting-notes/:id`                   | Get meeting note detail (transcript, summary, actions) |
| POST   | `/meeting-notes/:id/summarize`         | Trigger AI summarization                               |
| PUT    | `/meeting-notes/:id/actions/:actionId` | Accept/reject proposed action item                     |

#### Voice (WebSocket)

| Protocol | Endpoint        | Description                                                                                                       |
| -------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| WSS      | `/voice/stream` | Bi-directional audio streaming — client sends audio chunks, server returns partial/final transcripts + AI actions |

#### Voice (REST fallback)

| Method | Endpoint            | Description                                                        |
| ------ | ------------------- | ------------------------------------------------------------------ |
| POST   | `/voice/transcribe` | Upload audio file for batch transcription                          |
| POST   | `/voice/command`    | Send text command (bypass STT, useful for testing / text fallback) |

### Request/Response Conventions

- **Auth:** Bearer JWT in `Authorization` header
- **Pagination:** `?page=1&limit=20` with response envelope `{ data: [], meta: { total, page, limit } }`
- **Errors:** Standard format `{ error: { code: "TASK_NOT_FOUND", message: "...", details: {} } }`
- **Timestamps:** ISO 8601 UTC
- **IDs:** UUID v4

---

## 6. Extensibility Plan

### Principle: Plugin-Based Module Architecture

The architecture separates concerns into **modules** with well-defined interfaces. Future features plug into existing interfaces without modifying core logic.

### 6.1 Calendar Integration (Post-MVP)

**Hook points already in architecture:**

- `tasks.due_date` field exists in the data model
- Add a new `integrations` table:

```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  provider VARCHAR NOT NULL, -- 'google_calendar', 'apple_calendar'
  access_token TEXT,
  refresh_token TEXT,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

- Add a **Calendar Sync Service** as a new backend module that:
  - Subscribes to task create/update events (via database triggers or event bus)
  - Syncs `due_date` changes bidirectionally with external calendars
  - Uses OAuth2 for calendar provider auth

**No core architecture changes needed** — just add a new service module + table.

### 6.2 Multi-User Collaboration (Post-MVP)

**Hook points already in architecture:**

- Add `project_members` junction table:

```sql
CREATE TABLE project_members (
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
  PRIMARY KEY (project_id, user_id)
);
```

- Supabase Row-Level Security (RLS) policies already support multi-user patterns
- Supabase Realtime already provides WebSocket-based change subscriptions per table
- Update API authorization middleware to check `project_members` role

**Changes needed:** Authorization logic update, RLS policy updates, add realtime subscriptions for shared projects. Core schema additions only.

### 6.3 Cross-App Integrations (Post-MVP)

**Hook points already in architecture:**

- The voice command pipeline uses a structured action format (`{ action, entity, params }`). New integrations are simply new action types.
- Add an **Integration Registry** pattern:

```typescript
// New actions are registered without modifying core code
actionRegistry.register("sync_to_slack", SlackIntegrationHandler);
actionRegistry.register("create_jira_ticket", JiraIntegrationHandler);
```

- External webhooks for inbound events (e.g., Slack → PersonalBot)

### Extensibility Summary

| Future Feature             | Required Changes                                  | Core Refactoring? |
| -------------------------- | ------------------------------------------------- | ----------------- |
| Calendar integration       | New service module + `integrations` table         | ❌ No             |
| Multi-user collaboration   | `project_members` table + RLS policies + realtime | ❌ No             |
| Cross-app integrations     | Integration registry + new handlers               | ❌ No             |
| Custom AI models           | Swap LLM provider in AI Service config            | ❌ No             |
| Offline-first enhancements | Expand local state + sync queue                   | ❌ No             |

---

## 7. Offline Architecture

> **Decision (Q3):** Charles requires offline viewing of project items + local storage of voice memos to send when back online. This is more than basic caching — it requires local data persistence for reads and a voice memo queue.

### Strategy: Read-Offline + Voice Queue

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENT                                │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                  OFFLINE LAYER                                 │ │
│  │                                                                │ │
│  │  ┌──────────────────┐   ┌──────────────────────────────────┐  │ │
│  │  │  AsyncStorage /  │   │  Voice Memo Queue               │  │ │
│  │  │  MMKV Cache      │   │  (expo-file-system)             │  │ │
│  │  │                  │   │                                  │  │ │
│  │  │  - Projects list │   │  - Record audio → save locally  │  │ │
│  │  │  - Tasks by proj │   │  - Queue for upload when online │  │ │
│  │  │  - Templates     │   │  - Track: pending / uploaded    │  │ │
│  │  │  - Meeting notes │   │  - Auto-retry on reconnect      │  │ │
│  │  │    (metadata)    │   │                                  │  │ │
│  │  └──────────────────┘   └──────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  Sync Manager (Zustand middleware)                       │  │ │
│  │  │  - Detect connectivity (NetInfo)                         │  │ │
│  │  │  - On reconnect: flush voice queue → refresh stale data  │  │ │
│  │  │  - Track last_synced_at per entity type                  │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Offline Capabilities (MVP)

| Capability                     | Offline Behavior                                                | Sync Behavior                              |
| ------------------------------ | --------------------------------------------------------------- | ------------------------------------------ |
| **View projects**              | ✅ Read from local cache                                        | Auto-refresh on reconnect                  |
| **View tasks**                 | ✅ Read from local cache                                        | Auto-refresh on reconnect                  |
| **View meeting notes**         | ✅ Read metadata + summary from cache                           | Full transcript loaded on demand           |
| **Record voice memo**          | ✅ Save audio locally via expo-file-system                      | Queue upload, process STT + AI when online |
| **Voice commands**             | ❌ Requires internet (STT + AI are server-side)                 | N/A                                        |
| **Create/edit tasks manually** | ❌ Not in MVP (post-MVP: offline CRUD with conflict resolution) | N/A                                        |

### Implementation Details

1. **Local Storage:** Use [MMKV](https://github.com/mrousavy/react-native-mmkv) (fast key-value store, 30x faster than AsyncStorage) for caching serialized project/task data.
2. **Voice Memo Queue:** Audio files stored via `expo-file-system` in the app's document directory. A queue table in MMKV tracks `{ id, filePath, status: 'pending'|'uploading'|'uploaded', createdAt }`.
3. **Connectivity Detection:** `@react-native-community/netinfo` monitors connection state. The Sync Manager subscribes to state changes.
4. **Cache Invalidation:** On reconnect, fetch updated data with `?updated_after={last_synced_at}` to minimize data transfer.
5. **Stale Data Indicator:** UI shows a subtle "Last synced: X minutes ago" badge when offline, so users know they're viewing cached data.

---

## 8. Resolved Decisions

All open questions from v1 have been answered by Charles (via PM). These decisions are now embedded throughout the document.

| #      | Question                       | Decision                                                                                   | Impact on Architecture                                                               |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Q1** | Target platforms               | **iOS first** for MVP                                                                      | Test primarily on iOS. Expo EAS builds for iOS only for initial releases.            |
| **Q2** | Auth scope                     | **Single-user for MVP**, architecture must support future multi-user                       | Use Supabase Auth but skip OAuth flows for now. Simple email/password or magic link. |
| **Q3** | Offline support                | **Offline viewing** of project items + **local voice memo storage** with upload queue      | New Offline Architecture section added (Section 7). MMKV + voice queue.              |
| **Q4** | Meeting recording max duration | **Deferred** — pending STT model capability/cost evaluation                                | ⚠️ TODO for Voice-AI Engineer + Logic-AI Designer to research and recommend.         |
| **Q5** | Template customization         | **Partially customizable** — users toggle features on/off within system templates          | Template `config` JSONB updated with `features` object for toggling.                 |
| **Q6** | AI action confirmation         | **Execute immediately** for ALL actions. No confirmation flow. Escalate errors to Charles. | Simpler voice pipeline (removed confirmation step). Need strong undo/error recovery. |

---

## Appendix: Agent Responsibility Mapping

| Architecture Component                              | Responsible Agent          |
| --------------------------------------------------- | -------------------------- |
| Mobile UI + State Management + Offline Layer        | Frontend Engineer          |
| Core API + Database                                 | Backend Engineer           |
| Voice Pipeline (STT integration)                    | Voice-AI Engineer          |
| AI Service (prompts, intent parsing, summarization) | Logic-AI Designer          |
| API contracts between services                      | Architecture Designer (me) |
| Testing all components                              | Test Engineer              |
| Documentation                                       | Documentation Engineer     |
| Code review + versioning                            | Senior Engineer            |
| Overall coordination                                | Project Manager            |

---

**End of Architecture Design Document — v2 (Approved)**

_All open questions resolved. Ready for distribution to all agents._
