# Project Requirements

> **Status:** v1 Complete, v2 In Progress -- 2026-03-07

---

## Application Overview

**Personal Project/Task Manager** -- a mobile application that serves as a personal project manager and task tracker. The core interaction model is **voice-driven**: the user speaks into the app, and an AI listener interprets the input to create, update, or organize tasks, meeting notes, and project items across customizable template formats.

## Core Features (v1 -- COMPLETE)

### 1. Voice-Driven AI Input
- User talks into the app to give instructions
- AI listener (Gemini 2.0 Flash) interprets spoken input via function calling
- Text command fallback for non-voice input
- Deepgram streaming STT for real-time transcription

### 2. Customizable Task/Project Templates
- Multiple template formats (Kanban, Checklist, Sprint)
- 3 seed templates pre-loaded
- Templates linked to projects

### 3. Meeting Note Summarization
- Voice recordings processed by AI
- AI summarizes meeting notes automatically
- AI proposes action items, accept/reject workflow
- Action items auto-create tasks when accepted

### 4. Project & Task Management
- Full CRUD for projects and tasks
- Project archive/restore (soft delete) and hard delete (permanent, cascades tasks)
- Active/Archived project views with sort options
- Task status (todo/in_progress/done), priority (low/medium/high), due dates

### 5. Calendar Events
- Full CRUD with date-range filters and project linking
- Agenda-style day-grouped view
- Voice-driven event creation

### 6. Smart AI Assistant (14 Gemini Function Declarations)
- Context-aware project/task inference (fuzzy matching, duplicate detection)
- Duration & deadline inference from natural language
- Task refinement suggestions
- Status-aware updates
- Batch task creation within projects

### 7. Housekeeping / Board Health
- AI-driven board health analysis (voice: "clean up my board" or manual button)
- Identifies: overdue tasks, stale projects, tasks missing info, past events, upcoming deadlines
- Auto-cleanup intent (archives stale projects, completes past events)

### 8. File Attachments
- Attach files to tasks and projects via Supabase Storage
- Attachment chips on task cards, download/view on tap
- Local caching via expo-file-system

### 9. Gmail Integration (Read-Only)
- Connect Gmail via OAuth2, define email import rules
- View imported emails, create tasks from emails
- AI references email context in conversations

---

## v2 Features (IN PROGRESS -- Google Integration)

> See `architecture_designer/GOOGLE_INTEGRATION_ARCHITECTURE.md` for full technical design.

### 10. Unified Google OAuth
- Single "Connect Google" button covers Gmail + Calendar + Drive
- Scopes: `gmail.readonly`, `gmail.send`, `calendar`, `drive.file`, `userinfo.email`
- Replaces separate Gmail OAuth with unified token storage

### 11. Google Calendar Bidirectional Sync
- App events push to Google Calendar automatically
- Google Calendar events pull into app via incremental sync
- Sync button on CalendarScreen, [GCal]/[App] source badges
- Conflict resolution: last-write-wins

### 12. Google Drive Integration
- Every project gets a Drive folder (auto-created)
- Files tab in ProjectDetailScreen shows Drive contents
- Upload files to project Drive folder from app
- AI can read Drive file content for context in board updates

### 13. Board Update Engine (Compound Operation)
- "Update my board" triggers: email scan + Drive scan + calendar sync + housekeeping + AI synthesis
- Produces structured, conversational status report per project
- Suggested actions the user can tap to execute
- Board update history stored for review

### 14. Dashboard Screen (New Home)
- Replaces ProjectsScreen as Tab 1
- Board Status Card (last update summary)
- Project cards with Drive file count + email activity
- Upcoming events strip (next 48h)
- [Update] button triggers board update

### 15. Gmail Drafts (Send via Draft)
- AI can create Gmail drafts (never sends directly)
- "Draft a reply to that email" -> creates reviewable draft
- User confirms send from Gmail app

### 16. 6 New AI Intents (Total: 20)
- `sync_calendar`, `run_board_update`, `upload_to_drive`, `list_drive_files`, `read_drive_file`, `draft_email`

---

## Future Features (Post-v2)

- **Multi-user collaboration** -- Multiple people working on the same project
- **Push notifications** -- Reminders, deadline alerts, email digest notifications
- **Background sync** -- Scheduled board updates with push notification delivery
- **Offline queue** -- Queue voice commands and sync when back online

## Platform

- **Primary:** iOS (React Native/Expo, development build)
- **Simulator:** iPhone 16e, iOS 26.3
- **Architecture:** Mobile-first design

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo), TypeScript |
| Backend | Node.js, Express.js, port 3000 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT) |
| AI | Google Gemini 2.0 Flash (function calling) |
| STT | Deepgram streaming WebSocket |
| Google APIs | Gmail, Calendar, Drive (v2) |
| Storage | Supabase Storage + Google Drive (v2) |

## Milestones

| # | Milestone | Target Date | Status |
|---|---|---|---|
| 1 | Project requirements defined | 2026-03-07 | Done |
| 2 | Architecture design approved | 2026-03-07 | Done |
| 3 | UX design approved | 2026-03-07 | Done |
| 4 | v1 MVP implementation | 2026-03-07 | Done |
| 5 | v2 Google Integration architecture | 2026-03-07 | Done |
| 6 | v2 Implementation (Phases 1-4) | TBD | In Progress |
| 7 | Testing & QA | TBD | In Progress |
| 8 | Documentation | TBD | Pending |
| 9 | v2.0 release | TBD | Pending |
