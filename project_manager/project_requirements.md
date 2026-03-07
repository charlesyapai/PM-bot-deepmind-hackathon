# 📋 Project Requirements

> **Status:** ✅ Initial requirements received — 2026-03-06

---

## Application Overview

**Personal Project/Task Manager** — a mobile application that serves as a personal project manager and task tracker. The core interaction model is **voice-driven**: the user speaks into the app, and an AI listener interprets the input to create, update, or organize tasks, meeting notes, and project items across customizable template formats.

## Core Features (MVP)

### 1. Voice-Driven AI Input

- User talks into the app to give instructions
- AI listener interprets spoken input and determines the action (create task, update project, log meeting note, etc.)
- The AI decides the appropriate level/context to apply the update

### 2. Customizable Task/Project Templates

- Multiple template formats for task tracking (Kanban, checklist, sprint board, etc.)
- Users can select, switch between, and update templates
- Templates are the primary view for organizing work

### 3. Meeting Note Summarization

- Voice recordings from meetings can be processed by the AI
- AI summarizes meeting notes automatically
- AI proposes action items from meeting summaries
- Proposed actions can be linked to and update the relevant project board

### 4. Project & Task Management

- Create, read, update, delete projects and tasks
- Hierarchical organization (projects → tasks → subtasks)
- Status tracking and progress visibility

### 5. Calendar Events (Promoted from Post-MVP)

- Create, view, edit, delete calendar events
- Events optionally linked to projects
- Agenda-style day view, voice-driven event creation
- Recurrence and reminder support

### 6. Smart AI Assistant

- Context-aware project/task inference (fuzzy matching, duplicate detection)
- Duration & deadline inference from natural language ("this should take 2 days")
- Task refinement suggestions (breaking vague tasks into actionable sub-items)
- Status-aware updates (detects if task is already done, suggests alternatives)

### 7. Housekeeping / Board Health

- AI-driven board health analysis triggered by voice ("clean up my board") or manual button
- Identifies: overdue tasks, stale projects, tasks missing info, past events, upcoming deadlines
- Presents findings conversationally with actionable suggestions

### 8. File Attachments

- Attach files (documents, images, PDFs) to tasks and projects
- Files stored in Supabase Storage, metadata in `attachments` table
- Attachment chips on task cards, download/view on tap
- Local caching via `expo-file-system` for offline access

### 9. Gmail Integration

- Connect Gmail via OAuth2, define email import rules (by sender, label, date range)
- View imported emails, create tasks from emails via voice or UI
- AI can reference email context when managing tasks
- Rules-based auto-import for relevant communications

## Future Features (Post-MVP)

> [!NOTE]
> These are explicitly scoped OUT of the current build but should be considered in the architecture design for extensibility.

- **Multi-user collaboration** — Multiple people working on the same project
- **Cross-app integrations** — Syncing with external productivity tools beyond Gmail
- **Google Calendar sync** — Two-way sync with Google Calendar (beyond internal calendar)
- **Push notifications** — Reminders, deadline alerts, email digest notifications

## Platform

- **Primary:** Mobile phone (iOS and/or Android — TBD)
- **Architecture consideration:** Should support a mobile-first design

## Key UX Principle

The fundamental UX is **conversational/voice-first**. The user should be able to accomplish the majority of task management through voice input alone, with the visual UI serving as the structured display and manual editing layer.

## Constraints & Considerations

- Voice-to-text accuracy and latency are critical to UX
- AI prompt engineering must handle ambiguous voice input gracefully
- Template system should be flexible enough to support various project management methodologies
- Architecture must be extensible for future integrations (calendar, multi-user)

## Milestones

| #   | Milestone                    | Target Date | Status         |
| --- | ---------------------------- | ----------- | -------------- |
| 1   | Project requirements defined | 2026-03-06  | ✅ Done        |
| 2   | Architecture design approved | TBD         | 🔄 In Progress |
| 3   | UX design approved           | TBD         | ⏳ Pending     |
| 4   | MVP implementation complete  | TBD         | ⏳ Pending     |
| 5   | Testing & QA complete        | TBD         | ⏳ Pending     |
| 6   | Documentation complete       | TBD         | ⏳ Pending     |
| 7   | v1.0 release                 | TBD         | ⏳ Pending     |
