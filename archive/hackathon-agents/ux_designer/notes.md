# 📝 UX Designer — Working Notes

---

## Context Review — 2026-03-07 11:00am

### Project Overview

**Personal Bot** — a voice-driven personal project/task manager for mobile (React Native / Expo). The core interaction is **voice-first**: user speaks → AI interprets → app updates tasks, projects, and notes.

### Key UX Principles (from PM brief + project requirements)

1. **Voice-first UX** — speaking is the primary input, visual UI is a structured display layer
2. **Template-centric views** — users switch between templates (Kanban, checklist, sprint board, etc.)
3. **Mobile-first** — every screen designed for touch on small screens
4. **Simplicity over complexity** — feels like talking to a smart assistant, not a PM tool

### Core Features for UX Design

1. **Voice input module** — push-to-talk or auto-detect silence, live transcription display, AI interpretation feedback
2. **Customizable templates** — Kanban, checklist, sprint board; switching + editing views
3. **Meeting note summarization** — recording → transcription → AI summary → action items → link to project
4. **Project & task CRUD** — hierarchical (projects → tasks → subtasks), status tracking, drag & reorder

### Architecture Insights (v2 + PM Updates)

- **Tech stack**: React Native (Expo) + Zustand state + Node.js/Express + Supabase + Deepgram STT + Google Gemini (`gemini-2.0-flash`)
- **Voice pipeline latency target**: < 2.5 seconds end-to-end (speak → UI confirmed)
- **Live transcription**: partial results streamed back via WebSocket as user speaks
- **AI intent parsing**: structured actions via Gemini function-calling (e.g., `{ action: "create_task", ... }`). Supported intents: `create_task`, `update_task`, `create_project`, `clarify`. Meeting summarisation uses `extract_meeting_data` → returns `summary` + `action_items[]`.
- **Error states to design for**: mic denied, poor audio, AI unclear intent ("Did you mean...?"), offline mode
- **Meeting notes**: separate pipeline — record → batch STT → summarize → extract action items → user accepts/rejects. Recording max duration is 2 hours (per Voice-AI Engineer update).
- **Templates**: stored as JSONB config. Partially customizable — users can toggle features on/off within provided templates.

### Key UX-impacting Architecture Decisions

- **Mobile Paradigm**: iOS first for MVP
- **Offline Mode**: Offline viewing of project items is required. MUST design an offline indicator.
- **Voice Execution**: AI actions execute IMMEDIATELY (no confirmation flow). **CRITICAL MUST-HAVE:** Good undo/error recovery UX (e.g., toast with "Undo" button).

---

## UX Design Readiness

### Status: 🟢 ACTIVATED

The Architecture Design Document v2 is fully approved. I am now tasked with creating the 6 primary UX deliverables to hand off to the Frontend Engineer.

### When Activated, My First Deliverables Should Be:

1. **Core screen map** — all screens in the app and navigation flow
2. **Voice interaction flow** — detailed UX for the voice input experience
3. **Template view wireframes** — Kanban, checklist, sprint board layouts
4. **Meeting notes flow** — recording → summary → action items UX
5. **Design system** — colors, typography, spacing, component library spec

---

## Gap Analysis — API vs UX Spec (2026-03-07 11:15am)

### What the API Currently Covers

| UX Spec Requirement | API Support | Status |
|---|---|---|
| List all projects | `GET /api/v1/projects` | Covered |
| Create a project (title, description, template) | `POST /api/v1/projects` | Covered |
| List tasks for a project | `GET /api/v1/tasks?projectId=` | Covered |
| Create a task (title, priority, due_date, description) | `POST /api/v1/tasks` | Covered |
| Update task (status, priority, title) | `PUT /api/v1/tasks/:id` | Covered |
| List meeting notes | `GET /api/v1/meeting-notes` | Covered |
| Create a meeting note | `POST /api/v1/meeting-notes` | Covered |
| Batch transcription for meeting recordings | `POST /api/v1/voice/transcribe` | Covered |
| Live voice streaming (real-time transcription) | `WS /voice/stream` | Covered |
| Voice command → AI intent parsing | `POST /api/v1/voice/command` | Covered (text fallback) |
| List templates (Kanban, Checklist, Sprint) | `GET /api/v1/templates` | Covered |

### Gaps — UX Spec Requires, API Does Not Yet Have

1. **Task deletion** — `DELETE /api/v1/tasks/:id` is not present. The undo toast flow assumes a delete action is possible (the user says "delete task X" and immediately undoes it). Without a delete endpoint, this flow cannot be implemented.

2. **Project deletion/archiving** — No `DELETE /api/v1/projects/:id` or archive endpoint. Users will accumulate projects with no way to remove them.

3. **Undo/revert endpoint** — The UX spec defines an "Undo Toast" that must reverse the last AI-executed action within 5 seconds. There is no `/api/v1/voice/undo` or action-log endpoint. This requires either: (a) a server-side action log with a revert endpoint, or (b) the frontend performs a compensating API call (e.g., delete the just-created task). Option (b) is workable for now but fragile for complex operations.

4. **Task subtasks** — The spec calls for `projects → tasks → subtasks` hierarchy. The current `POST /api/v1/tasks` and `GET /api/v1/tasks` have no `parent_task_id` field or subtask listing. Subtasks are entirely absent from the API.

5. **Meeting note → project linking** — The UX flow requires linking extracted action items to a specific project. `POST /api/v1/meeting-notes` has no `project_id` association field documented, and there is no endpoint to link a meeting note's action items to a project.

6. **Action items accept/reject** — The meeting notes UX has a swipe-to-accept / swipe-to-reject flow for `action_items[]` returned by `extract_meeting_data`. There is no API endpoint to persist accepted action items as tasks, nor to mark individual action items as rejected.

7. **Task drag-and-drop reorder** — The Kanban template requires drag-and-drop reordering. `PUT /api/v1/tasks/:id` can update status, but there is no `position` or `order` field, meaning column order cannot be persisted.

8. **Offline sync queue** — The UX spec requires offline command queuing ("Command queued for sync.") with a pending-count badge. There is no `/api/v1/sync` endpoint or mechanism for replaying queued commands. This is a frontend-only concern for now but will need a backend flush endpoint eventually.

9. **User authentication flow** — `GET /api/v1/projects` and `GET /api/v1/tasks` require JWT auth, but there is no `POST /api/v1/auth/login`, `POST /api/v1/auth/signup`, or token-refresh endpoint visible. The frontend has no Login screen scaffolded.

10. **Low-confidence clarify response** — The `clarify` intent from the voice command endpoint needs to surface a "Did you mean...?" toast with YES/NO. The API returns this intent, but there is no documented response schema for the `clarify` payload — the frontend needs to know what fields to display.

---

## Gap Analysis Update — Calendar Feature (2026-03-07)

### New API Requirements for Calendar

The Calendar screen requires the following new endpoints that do not currently exist:

| # | Requirement | Endpoint Needed | Status |
|---|---|---|---|
| 1 | List events for a date range | `GET /api/v1/events?start=&end=` | Not built |
| 2 | Create an event | `POST /api/v1/events` | Not built |
| 3 | Update an event | `PUT /api/v1/events/:id` | Not built |
| 4 | Delete an event | `DELETE /api/v1/events/:id` | Not built |
| 5 | Database table: `events` | Columns: id, user_id, title, description, date, start_time, end_time, all_day, project_id (FK nullable), recurrence (enum: none/daily/weekly/monthly), reminder (enum), created_at, updated_at | Not created |
| 6 | AI intent: `create_event` | Gemini function declaration for voice-created events | Not built |
| 7 | AI intent: `query_calendar` | Gemini function declaration for "What's on my calendar?" queries | Not built |

### New API Requirements for Voice Patterns

| # | Requirement | Notes |
|---|---|---|
| 1 | Suggested action pills from AI | The `clarify` and general response intents should return an optional `suggestions[]` array of `{ label, action }` objects. Backend/Logic-AI designer needs to define this in the Gemini function schema |
| 2 | Conversational response type | The voice command endpoint should support a `general_response` intent type for non-action queries. Currently only `create_task`, `update_task`, `create_project`, `clarify` are defined |

---

## Voice Overlay Improvements Needed (2026-03-07)

After reviewing `mobile/src/components/VoiceOverlay.tsx`, the following UX improvements are needed to match the updated spec:

1. **Clarification bubble styling** — Currently, `actionResult` for `clarify` intent is displayed as plain green text (`actionResultText` style). It should use the distinct blue-tinted speech bubble container specified in Section 7.1. The overlay correctly stays in `listening` state, which is good.

2. **Suggested action pills** — Not implemented at all. The overlay has no mechanism to receive or display pill buttons from the AI. Backend needs to send `suggestions[]` in the action payload; frontend needs to render them.

3. **Success card styling** — Currently, success is shown as green text. Should be a styled card with checkmark icon, action title, and detail lines (Section 7.2).

4. **Haptic feedback** — No haptics are triggered on success or error. Need to add `expo-haptics` calls.

5. **Auto-dismiss on success** — The overlay does not auto-dismiss. Section 7.2 specifies a 3-second auto-dismiss with progress bar.

6. **Error card styling** — Currently shows plain text for errors. Should use the red-tinted error card (Section 7.4) with specific error messages based on error type.

7. **General response card** — No distinction between action results and conversational responses. The overlay needs to detect a `general_response` intent and render the AI response card (Section 7.3) with suggested action pills.

8. **Conversation stacking** — Multiple clarification rounds currently overwrite the previous `actionResult`. Should stack previous Q&A pairs in a scrollable transcript area.

---

## Gap Analysis Update — Attachments, Gmail, Housekeeping, Settings (2026-03-07)

### New API Requirements for File Attachments

| # | Requirement | Endpoint Needed | Status |
|---|---|---|---|
| 1 | Upload file to task or project | `POST /api/v1/attachments` (multipart form) | Not built |
| 2 | List attachments for a task | `GET /api/v1/attachments?task_id=` | Not built |
| 3 | List attachments for a project | `GET /api/v1/attachments?project_id=` | Not built |
| 4 | Delete an attachment | `DELETE /api/v1/attachments/:id` | Not built |
| 5 | Download/view attachment | `GET /api/v1/attachments/:id/download` | Not built |
| 6 | Database table: `attachments` | Columns: id, user_id, task_id (FK nullable), project_id (FK nullable), filename, file_type, file_size, storage_url, created_at | Not created |
| 7 | Storage bucket in Supabase | Supabase Storage bucket for file uploads | Not created |
| 8 | AI intent: `attach_file` | Gemini function declaration to open file picker for a task/project | Not built |

### New API Requirements for Gmail Integration

| # | Requirement | Endpoint Needed | Status |
|---|---|---|---|
| 1 | Connect Gmail (OAuth) | `POST /api/v1/gmail/connect` | Not built |
| 2 | Disconnect Gmail | `POST /api/v1/gmail/disconnect` | Not built |
| 3 | Get connection status | `GET /api/v1/gmail/status` | Not built |
| 4 | Create import rule | `POST /api/v1/gmail/rules` | Not built |
| 5 | List import rules | `GET /api/v1/gmail/rules` | Not built |
| 6 | Delete import rule | `DELETE /api/v1/gmail/rules/:id` | Not built |
| 7 | List imported emails | `GET /api/v1/gmail/emails` | Not built |
| 8 | Trigger manual sync | `POST /api/v1/gmail/sync` | Not built |
| 9 | Create task from email | `POST /api/v1/gmail/emails/:id/create-task` | Not built |
| 10 | Database tables: `gmail_connections`, `gmail_rules`, `gmail_emails` | See backend engineer for schema | Not created |
| 11 | AI intents: `query_emails`, `create_task_from_email` | Gemini function declarations | Not built |

### New API Requirements for Board Health

| # | Requirement | Endpoint Needed | Status |
|---|---|---|---|
| 1 | Run health analysis | `GET /api/v1/health-check` | Not built |
| 2 | Batch reschedule overdue tasks | `POST /api/v1/health-check/reschedule` | Not built |
| 3 | Batch archive stale projects | `POST /api/v1/health-check/archive-stale` | Not built |
| 4 | AI intent: `board_health_check` | Gemini function declaration | Not built |

### Frontend Dependencies for New Features

| Feature | Mobile Packages Needed |
|---|---|
| File Attachments | `expo-document-picker`, `expo-file-system` |
| Gmail OAuth | `expo-auth-session`, `expo-web-browser` |
| Board Health | No new packages (uses existing API service layer) |
| Settings Redesign | No new packages |

---

## Frontend Implementation Priority (2026-03-07 10:50am)

Ordered from highest to lowest priority. The first items unblock the core user loop; later items polish and extend.

### Priority 1 — Core Loop (Build First)

1. **API service layer** — Create `src/services/api.ts` with typed fetch wrappers for all existing REST endpoints (projects, tasks, templates, meeting-notes). This must exist before any screen can show real data.

2. **Projects Screen — real data** — Wire `ProjectsScreen.tsx` to `GET /api/v1/projects`. Show a `FlatList` of project cards (title, template badge, task count). Tapping a card navigates to Project Detail. This is the app's home base.

3. **Project Detail Screen (new screen)** — A new screen (`ProjectDetailScreen.tsx`) that renders a project's tasks using the correct template view. Start with the Checklist template (simplest). Must call `GET /api/v1/tasks?projectId=`. Register this screen in `RootNavigator.tsx` as a modal or stack push.

4. **Tasks Screen — real data** — Wire `TasksScreen.tsx` to `GET /api/v1/tasks` (global view, no projectId filter). Render a simple list with title, status badge, and priority indicator.

5. **Voice Overlay — listening state** — The VoiceFAB in `TabNavigator.tsx` currently just `console.log`s on press. Build the voice overlay modal: FAB tap opens a full-screen frosted-glass overlay with "Listening..." state, pulsing waveform animation, and live transcription text (fed from `WS /voice/stream`).

### Priority 2 — Voice → Action Loop

6. **Voice command → intent execution** — After transcription finalises, call `POST /api/v1/voice/command` with the transcript. Parse the returned intent (`create_task`, `update_task`, `create_project`, `clarify`) and execute the corresponding API mutation.

7. **Undo Toast component** — Build the `UndoToast` component: slides down from the top, shows action description, prominent red UNDO button, auto-dismisses after 5 seconds. Wire it to every voice-triggered mutation. For undo, perform the compensating call (delete just-created item, or revert status update).

8. **Clarify flow** — Handle the `clarify` intent: show the same UndoToast UI but with YES/NO buttons and the clarification question text. YES re-submits the command with confirmation; NO dismisses.

### Priority 3 — Meeting Notes

9. **Meeting Notes Screen — real data** — Wire `MeetingNotesScreen.tsx` to `GET /api/v1/meeting-notes`. Render a list of past notes with title and date.

10. **Meeting recording flow** — Add a "Record Meeting" button to `MeetingNotesScreen`. On tap, start audio recording using `expo-av`. Show a timer and waveform. On stop, POST the audio file to `POST /api/v1/voice/transcribe`. Display "Transcribing…" and "Summarizing…" states.

11. **Meeting Note Detail Screen (new screen)** — Show the AI-generated summary (top half) and scrollable transcript (bottom half). Below, render an action items card with swipe-right-to-accept and swipe-left-to-reject. On accept, call `POST /api/v1/tasks` to create the task.

### Priority 4 — Template Views

12. **Kanban template view** — Build the horizontal-scroll Kanban layout for `ProjectDetailScreen`. Columns: To Do, In Progress, Done. Task cards are draggable between columns (use `PUT /api/v1/tasks/:id` to persist status change on drop).

13. **Sprint Board template view** — Build the grouped vertical Sprint Board layout. Groups are expandable/collapsible. Backed by the same task data, grouped by a `sprint` field (note: this field may need to be added to the API — flag for Backend Engineer).

14. **View Options toggle menu** — Implement the "•••" menu in Project Detail headers for toggling sub-features (show subtasks, group by assignees). This is a local UI state toggle; no API changes needed until subtask support is added.

### Priority 5 — Polish & Infrastructure

15. **Offline indicator** — Add the network status hook. Show the cloud-slash icon in the navigation bar when offline. Queue voice commands with a "Offline. Command queued for sync." toast and a pending badge on the indicator.

16. **Create Project modal** — Allow users to create a new project from the Projects Screen (title, description, template picker). Calls `POST /api/v1/projects`. Template choices come from `GET /api/v1/templates`.

17. **Login screen** — Auth is required by the projects and tasks endpoints. Build a simple email/password Login screen. This is currently entirely absent from the scaffold and will block testing on device without a mocked auth token.

18. **Task Detail modal** — Tap a task card → open a modal sheet with full task details (title, description, due date, priority selector, status selector). Edit fields call `PUT /api/v1/tasks/:id`. The `RootNavigator.tsx` already has a `TaskDetailModal` placeholder comment.

---
