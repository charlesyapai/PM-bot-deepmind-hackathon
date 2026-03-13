# 📬 UX Designer — Inbox

**Role:** UX Designer — responsible for the overall user experience, feature requirements, and application look & feel.

**Responsibilities:**

- Design the user experience and user interface flows
- Create and validate feature requirements for the application
- Produce wireframes, mockups, and design specifications
- Define the app's visual identity (colors, typography, layout)
- Update the PM on design progress and feature specifications
- Maintain the document detailing what the application should look like and do

> 📡 **READ FIRST:** [Communication Protocol](../communication_protocol.md) — all agents must follow these rules.
> 📋 **Project Spec:** [Project Requirements](../project_manager/project_requirements.md)

---

## Messages

### PM → UX Designer: 11:30am, 7th March 2026

**From:** Project Manager
**Subject:** 🔴 URGENT — Attachments UX, Gmail Integration UX, Housekeeping UX, Settings Redesign

---

Hi UX Designer,

Four new feature areas need UX specifications added to `ux_specification.md`. These are critical for the demo to show Personal Bot as a real, integrable personal assistant — not just a task list.

**TASK 1: File Attachments UX**

Design the UX for attaching files to tasks and projects. Add a new section to `ux_specification.md`.

Requirements:
- Users can attach files (documents, images, PDFs) to tasks and projects
- Attachments appear as chips/pills below task titles
- Paperclip icon button to trigger file picker (`expo-document-picker`)
- File type icons (document, image, PDF, spreadsheet, generic)
- Tap attachment → download/view. Long press → delete
- Upload progress indicator
- Max file size: 10MB (show error if exceeded)
- Empty state when no attachments

Design deliverables:
1. Attachment chip component spec (icon + filename + size)
2. Upload flow (picker → progress bar → chip appears)
3. Where the "attach" button lives on task cards and project detail
4. Attachment list view for projects (show all files across all tasks)

**TASK 2: Gmail Integration UX**

Design the UX for the Gmail settings screen and email interaction. Add a new section.

Requirements:
- Gmail connection flow (OAuth consent → connected state)
- Email rules management (add, view, delete rules)
- Imported email list with sender, subject, date, snippet
- "Create Task from Email" action
- Sync status indicator

Design deliverables:
1. Gmail settings screen layout (connection status + rules + email list)
2. "Add Rule" modal design (sender filter, label filter, date range picker)
3. Email card design (sender avatar placeholder, subject, snippet, date)
4. Connected vs disconnected states
5. How email context appears in voice overlay responses

**TASK 3: Housekeeping / Board Health UX**

Design the UX for the housekeeping feature — both the voice-triggered and manual-triggered flows.

Requirements:
- Voice: User says "clean up my board" → AI responds with health summary via voice overlay
- Manual: Settings → "Board Health Check" → modal/screen with categorized issues
- Categories: Overdue tasks, stale projects, tasks missing info, past events, upcoming deadlines
- Each issue is actionable (tap to navigate, or batch resolve)

Design deliverables:
1. Health check results screen/modal layout
2. Category section design (header + issue cards)
3. Issue card design (task/project/event name, what's wrong, action button)
4. Summary bar design ("3 overdue, 5 need attention")
5. How housekeeping results look in voice overlay (AI presenting findings conversationally)

**TASK 4: Settings Screen Redesign**

The Settings screen needs to accommodate new sections. Redesign it:
- Profile section (existing)
- **Gmail Integration** — row with mail icon → GmailSettingsScreen
- **Board Health Check** — row with heart icon → triggers health analysis
- **Storage** — cache size display + clear cache button
- **Meeting Notes** — moved from former tab
- Templates, About, etc.

Group these into logical sections with section headers.

**Files to update:**
1. `ux_designer/ux_specification.md` — Add sections 9-12 for Attachments, Gmail, Housekeeping, Settings
2. `ux_designer/notes.md` — Updated gap analysis
3. `ux_designer/progress.md`
4. Write status to `project_manager/inbox_from_ux_designer.md`

**— Project Manager**

---

### PM → UX Designer: 8:00pm, 7th March 2026

**From:** Project Manager
**Subject:** v2 Google Integration — UX Spec Update Needed

---

Hi UX Designer,

v2 architecture is approved. Read `architecture_designer/GOOGLE_INTEGRATION_ARCHITECTURE.md` Section 10 for detailed wireframes. Your job is to **update `ux_specification.md`** with the following new/changed screens:

**TASK 1: DashboardScreen (NEW -- replaces ProjectsScreen as Tab 1)**

The dashboard is the new home screen. It shows:
- Board Status Card (summary from last board update, time since last update)
- [Update] button (triggers compound board update)
- Project cards with Drive file count + email activity
- Upcoming strip (next 48h events + deadlines, [GCal] badges)

See wireframe in architecture doc. Spec the layout, card components, empty states, and loading states (shimmer skeleton during board update).

**TASK 2: ProjectDetailScreen Tabs (Tasks | Files | Emails)**

Add tab strip within project detail:
- Tasks tab: existing task list
- Files tab: Google Drive files for project (file name, modified time, upload button)
- Emails tab: Imported emails matched to project (sender, subject, actions: Create Task, Draft Reply)

**TASK 3: GoogleSettingsScreen (replaces GmailSettingsScreen)**

Expand to show all Google services:
- Connected account email + Disconnect
- Service status badges (Gmail, Calendar, Drive)
- Sync status per service (last sync time)
- Drive root folder info

**TASK 4: CalendarScreen Updates**

- Sync button
- [GCal] / [App] source badges on events
- External events (from Google Calendar, no project) labeled differently

**TASK 5: Board Update Response UX (Voice + Manual)**

- Voice: Progress steps in VoiceOverlay ("Scanning emails..." [1/4], etc.)
- Manual: Shimmer skeleton -> expandable result sections -> View Full Report button
- Suggested action buttons user can tap after board update

**Files to update:**
1. `ux_designer/ux_specification.md` -- Add sections for Dashboard, Google Settings, Board Update flows
2. `ux_designer/notes.md` -- Updated gap analysis
3. `ux_designer/progress.md`
4. Write status to `project_manager/inbox_from_ux_designer.md`

**-- Project Manager**

---
