# 🎨 UX Specifications — Personal Bot

**Author:** UX Designer  
**Date:** 2026-03-07
**Status:** 🔄 Draft v4 — v2 Google Integration: Dashboard, Board Update, Calendar Sync, Project Files

---

## 1. Design System Spec (iOS-First)

### Typography

- **Primary Font:** San Francisco (SF Pro) — standard iOS typography for high legibility
- **Heading 1:** 34pt, Bold (Screen Titles)
- **Heading 2:** 28pt, Semibold (Section Headers)
- **Body:** 17pt, Regular (Tasks, Notes)
- **Caption:** 13pt, Regular (Timestamps, Status Tags)

### Color Palette

- **Primary:** iOS System Blue (`#007AFF`)
- **Background (Light Mode):** System Grouped Background (`#F2F2F7`)
- **Card Background:** White (`#FFFFFF`)
- **Text (Primary):** Black (`#000000`)
- **Text (Secondary):** System Gray (`#8E8E93`)
- **Danger (Destructive/Undo):** System Red (`#FF3B30`)
- **Success:** System Green (`#34C759`)
- **Warning:** System Orange (`#FF9500`)

### Spacing & Layout

- **Grid:** 8px baseline grid
- **Margins:** 16px horizontal margins for safe areas
- **Rounded Corners:** 12px for cards and modals, matching iOS styling

---

## 2. Core Screen Map & Navigation Flow

### Bottom Tab Navigation (Main Structure)

1. **📊 Dashboard:** Command center showing board status, projects with Google metadata, and upcoming events (replaces the former Projects tab; project list is now a section within Dashboard)
2. **✅ Tasks:** Global view of tasks
3. **🎙️ Voice (Center/Prominent):** Not a screen, but a floating, large action button (FAB) accessible from every tab. Tapping invokes the voice listening overlay.
4. **📅 Calendar:** Agenda-style day view of scheduled events with Google Calendar sync badges
5. **⚙️ Settings:** Profile, Google integration, board health, meeting notes, and offline settings

> **Tab bar change note (v2):** The "Notes/Meetings" tab has been replaced by "Calendar". Meeting Notes are relocated under Settings > Meeting Notes, or accessible contextually within a project. This keeps the tab bar focused on the four daily-use surfaces: projects, tasks, voice, and calendar.

### Screen Hierarchy

- `Projects Screen` → `Project Detail (Template View)` → `Task Detail (Modal)`
- `Calendar Screen` → `Event Detail (Modal)` / `Create Event (Modal)`
- `Meeting Notes Screen` (via Settings) → `Meeting Note Detail (Transcript + Actions)`

---

## 3. Voice Interaction Flow (With AI Undo UX)

### Interaction States

- **Idle:** Microphone FAB rests at bottom center.
- **Listening:** User taps/holds FAB. FAB expands, pulsing animation (Siri-like or waveform) starts. "Listening..." text appears.
- **Transcribing:** Real-time text streams onto the screen (via Deepgram WebSocket) over a frosted glass overlay.
- **Processing:** Waveform turns into a spinning/loading state (< 2.5s latency).
- **Execution:** AI identifies intent, UI dismisses overlay immediately.

### Error Recovery & Undo (CRITICAL)

- **Immediate Execution:** The action happens without confirmation dialogs.
- **The "Undo Toast":** A highly visible toast notification drops from the top of the screen (e.g., "Created task: 'Buy milk' in Personal").
  - Contains a prominent **[UNDO]** button in system red.
  - Toast persists for 5 seconds before disappearing.
- **Low Confidence Flow:** If intent is unclear, the Toast says: "Did you mean to create a task for 'Buy milk'?" with **[YES]** and **[NO]** buttons.

---

## 4. Template View Wireframes (Kanban, Checklist, Sprint)

### Shared Elements

- All templates have a title header, sync/offline indicator, and a filter row.
- **Toggle Feature UI:** A "View Options" menu (top right •••) allows toggling sub-features ON/OFF natively without swapping templates (e.g., toggling "Show subtasks", "Group by assignees").

### A. Kanban Template

- Horizontal scrolling columns (To Do, In Progress, Done).
- Cards represent tasks (Title, small Due Date tag).
- Drag-and-drop support: Long press to lift card, drag laterally between columns.

### B. Checklist Template

- Simple vertical list of tasks.
- Checkbox to the left of each item.
- Tapping checkbox crosses out the text and moves it to a "Completed" section at the bottom.

### C. Sprint Board Template

- Combines Checklist + Kanban.
- Grouped vertically by "Sprint 1", "Sprint 2" or "Backlog".
- Each group can expand/collapse.

---

## 5. Meeting Notes Flow

### Recording Phase

- Dedicated "Record Meeting" button.
- Clean timer and waveform.
- Maximum duration limit: warning UI appears at 105 minutes, auto-stop at 120 minutes.

### Summarization Phase

- Offline badge: "Transcribing..." and "Summarizing..."
- Split-screen view:
  - **Top Half:** AI-generated summary bullet points.
  - **Bottom Half:** Scrolling transcript.

### Action Items Review

- A dedicated card pop-up labeled "✨ 3 Action Items Found".
- Shows actionable tasks proposed by GPT-4o.
- Swiping right on an item = Accepts and adds to project.
- Swiping left = Rejects.

---

## 6. Calendar Screen

### Overview

The Calendar screen provides an agenda-style day view of scheduled events. It is the fourth tab in the bottom navigation (Calendar icon from `lucide-react-native`). The design prioritizes quick scanning of today's schedule and fast event creation via voice or the `+` button.

### Screen Layout

```
+------------------------------------------+
|  Calendar                         [+]    |   <- Screen title (H1, 34pt Bold) + FAB-style add button
|------------------------------------------|
|  < Thu, Mar 7, 2026 >                    |   <- Date selector strip (swipeable, today highlighted)
|------------------------------------------|
|  9:00 AM                                 |
|  +--------------------------------------+|
|  | Team Standup             9:00-9:30   ||   <- Event card
|  | [Project: Sprint 4]     * In 15 min  ||   <- Project tag + proximity badge
|  +--------------------------------------+|
|                                          |
|  12:00 PM                                |
|  +--------------------------------------+|
|  | Lunch with Sarah        12:00-1:00   ||
|  | No project                           ||
|  +--------------------------------------+|
|                                          |
|  ALL DAY                                 |   <- All-day section pinned to top of list
|  +--------------------------------------+|
|  | Q1 Planning Deadline                 ||
|  | [Project: Roadmap]        All Day    ||
|  +--------------------------------------+|
+------------------------------------------+
```

**Layout rules:**

- **Date selector strip:** A horizontally scrollable row of dates. Today is highlighted with the primary blue circle. Tapping a date scrolls the agenda to that day. Left/right chevrons allow quick day navigation.
- **Time slots:** Events are grouped under their start time (e.g., "9:00 AM"). Times use Caption style (13pt, Regular, `textSecondary` color).
- **All-day events:** Rendered in a pinned section at the top of the agenda, above timed events. Labeled "ALL DAY" in Caption style.
- **Pull-to-refresh:** Standard iOS pull-to-refresh to sync events from the server.
- **Scroll behavior:** The list auto-scrolls to the current or next upcoming event on screen load.

### Event Card Design

Each event is rendered as a card with the following structure:

| Element | Style | Details |
|---|---|---|
| **Title** | Body (17pt, Semibold) | Event title, single line, truncated with ellipsis if too long |
| **Time range** | Body (15pt, Regular) | e.g., "9:00 AM - 10:30 AM". For all-day events, display "All Day" in `textSecondary` color |
| **Project tag** | Caption (13pt, Regular) | Shown as a rounded pill: `[Project: Name]` with `backgroundLight` fill and `primary` text. Omitted if no project linked |
| **Status dot** | 8px circle | Left edge of card. Colors: `primary` (upcoming), `success` (completed/past), `warning` (starting within 30 min) |
| **Proximity badge** | Caption (13pt, Regular) | Only shown for events starting within 60 minutes: "In 15 min", "Starting now". Uses `warning` color |

**Card styling:**
- Background: `cardBackground` (#FFFFFF)
- Border radius: 12px
- Padding: 16px horizontal, 12px vertical
- Shadow: subtle iOS-standard drop shadow (0px 2px 4px rgba(0,0,0,0.08))
- Left border accent: 4px wide, colored by the linked project's color (or `primary` blue if no project)
- Margin between cards: 8px

**Interactions:**
- **Tap:** Opens Event Detail modal (view/edit)
- **Long press:** Shows context menu (Edit, Delete, Duplicate)
- **Swipe left:** Reveals red "Delete" action (with confirmation alert)

### Create Event Modal

Triggered by the `+` button in the top right corner or via voice command. Presented as a bottom sheet modal (iOS `.pageSheet` style).

```
+------------------------------------------+
|  New Event                    [Cancel]   |
|------------------------------------------|
|                                          |
|  Title *                                 |
|  [______________________________________]|
|                                          |
|  All Day                          [OFF]  |   <- Toggle switch
|                                          |
|  Date         [Thu, Mar 7, 2026      v]  |   <- Date picker (iOS wheel)
|  Start Time   [9:00 AM              v]   |   <- Time picker (hidden if All Day)
|  End Time     [10:00 AM             v]   |   <- Time picker (hidden if All Day)
|                                          |
|  Project      [None                  v]  |   <- Picker: list of user's projects
|                                          |
|  Description                             |
|  [______________________________________]|
|  [______________________________________]|
|                                          |
|  Recurrence   [None                  v]  |   <- Options: None, Daily, Weekly, Monthly
|  Reminder     [None                  v]  |   <- Options: None, 5 min, 15 min, 30 min, 1 hour
|                                          |
|           [ Create Event ]               |   <- Primary blue button, full width
+------------------------------------------+
```

**Field specifications:**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Title | Text input | Yes | Empty | Max 100 characters. Validation: cannot be empty |
| All Day | Toggle | No | OFF | When ON, hides Start/End Time pickers |
| Date | Date picker | Yes | Today | iOS-native date wheel picker |
| Start Time | Time picker | Yes (if not all-day) | Next rounded hour | iOS-native time wheel, 15-min increments |
| End Time | Time picker | Yes (if not all-day) | Start + 1 hour | Must be after Start Time. Validation error shown inline |
| Project | Picker | No | None | Dropdown populated from `GET /api/v1/projects`. "None" is always first option |
| Description | Multi-line text | No | Empty | Max 500 characters. 3-line visible area |
| Recurrence | Picker | No | None | Options: None, Daily, Weekly, Monthly |
| Reminder | Picker | No | None | Options: None, At time of event, 5 min before, 15 min before, 30 min before, 1 hour before |

**Validation behavior:**
- Title empty: red border on field, inline error text "Title is required"
- End Time before Start Time: inline error "End time must be after start time"
- Create button is disabled (opacity 0.4) until all required fields are valid

**Create button:** Full-width, 50px height, `primary` blue background, white text (17pt, Semibold), 12px border radius. On press, calls `POST /api/v1/events`, dismisses modal, and scrolls agenda to the new event.

### Empty State

When the user has no events for the selected day:

```
+------------------------------------------+
|                                          |
|              [Calendar icon]             |   <- 48px, textSecondary color
|                                          |
|       No events scheduled today.         |   <- Body (17pt), textSecondary
|    Use voice or tap + to add one.        |   <- Caption (13pt), textSecondary
|                                          |
+------------------------------------------+
```

The empty state is vertically centered in the scroll area below the date selector strip. The calendar icon uses the same `Calendar` icon from `lucide-react-native` at 48px, colored `textSecondary`.

### Voice Integration

Voice commands targeting the calendar are handled by the existing voice pipeline. Example utterances:

- "Schedule a meeting tomorrow at 3pm" -> creates event with title "Meeting", date = tomorrow, start = 3:00 PM, end = 4:00 PM
- "Add an all-day event on Friday called Q1 Review" -> creates all-day event
- "What's on my calendar today?" -> AI responds with a summary of today's events in the voice overlay

The AI intent parser should support a `create_event` function declaration with parameters: `title`, `date`, `start_time`, `end_time`, `all_day`, `project_name`, `description`.

---

## 7. Voice Assistant UX Patterns

This section specifies the detailed UX patterns for voice interaction states beyond the basic listening/processing/done flow defined in Section 3.

### 7.1 Clarification Flow

When the AI needs more information (returns a `clarify` intent), the overlay stays in listening mode so the user can respond immediately.

**Display behavior:**

```
+------------------------------------------+
|                                          |
|  +--------------------------------------+|
|  | "Buy milk"                           ||   <- User's original transcript
|  +--------------------------------------+|
|                                          |
|  +--------------------------------------+|
|  |  [AI icon]                           ||   <- Clarification bubble
|  |  Which project should I add this     ||
|  |  task to?                            ||
|  |                                      ||
|  |  [Personal]  [Work]  [Groceries]     ||   <- Suggested project pills (if available)
|  +--------------------------------------+|
|                                          |
|  Listening for your answer...            |   <- Updated status text
|                                          |
|          ( pulsing mic )                 |   <- Mic stays in listening state
+------------------------------------------+
```

**Specifications:**

- **Clarification bubble:** A distinct container styled differently from the transcript box to clearly indicate this is the AI speaking, not the user.
  - Background: `rgba(0, 122, 255, 0.15)` (primary blue tint)
  - Border: 1px solid `rgba(0, 122, 255, 0.3)`
  - Border radius: 16px (with a small 8px speech-bubble tail pointing down toward the mic)
  - Padding: 16px
  - Text: White, 17pt, Regular weight
  - AI icon: Small robot or sparkle icon (16px) in the top-left corner of the bubble, colored `primary`

- **Status text** changes to "Listening for your answer..." (italicized) instead of the default "Listening..."

- **Mic remains pulsing** in its listening state (blue, animated). The WebSocket connection stays open.

- **Suggested action pills** (optional): If the AI can provide enumerable options (e.g., project names), render them as tappable pills below the question text.
  - Pill style: 32px height, `rgba(255,255,255,0.15)` background, 1px white border at 30% opacity, 16px border radius, 12px horizontal padding
  - Text: 14pt, white, Medium weight
  - Tapping a pill sends the selection as a text command through the WebSocket (equivalent to the user saying the option name)

- **Conversation stacking:** If the AI asks multiple clarifications in sequence, previous Q&A pairs scroll up in the transcript area. Only the latest clarification bubble is visually prominent.

### 7.2 Success Feedback

When the AI successfully executes an action (mic turns green, `status === 'done'`):

**Display behavior:**

```
+------------------------------------------+
|                                          |
|  +--------------------------------------+|
|  | "Add buy milk to my grocery list"    ||   <- Original transcript
|  +--------------------------------------+|
|                                          |
|  +--------------------------------------+|
|  |  [checkmark]  Task created!          ||   <- Success result card
|  |  "Buy milk" added to Groceries       ||
|  |  Priority: Medium                    ||
|  +--------------------------------------+|
|                                          |
|          ( green mic, static )           |   <- Green mic, no pulse
|                                          |
|          [ Done ]                        |
+------------------------------------------+
```

**Specifications:**

- **Mic color:** `success` green (#34C759). Pulse animation stops. The mic shows a static checkmark icon instead of wave bars.
- **Success result card:**
  - Background: `rgba(52, 199, 89, 0.15)` (success green tint)
  - Border: 1px solid `rgba(52, 199, 89, 0.3)`
  - Border radius: 12px
  - Padding: 16px
  - Checkmark icon: 20px, `success` green, left of the title text
  - Title line: "Task created!" / "Project created!" / "Event scheduled!" in 17pt, Semibold, white
  - Detail line(s): specifics of what was created, 15pt, Regular, `rgba(255,255,255,0.7)`

- **Haptic feedback:** Trigger a subtle success haptic (`Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` from `expo-haptics`) when the success state is reached. This gives tactile confirmation without being intrusive.

- **Auto-dismiss:** The overlay auto-dismisses after 3 seconds if the user does not interact. A small countdown indicator (thin progress bar at the top of the content area, `success` green, shrinking over 3 seconds) shows the auto-dismiss timing. Tapping anywhere cancels auto-dismiss.

- **Undo availability:** The Undo Toast (Section 3) appears simultaneously behind the overlay. When the overlay dismisses, the Undo Toast is already visible and its 5-second timer has started.

### 7.3 General / Conversational Responses

When the AI responds with information rather than an action (e.g., "What's on my calendar today?" or "How many tasks do I have?"):

**Display behavior:**

```
+------------------------------------------+
|                                          |
|  +--------------------------------------+|
|  | "What's on my calendar today?"       ||   <- User transcript
|  +--------------------------------------+|
|                                          |
|  +--------------------------------------+|
|  |  You have 3 events today:            ||   <- AI response card
|  |                                      ||
|  |  * Team Standup at 9:00 AM           ||
|  |  * Lunch with Sarah at 12:00 PM     ||
|  |  * Design Review at 3:00 PM         ||
|  |                                      ||
|  |  [View Calendar]  [Add Event]        ||   <- Suggested action pills
|  +--------------------------------------+|
|                                          |
|          ( blue mic, static )            |   <- Blue mic, not pulsing
|                                          |
|          [ Done ]                        |
+------------------------------------------+
```

**Specifications:**

- **AI response card:**
  - Background: `rgba(255, 255, 255, 0.12)`
  - Border: 1px solid `rgba(255, 255, 255, 0.2)`
  - Border radius: 12px
  - Padding: 16px
  - Text: White, 16pt, Regular weight, line height 24px
  - Max height: 200px with internal scroll if content overflows

- **Suggested action pills:** Rendered below the response text, horizontally scrollable if they overflow.
  - Same pill styling as clarification pills (Section 7.1)
  - Actions map to navigation or voice commands:
    - "View Calendar" -> navigates to Calendar tab and dismisses overlay
    - "Add Event" -> opens Create Event modal and dismisses overlay
    - "View Project" -> navigates to the referenced project
  - Maximum 3 pills shown. If the AI returns more, show only the first 3.

- **Mic state:** Returns to `primary` blue, static (no pulse). Tapping the mic restarts a new listening session.

### 7.4 Error States

When the voice pipeline encounters an error (connection failure, AI parsing error, timeout):

**Display behavior:**

```
+------------------------------------------+
|                                          |
|  +--------------------------------------+|
|  | Sorry, something went wrong.         ||   <- Error message
|  | Could not connect to voice service.  ||
|  +--------------------------------------+|
|                                          |
|          ( red mic, static )             |   <- Red mic with "!" icon
|                                          |
|       Tap mic to try again               |   <- Help text
|                                          |
|          [ Done ]                        |
+------------------------------------------+
```

**Specifications:**

- **Mic color:** `danger` red (#FF3B30). No pulse animation. Shows "!" icon (exclamation mark) instead of wave bars.
- **Error message card:**
  - Background: `rgba(255, 59, 48, 0.15)` (danger red tint)
  - Border: 1px solid `rgba(255, 59, 48, 0.3)`
  - Border radius: 12px
  - Padding: 16px
  - Text: White, 16pt, Regular weight

- **Error types and messages:**
  | Error Type | Message |
  |---|---|
  | WebSocket connection failed | "Could not connect to voice service. Make sure you are online and try again." |
  | Mic permission denied | "Microphone access is required. Please enable it in Settings." |
  | AI processing timeout (>10s) | "Taking too long. Please try again with a shorter command." |
  | AI could not parse intent | "I didn't understand that. Try rephrasing your command." |
  | Server error (5xx) | "Something went wrong on our end. Please try again in a moment." |

- **Retry behavior:** Tapping the red mic button resets the overlay to listening state and reconnects the WebSocket. The error card is cleared.

- **Haptic feedback:** Trigger an error haptic (`Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)` from `expo-haptics`) when the error state is reached.

---

## 8. Offline UX Patterns

- **Offline Indicator:** A small, unintrusive `☁️` icon with a slash through it placed in the top navigation bar next to the title when the device loses connection.
- **Read-Only vs Cached Writes:**
  - Standard items can be viewed offline.
  - If a user triggers a voice command offline, a toast appears: "Offline. Command queued for sync."
  - The offline indicator will show a badge (e.g., "3 pending") until it connects and syncs.

---

## 9. File Attachments

### Overview

Users can attach files (documents, images, PDFs, spreadsheets) to tasks and projects. Attachments are displayed as compact chips/pills and managed through a standard file picker (`expo-document-picker`). Max file size: 10MB.

### 9.1 Attachment Chip Component

Each attachment is rendered as a horizontal chip/pill:

```
+-------------------------------------------+
| [icon] report.pdf              1.2 MB  [x] |
+-------------------------------------------+
```

**Chip specifications:**

| Element | Style | Details |
|---|---|---|
| **File type icon** | 16px, `textSecondary` color | Icons by type (see table below) |
| **Filename** | 14pt, Regular, `textPrimary` | Single line, truncated with ellipsis at 20 characters |
| **File size** | 13pt, Regular, `textSecondary` | Formatted: "1.2 MB", "340 KB" |
| **Remove button** | 14px "X" icon, `textSecondary` | Only visible in edit mode / owner context |

**Chip styling:**
- Background: `backgroundLight` (#F2F2F7)
- Border: 1px solid `border` (#C6C6C8)
- Border radius: 8px
- Height: 36px
- Padding: 8px horizontal, 0px vertical (vertically centered content)
- Margin between chips: 8px horizontal, 8px vertical (flex-wrap layout)
- Gap between icon and filename: 6px
- Gap between filename and size: 8px

**File type icons** (from `lucide-react-native`):

| File Type | Icon | Extensions |
|---|---|---|
| Document | `FileText` | .doc, .docx, .txt, .rtf |
| Image | `Image` | .jpg, .jpeg, .png, .gif, .webp |
| PDF | `FileText` (red tint) | .pdf |
| Spreadsheet | `Sheet` | .xls, .xlsx, .csv |
| Generic | `File` | All other extensions |

**Interactions:**
- **Tap:** Opens file preview (images inline, documents/PDFs via system viewer using `expo-sharing` / `Linking.openURL`)
- **Long press:** Shows context menu with options: "View", "Share", "Delete" (delete in `danger` red)
- **Swipe left (in list view):** Reveals red "Delete" action button

### 9.2 Upload Flow

When the user triggers the attach action, the following sequence occurs:

```
Step 1: File Picker         Step 2: Uploading            Step 3: Complete

[Paperclip] Attach          [icon] photo.jpg             [icon] photo.jpg    2.1 MB
       |                     [===========-----]  73%
       v                     Uploading...                  Upload complete!
  System file picker                                       (chip appears in list)
  opens (expo-document-picker)
```

**Upload progress chip (during upload):**

```
+-------------------------------------------+
| [icon] photo.jpg                           |
| [================-------]  73%            |
+-------------------------------------------+
```

- Progress bar: 4px height, `primary` blue fill on `backgroundLight` track, positioned below the filename
- Percentage text: 13pt, Regular, `textSecondary`, right-aligned
- Chip background: `cardBackground` (#FFFFFF)
- Border: 1px dashed `primary` (#007AFF) to distinguish from completed uploads
- Cancel upload: Tap the chip during upload to show "Cancel upload?" alert (standard iOS alert)

**Error states:**
- **File too large (>10MB):** Inline error toast: "File exceeds 10MB limit. Choose a smaller file." in `danger` red. File picker remains open.
- **Upload failure (network):** The chip shows a red `AlertCircle` icon and text "Upload failed. Tap to retry." Tapping retries the upload.
- **Unsupported type:** Toast: "This file type is not supported." (if backend rejects it)

### 9.3 Attach Button Placement

**On Task Cards (Project Detail Screen):**

```
+------------------------------------------+
| [checkbox] Buy groceries                  |
|   Due: Mar 10  |  Priority: Medium        |
|   [icon] list.pdf  340KB                  |  <- Attachment chips below metadata
|   [Paperclip] Attach                      |  <- Attach button, only in expanded/detail view
+------------------------------------------+
```

- The paperclip attach button appears in the **Task Detail Modal** (not on collapsed task cards in list view)
- On collapsed task cards, a small `Paperclip` icon (14px) with a count badge (e.g., "2") appears at the trailing edge if attachments exist
- Attach button: `Paperclip` icon (20px) + "Attach" text (15pt, Regular, `primary` blue), left-aligned, 44px tap target height

**On Project Detail Screen (header area):**

```
+------------------------------------------+
| < Back    Sprint 4              [...]     |
|------------------------------------------|
| Attachments (3)              [Paperclip+] |  <- Section header with add button
| [icon] spec.pdf  2.1MB                    |
| [icon] mockup.png  890KB                  |
| [icon] notes.docx  120KB                  |
+------------------------------------------+
```

- Project-level attachments appear as a collapsible section below the project header
- Section header: "Attachments" in 15pt Semibold, `textPrimary`, with count in parentheses
- Add button: `Paperclip` icon with `+` overlay (20px), colored `primary`, right-aligned in section header
- Collapsed state: Shows "Attachments (3)" with a chevron-right icon; tap to expand

### 9.4 Project Attachment List View

A dedicated view showing all attachments across all tasks in a project, accessible from the project `...` menu as "View All Attachments".

```
+------------------------------------------+
| < Back    All Attachments         [Sort]  |
|------------------------------------------|
|  Task: Buy groceries                      |  <- Task grouping header
|  +--------------------------------------+|
|  | [FileText] list.pdf         340 KB   ||
|  | Added Mar 5, 2026                    ||
|  +--------------------------------------+|
|  +--------------------------------------+|
|  | [Image] receipt.jpg         1.2 MB   ||
|  | Added Mar 6, 2026                    ||
|  +--------------------------------------+|
|                                          |
|  Task: Design review                     |
|  +--------------------------------------+|
|  | [FileText] mockup.pdf      2.1 MB   ||
|  | Added Mar 7, 2026                    ||
|  +--------------------------------------+|
|                                          |
|  Project Files (not linked to a task)    |
|  +--------------------------------------+|
|  | [Sheet] budget.xlsx        890 KB    ||
|  | Added Mar 4, 2026                    ||
|  +--------------------------------------+|
+------------------------------------------+
```

**Layout specs:**
- Grouped by task name, with "Project Files" group for project-level attachments
- Group header: 15pt, Semibold, `textPrimary`, 16px left margin, 24px top margin
- Attachment rows: Full-width cards, `cardBackground`, 12px border radius, 16px padding
- File icon: 24px, colored by type (PDF=`danger`, Image=`primary`, Spreadsheet=`success`, others=`textSecondary`)
- Filename: 17pt, Regular, `textPrimary`
- File size: 15pt, Regular, `textSecondary`, right-aligned
- Date added: 13pt, Regular, `textSecondary`, below filename
- Sort options (via [Sort] button): "By date (newest)", "By date (oldest)", "By size", "By type"
- Margin between rows: 8px

**Interactions:**
- Tap row: Opens file preview
- Swipe left: Delete action (with confirmation)
- Long press: Context menu (View, Share, Delete)

### 9.5 Empty State

When a task or project has no attachments:

```
+------------------------------------------+
|                                          |
|            [Paperclip icon]              |  <- 48px, textSecondary
|                                          |
|         No attachments yet.              |  <- Body (17pt), textSecondary
|      Tap the paperclip to add files.     |  <- Caption (13pt), textSecondary
|                                          |
+------------------------------------------+
```

Vertically centered within the attachments section. `Paperclip` icon from `lucide-react-native`, 48px, `textSecondary` color.

### 9.6 Voice Integration

Voice commands can reference attachments in context:

- "Attach a file to the design review task" -> Opens file picker with the target task pre-selected
- "How many attachments does the Sprint 4 project have?" -> AI responds with count and file names
- "Show me all files in my project" -> Navigates to the Project Attachment List View

The AI intent parser should support an `attach_file` function declaration with parameters: `task_id` (optional), `project_id`. Since file picking requires user interaction, the voice command opens the picker rather than uploading directly.

---

## 10. Gmail Integration

### Overview

Gmail integration allows users to connect their Gmail account, define rules for importing relevant emails, view imported emails within the app, and create tasks from emails. Emails also become available as context for voice commands (e.g., "What did Sarah email me about?").

### 10.1 Gmail Settings Screen

Accessed from Settings > Gmail Integration. This is a full screen pushed onto the navigation stack.

**Connected State:**

```
+------------------------------------------+
| < Settings     Gmail            [Sync]   |
|------------------------------------------|
|  +--------------------------------------+|
|  | [Mail icon]  charles@gmail.com       ||  <- Connected account
|  | Connected                  [Disconnect]|  <- Status + disconnect button
|  | Last synced: 2 min ago               ||
|  +--------------------------------------+|
|                                          |
|  IMPORT RULES                    [+ Add] |  <- Section header
|  +--------------------------------------+|
|  | From: sarah@company.com              ||  <- Rule card
|  | Label: Work                          ||
|  |                              [Delete] ||
|  +--------------------------------------+|
|  +--------------------------------------+|
|  | From: *@client.io                    ||
|  | Label: Any                           ||
|  |                              [Delete] ||
|  +--------------------------------------+|
|                                          |
|  IMPORTED EMAILS                         |  <- Section header
|  +--------------------------------------+|
|  | [Avatar] Sarah Chen                  ||  <- Email card
|  | RE: Q1 Budget Review                ||
|  | Hey, attached is the updated...      ||
|  | Mar 7, 2026  2:30 PM     [-> Task]  ||
|  +--------------------------------------+|
|  +--------------------------------------+|
|  | [Avatar] Mike T.                     ||
|  | Sprint 4 Kickoff Notes              ||
|  | Hi team, here are the notes from...  ||
|  | Mar 6, 2026  11:15 AM    [-> Task]  ||
|  +--------------------------------------+|
+------------------------------------------+
```

**Layout specs:**

- **Account card:** `cardBackground`, 12px border radius, 16px padding
  - Mail icon: `Mail` from `lucide-react-native`, 24px, `primary`
  - Email address: 17pt, Semibold, `textPrimary`
  - "Connected" label: 13pt, Regular, `success` green
  - "Last synced" text: 13pt, Regular, `textSecondary`
  - Disconnect button: Text button, 15pt, `danger` red. Tap shows confirmation alert: "Disconnect Gmail? Your imported emails will be kept but no new emails will sync."
  - Sync button (top right): `RefreshCw` icon, 20px, `primary`. Tap triggers manual sync with spinning animation

- **Section headers:** 13pt, Semibold, `textSecondary`, uppercase, 16px left margin, 24px top margin, 8px bottom margin (standard iOS grouped list style)

**Disconnected State:**

```
+------------------------------------------+
| < Settings     Gmail                     |
|------------------------------------------|
|                                          |
|             [Mail icon]                  |  <- 64px, primary blue
|                                          |
|       Connect your Gmail account         |  <- 20pt, Semibold, textPrimary
|                                          |
|    Import emails and create tasks        |  <- 15pt, Regular, textSecondary
|    from your inbox automatically.        |
|                                          |
|       [ Connect with Google ]            |  <- Primary blue button
|                                          |
|    We only read emails matching your     |  <- 13pt, Regular, textSecondary
|    import rules. You can disconnect      |
|    at any time.                           |
|                                          |
+------------------------------------------+
```

- "Connect with Google" button: Full-width (minus 32px margins), 50px height, `primary` blue background, white text 17pt Semibold, 12px border radius
- Tap initiates OAuth flow (opens system browser for Google consent)
- Privacy note below button: 13pt, Regular, `textSecondary`, center-aligned, max 280px width

**OAuth Flow:**
1. Tap "Connect with Google" -> System browser opens Google OAuth consent screen
2. User authorizes -> Redirect back to app
3. Screen updates to Connected State with a success toast: "Gmail connected successfully"
4. Initial sync begins automatically (show spinning sync icon)

### 10.2 Add Rule Modal

Triggered by the [+ Add] button in the Import Rules section. Presented as a bottom sheet modal.

```
+------------------------------------------+
| Add Import Rule               [Cancel]   |
|------------------------------------------|
|                                          |
|  Sender Filter                           |
|  [______________________________________]|  <- Text input
|  e.g., sarah@company.com or *@client.io  |  <- Placeholder hint
|                                          |
|  Gmail Label                             |
|  [Any                               v]  |  <- Picker
|                                          |
|  Date Range                              |
|  From:  [None                        v]  |  <- Date picker (optional)
|  To:    [None                        v]  |  <- Date picker (optional)
|                                          |
|  Subject Contains                        |
|  [______________________________________]|  <- Text input (optional)
|  e.g., "invoice" or "meeting notes"      |
|                                          |
|            [ Save Rule ]                 |
+------------------------------------------+
```

**Field specifications:**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Sender Filter | Text input | No | Empty | Supports wildcards: `*@domain.com`. If empty, matches all senders |
| Gmail Label | Picker | No | "Any" | Options populated from user's Gmail labels + "Any" (default) |
| Date Range From | Date picker | No | None | Only import emails after this date |
| Date Range To | Date picker | No | None | Only import emails before this date |
| Subject Contains | Text input | No | Empty | Case-insensitive substring match |

- At least one filter field must be filled (cannot save a completely empty rule)
- Validation: If all fields empty, "Save Rule" is disabled (opacity 0.4) with inline hint: "Add at least one filter"
- Save Rule button: Same style as Create Event button (full-width, 50px, `primary`, 12px radius)
- On save: Modal dismisses, rule card appears in list, sync triggers for matching emails

### 10.3 Email Card Design

Each imported email is displayed as a card in the Imported Emails section:

```
+------------------------------------------+
| [AV]  Sarah Chen               2:30 PM  |  <- Avatar + sender + time
|       RE: Q1 Budget Review               |  <- Subject line (bold)
|       Hey, attached is the updated       |  <- Snippet (2 lines max)
|       budget spreadsheet for...          |
|                              [-> Task]   |  <- Action button
+------------------------------------------+
```

**Card specifications:**

| Element | Style | Details |
|---|---|---|
| **Avatar** | 36px circle | Sender initials on `backgroundLight`, 15pt Semibold `primary` text. If profile image available, show image |
| **Sender name** | 15pt, Semibold, `textPrimary` | Truncated at 20 chars |
| **Time/date** | 13pt, Regular, `textSecondary` | Today: "2:30 PM". Older: "Mar 6" |
| **Subject** | 15pt, Medium, `textPrimary` | Single line, truncated with ellipsis |
| **Snippet** | 14pt, Regular, `textSecondary` | Max 2 lines, truncated |
| **Action button** | "-> Task" text, 13pt, `primary` | Tappable, creates task from email |

**Card styling:**
- Background: `cardBackground` (#FFFFFF)
- Border radius: 12px
- Padding: 12px horizontal, 12px vertical
- Shadow: 0px 2px 4px rgba(0,0,0,0.08)
- Margin between cards: 8px
- Left margin for text (after avatar): 48px (36px avatar + 12px gap)

**Interactions:**
- **Tap card:** Expands to show full email body in a detail modal (scrollable text, "Create Task" full button at bottom)
- **Tap "-> Task":** Opens a pre-filled task creation modal with:
  - Title: Email subject line
  - Description: Email snippet (first 200 chars)
  - Source tag: "From Gmail" pill in `primary` tint
- **Swipe left:** "Archive" action (removes from imported list, does not delete from Gmail)
- **Long press:** Context menu: "Create Task", "View in Gmail" (opens Gmail app/browser), "Archive"

### 10.4 Sync Status Indicator

A subtle status bar at the top of the Gmail screen during sync:

```
+------------------------------------------+
| [spinning] Syncing emails...       3/12  |  <- Sync progress
|------------------------------------------|
```

- Background: `rgba(0, 122, 255, 0.08)`
- Height: 32px
- Icon: `RefreshCw` spinning animation, 16px, `primary`
- Text: 13pt, Regular, `primary`
- Count: "3/12" showing progress (emails processed / total)
- Appears during initial sync and manual sync; auto-hides when complete
- On error: Background changes to `rgba(255, 59, 48, 0.08)`, icon becomes `AlertCircle`, text: "Sync failed. Tap to retry." in `danger` red

### 10.5 Empty States

**No rules defined:**
```
+------------------------------------------+
|                                          |
|            [Filter icon]                 |  <- 48px, textSecondary
|                                          |
|       No import rules yet.               |  <- 17pt, textSecondary
|   Add a rule to start importing emails.  |  <- 13pt, textSecondary
|                                          |
+------------------------------------------+
```

**No emails imported:**
```
+------------------------------------------+
|                                          |
|            [Inbox icon]                  |  <- 48px, textSecondary
|                                          |
|       No emails imported yet.            |  <- 17pt, textSecondary
|   Emails matching your rules will        |  <- 13pt, textSecondary
|   appear here after the next sync.       |
|                                          |
+------------------------------------------+
```

### 10.6 Voice Integration

Email context is available to the AI for conversational queries:

- "What did Sarah email me about?" -> AI searches imported emails by sender, responds with subject and snippet summary in voice overlay (Section 7.3 general response card)
- "Create a task from Sarah's last email" -> AI finds most recent email from Sarah, opens pre-filled task creation modal
- "Do I have any new emails?" -> AI responds with count and summary of unread imported emails
- "Show me emails about the budget" -> AI searches by subject/body, navigates to Gmail screen with results filtered

The AI intent parser should support:
- `query_emails` function declaration with parameters: `sender` (optional), `subject_contains` (optional), `date_range` (optional)
- `create_task_from_email` function declaration with parameters: `email_id`

Voice overlay response for email queries uses the general response card (Section 7.3) with suggested action pills: "[View Email]", "[Create Task]", "[View All Emails]".

---

## 11. Housekeeping / Board Health

### Overview

Board Health provides an automated analysis of the user's projects and tasks, identifying overdue items, stale projects, incomplete tasks, and upcoming deadlines. It can be triggered via voice ("clean up my board") or manually from Settings. Results are presented as categorized, actionable issue cards.

### 11.1 Health Check Results Screen

Presented as a full screen pushed from Settings, or as a modal overlay when triggered by voice. The screen has a summary bar at the top and categorized sections below.

```
+------------------------------------------+
| < Settings    Board Health       [Refresh]|
|------------------------------------------|
| +----------------------------------------+|
| |  3 overdue   5 stale   2 incomplete    ||  <- Summary bar
| +----------------------------------------+|
|                                          |
|  OVERDUE TASKS (3)                [Fix All]|  <- Category header
|  +--------------------------------------+|
|  | [AlertCircle] Buy groceries          ||  <- Issue card
|  | Due: Mar 3 (4 days overdue)          ||
|  | Project: Personal                    ||
|  |                [Reschedule] [Complete]||  <- Action buttons
|  +--------------------------------------+|
|  +--------------------------------------+|
|  | [AlertCircle] Submit report          ||
|  | Due: Mar 1 (6 days overdue)          ||
|  | Project: Work                        ||
|  |                [Reschedule] [Complete]||
|  +--------------------------------------+|
|  +--------------------------------------+|
|  | [AlertCircle] Code review            ||
|  | Due: Feb 28 (7 days overdue)         ||
|  | Project: Sprint 4                    ||
|  |                [Reschedule] [Complete]||
|  +--------------------------------------+|
|                                          |
|  STALE PROJECTS (5)                      |  <- Category header
|  +--------------------------------------+|
|  | [Clock] Marketing Plan               ||
|  | No activity for 14 days              ||
|  | 3 tasks remaining                    ||
|  |                  [Open] [Archive]    ||
|  +--------------------------------------+|
|  +--------------------------------------+|
|  | [Clock] Q4 Planning                  ||
|  | No activity for 21 days              ||
|  | 0 tasks remaining                    ||
|  |                  [Open] [Archive]    ||
|  +--------------------------------------+|
|                                          |
|  MISSING INFO (2)                        |  <- Category header
|  +--------------------------------------+|
|  | [AlertTriangle] Design homepage      ||
|  | Missing: due date, priority          ||
|  | Project: Website Redesign            ||
|  |                       [Edit Task]    ||
|  +--------------------------------------+|
|                                          |
|  UPCOMING DEADLINES (4)                  |  <- Category header (informational)
|  +--------------------------------------+|
|  | [Calendar] Sprint 4 Demo             ||
|  | Due: Mar 9 (2 days away)             ||
|  | Project: Sprint 4                    ||
|  |                          [View]      ||
|  +--------------------------------------+|
+------------------------------------------+
```

### 11.2 Summary Bar

The summary bar provides a quick overview at the top of the screen.

```
+--------------------------------------------------+
|  3 overdue      5 stale      2 incomplete         |
|  [red dot]      [orange dot]  [yellow dot]        |
+--------------------------------------------------+
```

**Specifications:**
- Background: `cardBackground` (#FFFFFF)
- Border radius: 12px
- Padding: 16px
- Shadow: 0px 2px 4px rgba(0,0,0,0.08)
- Margin: 16px horizontal, 12px top
- Layout: Horizontal `flexDirection: 'row'`, `justifyContent: 'space-around'`
- Each metric:
  - Count: 22pt, Bold, `textPrimary`
  - Label: 13pt, Regular, `textSecondary`
  - Color dot: 8px circle to the left of the count
    - Overdue: `danger` (#FF3B30)
    - Stale: `warning` (#FF9500)
    - Incomplete/Missing info: `warning` (#FF9500)
    - Upcoming: `primary` (#007AFF)
- If all counts are zero, the summary bar shows a success state: green background tint `rgba(52, 199, 89, 0.1)`, text "All clear! Your board is healthy." in 17pt, `success` green, with a checkmark icon

### 11.3 Category Sections

Each category is a collapsible section with a header and list of issue cards.

**Category header specs:**
- Text: 13pt, Semibold, `textSecondary`, uppercase (iOS grouped list style)
- Count in parentheses: Same style
- Left margin: 16px
- Top margin: 24px, bottom margin: 8px
- "Fix All" button (on Overdue section only): 13pt, `primary`, right-aligned. Tap shows action sheet: "Reschedule all to today", "Mark all complete"
- Chevron: `ChevronDown` / `ChevronRight` (16px, `textSecondary`) to left of section title, indicating expand/collapse state
- Tap header to toggle collapse

**Categories and their detection rules:**

| Category | Icon | Detection Criteria | Actions Available |
|---|---|---|---|
| Overdue Tasks | `AlertCircle` (red) | Tasks with `due_date` before today and status != "done" | Reschedule (date picker), Complete |
| Stale Projects | `Clock` (orange) | Projects with no task updates in 14+ days | Open (navigate), Archive |
| Missing Info | `AlertTriangle` (orange) | Tasks missing due_date OR priority | Edit Task (opens task detail) |
| Upcoming Deadlines | `Calendar` (blue) | Tasks due within next 7 days | View (navigate to task) |
| Past Events | `CalendarX` (gray) | Calendar events that have passed with no meeting notes | Add Notes, Dismiss |

### 11.4 Issue Card Design

Each issue within a category is rendered as a card:

**Card specifications:**

| Element | Style | Details |
|---|---|---|
| **Icon** | 20px | Colored by category (see table above) |
| **Title** | 17pt, Regular, `textPrimary` | Task or project name, single line, truncated |
| **Detail line 1** | 14pt, Regular, `textSecondary` | What's wrong: "Due: Mar 3 (4 days overdue)" or "No activity for 14 days" |
| **Detail line 2** | 13pt, Regular, `textSecondary` | Context: "Project: Personal" or "3 tasks remaining" |
| **Action buttons** | 14pt, Medium | Pill-style buttons, right-aligned at bottom of card |

**Card styling:**
- Background: `cardBackground` (#FFFFFF)
- Border radius: 12px
- Padding: 16px
- Shadow: 0px 2px 4px rgba(0,0,0,0.08)
- Margin: 8px vertical, 16px horizontal
- Left border accent: 4px wide, colored by category (overdue=`danger`, stale=`warning`, missing=`warning`, upcoming=`primary`, past=`textSecondary`)

**Action button styling:**
- Height: 32px
- Padding: 12px horizontal
- Border radius: 16px (fully rounded pill)
- Primary actions (Reschedule, Edit, Open, View): `primary` background, white text
- Destructive actions (Archive, Dismiss): `backgroundLight` background, `textSecondary` text
- Completion action (Complete): `success` background, white text
- Gap between buttons: 8px

**Interactions:**
- **Tap card body:** Navigates to the relevant task/project/event detail screen
- **Tap action button:** Executes the action immediately (with undo toast for destructive actions)
- **Swipe left:** "Dismiss" action (hides the issue from the health check without resolving it; can be undone via undo toast)

### 11.5 Voice Overlay Presentation

When triggered via voice ("clean up my board", "check my board health", "what needs attention?"), the AI presents a conversational summary in the voice overlay using the general response card (Section 7.3):

```
+------------------------------------------+
|                                          |
|  +--------------------------------------+|
|  | "Clean up my board"                  ||  <- User transcript
|  +--------------------------------------+|
|                                          |
|  +--------------------------------------+|
|  |  Here's your board health summary:   ||  <- AI response card
|  |                                      ||
|  |  * 3 overdue tasks                   ||
|  |    - Buy groceries (4 days)          ||
|  |    - Submit report (6 days)          ||
|  |    - Code review (7 days)            ||
|  |  * 5 stale projects need attention   ||
|  |  * 2 tasks missing due dates         ||
|  |                                      ||
|  |  Want me to reschedule the overdue   ||
|  |  tasks to today?                     ||
|  |                                      ||
|  |  [Yes, reschedule]  [View Details]   ||  <- Action pills
|  +--------------------------------------+|
|                                          |
|          ( blue mic, pulsing )           |  <- Listening for response
+------------------------------------------+
```

**Voice interaction flow:**
1. User says "clean up my board" -> AI runs health analysis
2. AI responds conversationally with summary (max 5 items per category shown in voice)
3. AI offers a suggested action and stays in listening mode (clarification flow, Section 7.1)
4. User can respond verbally: "Yes, reschedule them" or "Show me the full report"
5. "Show me the full report" -> Navigates to the Board Health screen and dismisses overlay

**Suggested action pills:**
- "[Yes, reschedule]" -> Reschedules all overdue tasks to today, shows success card
- "[View Details]" -> Navigates to Board Health screen
- "[Archive stale]" -> Archives all stale projects (only shown if stale projects exist)

### 11.6 Empty State

When the board is completely healthy (no issues found):

```
+------------------------------------------+
| < Settings    Board Health               |
|------------------------------------------|
| +----------------------------------------+|
| |  [Checkmark circle]                    ||  <- 48px, success green
| |                                        ||
| |  Your board is healthy!                ||  <- 20pt, Semibold, success
| |  No overdue tasks, stale projects,     ||  <- 15pt, Regular, textSecondary
| |  or missing information found.         ||
| +----------------------------------------+|
+------------------------------------------+
```

- Centered vertically in content area
- `CheckCircle` icon from `lucide-react-native`, 48px, `success` green
- Title: 20pt, Semibold, `success` green
- Subtitle: 15pt, Regular, `textSecondary`, center-aligned, max 280px width
- Background card: `rgba(52, 199, 89, 0.05)` tint, 16px border radius, 24px padding

---

## 12. Settings Screen Redesign

### Overview

The Settings screen is reorganized to accommodate new features (Gmail Integration, Board Health, Storage) while maintaining the standard iOS grouped list pattern. Meeting Notes are relocated here from their former dedicated tab.

### 12.1 Screen Layout

```
+------------------------------------------+
| Settings                                 |  <- H1, 34pt Bold (large title)
|------------------------------------------|
|                                          |
|  ACCOUNT                                 |  <- Section header
|  +--------------------------------------+|
|  | [User]    Profile                   > ||  <- Row with icon
|  +--------------------------------------+|
|  +--------------------------------------+|
|  | [LogOut]  Sign Out                    ||  <- Destructive row
|  +--------------------------------------+|
|                                          |
|  INTEGRATIONS                            |  <- Section header
|  +--------------------------------------+|
|  | [Mail]    Gmail           Connected > ||  <- Status badge
|  +--------------------------------------+|
|                                          |
|  TOOLS                                   |  <- Section header
|  +--------------------------------------+|
|  | [Heart]   Board Health              > ||
|  +--------------------------------------+|
|  +--------------------------------------+|
|  | [FileText] Meeting Notes            > ||
|  +--------------------------------------+|
|  +--------------------------------------+|
|  | [Layout]  Templates                 > ||
|  +--------------------------------------+|
|                                          |
|  DATA & STORAGE                          |  <- Section header
|  +--------------------------------------+|
|  | [HardDrive] Storage        12.4 MB  > ||  <- Shows cache size
|  +--------------------------------------+|
|  +--------------------------------------+|
|  | [Trash2]  Clear Cache                 ||  <- Destructive action
|  +--------------------------------------+|
|                                          |
|  ABOUT                                   |  <- Section header
|  +--------------------------------------+|
|  | [Info]    About Personal Bot        > ||
|  +--------------------------------------+|
|  | [FileText] Terms & Privacy          > ||
|  +--------------------------------------+|
|  |           Version 1.0.0 (42)          ||  <- Centered, caption style
|  +--------------------------------------+|
|                                          |
+------------------------------------------+
```

### 12.2 Section and Row Specifications

**Section headers:**
- Text: 13pt, Semibold, `textSecondary` (#8E8E93), uppercase
- Left margin: 16px
- Top margin: 24px (32px for first section)
- Bottom margin: 8px

**Row specifications:**

| Element | Style | Details |
|---|---|---|
| **Row background** | `cardBackground` (#FFFFFF) | Grouped rows share a single card container |
| **Row height** | 44px minimum | Standard iOS row height |
| **Icon** | 20px, in a 28px rounded-rect container | Container has category-specific tint background |
| **Label** | 17pt, Regular, `textPrimary` | Left-aligned after icon |
| **Value/badge** | 15pt, Regular, `textSecondary` | Right-aligned before chevron |
| **Chevron** | `ChevronRight`, 16px, `textSecondary` | Right edge, for navigable rows |
| **Separator** | 0.5px, `border` (#C6C6C8) | Inset 56px from left (after icon area) |

**Row container (grouped card) styling:**
- Background: `cardBackground` (#FFFFFF)
- Border radius: 12px
- Margin: 0px vertical, 16px horizontal
- No outer shadow (flat iOS grouped style)
- Rows within a group are separated by inset dividers, not by margin

**Icon container colors (28px rounded-rect, 6px border radius):**

| Row | Icon | Container Background |
|---|---|---|
| Profile | `User` | `rgba(0, 122, 255, 0.12)` (blue tint) |
| Sign Out | `LogOut` | `rgba(255, 59, 48, 0.12)` (red tint) |
| Gmail | `Mail` | `rgba(255, 59, 48, 0.12)` (red tint, Google brand) |
| Board Health | `Heart` | `rgba(52, 199, 89, 0.12)` (green tint) |
| Meeting Notes | `FileText` | `rgba(0, 122, 255, 0.12)` (blue tint) |
| Templates | `Layout` | `rgba(255, 149, 0, 0.12)` (orange tint) |
| Storage | `HardDrive` | `rgba(142, 142, 147, 0.12)` (gray tint) |
| Clear Cache | `Trash2` | `rgba(255, 59, 48, 0.12)` (red tint) |
| About | `Info` | `rgba(142, 142, 147, 0.12)` (gray tint) |
| Terms & Privacy | `FileText` | `rgba(142, 142, 147, 0.12)` (gray tint) |

**Icon color:** Matches the container tint but at full opacity (e.g., blue tint container -> `primary` blue icon).

### 12.3 Row Interactions

| Row | Tap Action | Details |
|---|---|---|
| **Profile** | Push ProfileScreen | Shows user name, email, avatar. Edit profile fields |
| **Sign Out** | Confirmation alert | "Sign out of Personal Bot?" with Cancel/Sign Out buttons. Sign Out in `danger` red |
| **Gmail** | Push GmailSettingsScreen | See Section 10 |
| **Board Health** | Push BoardHealthScreen | Triggers health analysis, shows results (Section 11). Shows loading spinner while analyzing |
| **Meeting Notes** | Push MeetingNotesScreen | List of past meeting recordings and summaries |
| **Templates** | Push TemplatesScreen | View and manage project templates |
| **Storage** | Push StorageDetailScreen | Breakdown: cached files, offline data, attachments. Total size shown |
| **Clear Cache** | Confirmation alert | "Clear cached data? This won't delete your projects or tasks." with Cancel/Clear buttons. Clear in `danger` red. On confirm, clears AsyncStorage cache and shows success toast |
| **About** | Push AboutScreen | App description, credits, links |
| **Terms & Privacy** | Open URL | Opens terms/privacy page in system browser via `Linking.openURL` |

### 12.4 Status Badges

Certain rows display dynamic status information:

**Gmail row status badge:**
- **Connected:** "Connected" text in 13pt, `success` green, right of label
- **Disconnected:** "Not connected" text in 13pt, `textSecondary`, right of label
- **Syncing:** Spinning `RefreshCw` icon (14px, `primary`) replaces text
- **Sync error:** `AlertCircle` icon (14px, `danger`) + "Error" text in `danger` red

**Storage row value:**
- Shows total cache size: "12.4 MB" in 15pt, Regular, `textSecondary`
- Updates on screen focus (recalculates cache size)

**Board Health row badge (optional):**
- If there are known issues from the last health check, show a red badge circle (18px) with the issue count (e.g., "8") in white, 12pt Bold. Similar to iOS notification badges.
- Badge positioned right of label, before chevron
- If no issues or never checked: No badge shown

### 12.5 Voice Integration

Users can navigate to settings features via voice:

- "Open settings" -> Navigates to Settings tab
- "Connect my Gmail" -> Navigates directly to Gmail Settings screen
- "Check my board health" -> Navigates to Board Health screen (or presents results in voice overlay per Section 11.5)
- "Clear my cache" -> Triggers cache clear with confirmation toast
- "Show my meeting notes" -> Navigates to Meeting Notes screen

The AI should recognize these navigation intents and map them to the appropriate screen push actions.

---

## 13. DashboardScreen (v2 -- Replaces ProjectsScreen as Tab 1)

### Overview

The Dashboard is the new home screen and command center. It answers "what do I need to know right now?" at a glance. It combines board status, project overview with Google metadata, and upcoming events into a single scrollable view.

### 13.1 Screen Layout

```
+------------------------------------------+
| Dashboard                     [Update]   |  <- H1 34pt Bold + action button
+------------------------------------------+
|                                          |
|  BOARD STATUS              Last: 2h ago  |  <- Section header + timestamp
|  +------------------------------------+  |
|  |  3 emails need attention           |  |  <- Board status card
|  |  2 overdue tasks                   |  |
|  |  Meeting in 1h: Team Standup       |  |
|  |  1 new file in "My App" Drive      |  |
|  +------------------------------------+  |
|                                          |
|  PROJECTS                          +Add  |  <- Section header + add button
|  +------------------------------------+  |
|  |  My App                     3/8    |  |  <- Project card
|  |  Drive: 4 files | Email: 2h ago   |  |
|  +------------------------------------+  |
|  +------------------------------------+  |
|  |  Marketing Campaign Q2     5/12   |  |
|  |  Drive: 7 files | No emails       |  |
|  +------------------------------------+  |
|                                          |
|  UPCOMING (48h)                          |  <- Section header
|  +------------------------------------+  |
|  |  10:00  Team Standup        [GCal] |  |
|  |  14:00  Client Call         [GCal] |  |
|  |  Due:   Fix login bug       [!]    |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
|  [Dash] [Tasks] [MIC] [Cal] [Settings]  |
+------------------------------------------+
```

### 13.2 [Update] Button

Positioned in the navigation bar, right-aligned. Triggers a full board update (POST /board-update).

**Specifications:**
- Icon: `RefreshCw` from lucide-react-native, 22px
- Color: `primary` (#007AFF)
- Tap area: 44x44px (accessibility minimum)
- During update: Icon spins continuously (Animated.loop rotation)
- After update: Stops spinning, board status card refreshes

### 13.3 Board Status Card

Displays the AI-generated summary from the last board update. This is the most prominent element on screen.

**Specifications:**
- Background: `cardBackground` (#FFFFFF)
- Border radius: 12px
- Padding: 16px
- Shadow: 0px 2px 8px rgba(0,0,0,0.10) (slightly stronger than standard cards)
- Border-left: 4px, `primary` (#007AFF)
- Margin: 16px horizontal, 8px bottom

**Content:**
- Each line is a bullet point from the AI summary
- Text: 15pt, Regular, `textPrimary`
- Max 5 lines shown; if more, "[View full report]" link in `primary` at bottom
- Tap card body -> navigates to full board update detail

**"Last: Xh ago" timestamp:**
- Position: Right-aligned in section header, same line as "BOARD STATUS"
- Style: 13pt, Regular, `textSecondary`
- Shows relative time: "Just now", "5 min ago", "2h ago", "Yesterday"
- If never updated: "Never" in `warning` orange

**Loading state (during board update):**
- Card shows shimmer/skeleton animation (3 gray bars at 60%, 80%, 40% width)
- Below shimmer, progress text: "Scanning emails..." -> "Checking Drive..." -> "Syncing calendar..." -> "Generating summary..."
- Progress text: 13pt, Regular, `primary`, with a small spinner icon (14px) to the left

**Empty state (no board update yet):**
```
+------------------------------------+
|                                    |
|  Tap [Update] to scan your Gmail,  |
|  Drive, and Calendar for a full    |
|  board status report.              |
|                                    |
+------------------------------------+
```
- Text: 15pt, Regular, `textSecondary`, center-aligned
- Background: `rgba(0, 122, 255, 0.05)` light blue tint

### 13.4 Project Cards

Each project is a card showing task progress and Google integration metadata.

```
+------------------------------------+
|  My App                     3/8    |  <- Title + task count
|  Drive: 4 files | Email: 2h ago   |  <- Google metadata line
+------------------------------------+
```

**Specifications:**

| Element | Style | Details |
|---|---|---|
| **Title** | 17pt, Semibold, `textPrimary` | Left-aligned, truncated at 24 chars |
| **Task count** | 15pt, Regular, `textSecondary` | Right-aligned, format: "pending/total" |
| **Google metadata** | 13pt, Regular, `textSecondary` | Below title. Shows Drive file count and last email time |
| **Card** | `cardBackground`, 12px radius, 12px padding | Standard card shadow |
| **Chevron** | `ChevronRight`, 16px, `textSecondary` | Right edge, vertically centered |

**Google metadata line logic:**
- If Google connected and project has Drive folder: "Drive: X files"
- If project has related emails: "Email: Xh ago" (time of most recent)
- If neither: Line hidden (card is shorter)
- Separator between items: " | " in `textSecondary`

**Interactions:**
- **Tap:** Push to ProjectDetailScreen
- **Long press:** Context menu: "Archive Project", "View in Drive" (if Drive linked)

**+Add button:** Same as existing project create flow (modal with title + template picker).

### 13.5 Upcoming Strip

Shows the next 48 hours of calendar events and approaching task deadlines, merged into a single chronological list.

```
+------------------------------------+
|  10:00  Team Standup        [GCal] |
|  14:00  Client Call         [GCal] |
|  Due:   Fix login bug       [!]    |
+------------------------------------+
```

**Row specifications:**

| Element | Style | Details |
|---|---|---|
| **Time** | 15pt, Medium, `textPrimary` | Left column, 60px wide. Events show "HH:MM", deadlines show "Due:" |
| **Title** | 15pt, Regular, `textPrimary` | Middle, flex 1, truncated |
| **Badge** | 11pt, Medium, padded pill | Right-aligned |

**Badge types:**
- `[GCal]`: `rgba(66, 133, 244, 0.12)` background, `#4285F4` text (Google blue). Indicates event synced from Google Calendar.
- `[App]`: `rgba(0, 122, 255, 0.12)` background, `primary` text. Indicates event created in-app.
- `[!]`: `rgba(255, 59, 48, 0.12)` background, `danger` text. Indicates overdue or due-today task deadline.

**Row styling:**
- Height: 44px
- Separator: 0.5px inset divider
- Contained within a single grouped card (12px radius, `cardBackground`)

**Interactions:**
- Tap event row -> navigate to CalendarScreen (scrolled to that event)
- Tap deadline row -> navigate to task detail

**Empty state:** Section hidden if no upcoming events or deadlines.

---

## 14. Board Update Response UX

### Overview

The Board Update is the hero feature of v2. It can be triggered via voice or the Dashboard [Update] button. The UX must communicate progress across 4 stages and present the AI summary clearly.

### 14.1 Voice-Triggered Board Update

When the user says "Update my board" or "What's new?", the VoiceOverlay shows a multi-stage progress flow followed by the AI summary.

**Stage 1-4: Progress Steps**

```
+------------------------------------------+
|                                          |
|  +--------------------------------------+|
|  | "Update my board"                    ||  <- User transcript
|  +--------------------------------------+|
|                                          |
|           [spinning icon]                |
|                                          |
|     Scanning emails...            [1/4]  |  <- Progress step
|                                          |
+------------------------------------------+
```

**Progress step specifications:**
- Steps cycle automatically as each completes: "Scanning emails..." [1/4] -> "Checking Drive files..." [2/4] -> "Syncing calendar..." [3/4] -> "Generating summary..." [4/4]
- Text: 15pt, Regular, `primary`
- Step counter: 13pt, Regular, `textSecondary`, right-aligned
- Spinner: `ActivityIndicator` in `primary`, 24px, centered above text
- Each step transitions with a fade animation (200ms)

**Stage 5: AI Summary Response**

```
+------------------------------------------+
|                                          |
|  +--------------------------------------+|
|  | Board updated! Here's your status:   ||  <- AI response card
|  |                                      ||
|  | My App:                              ||
|  |   2 new emails from client           ||
|  |   design-spec.pdf updated in Drive   ||
|  |   'Fix login bug' overdue by 2 days  ||
|  |                                      ||
|  | Marketing Campaign:                  ||
|  |   3 emails from agency               ||
|  |   New file in Drive                  ||
|  |                                      ||
|  | Calendar:                            ||
|  |   Team standup in 1 hour             ||
|  |   Client call at 2pm                 ||
|  |                                      ||
|  | [Review design spec]                 ||
|  | [Reply to client] [Update bug status]||
|  +--------------------------------------+|
|                                          |
|          ( blue mic, pulsing )           |
+------------------------------------------+
```

**AI response card specifications:**
- Uses the general response card style (Section 7.3)
- Background: `cardBackground` (#FFFFFF)
- Border radius: 12px
- Padding: 16px
- Max height: 60% of screen height, scrollable if longer
- Shadow: 0px 4px 12px rgba(0,0,0,0.12)

**Summary text formatting:**
- Project headers: 15pt, Semibold, `textPrimary`
- Bullet items: 14pt, Regular, `textSecondary`, 16px left indent
- Section gaps: 12px between project groups

**Suggested action pills:**
- Same style as Section 7.3 pills: `rgba(0, 122, 255, 0.1)` background, `primary` text, 14pt Medium, 28px height, 12px horizontal padding, 14px pill radius
- Max 3 pills shown
- Wrap to second row if needed, 8px gap
- Tap a pill -> executes the action (e.g., navigates to task, triggers a voice command)
- Mic stays pulsing -- user can speak a follow-up instead of tapping

### 14.2 Manual-Triggered Board Update (Dashboard)

When the user taps [Update] on the Dashboard, the Board Status Card itself shows the progress.

**Loading sequence:**
1. [Update] icon starts spinning
2. Board Status Card content replaced with shimmer skeleton:
   - 3 skeleton bars (height: 14px, radius: 7px, `rgba(142, 142, 147, 0.15)`)
   - Widths: 60%, 80%, 45% of card width
   - Shimmer animation: left-to-right gradient sweep, 1.5s loop
3. Below skeleton, progress text appears:
   - "Scanning emails..." -> "Checking Drive..." -> "Syncing calendar..." -> "Generating summary..."
   - 13pt, Regular, `primary`, with 14px spinner icon

**Completion:**
1. [Update] icon stops spinning
2. Skeleton replaced with new AI summary text (fade-in, 300ms)
3. "Last: Just now" timestamp updates
4. Project cards refresh with updated Drive file counts and email timestamps
5. Upcoming strip refreshes with any new calendar events

**Error state:**
- If board update fails (network, API error), card shows:
  - `AlertCircle` icon, 20px, `danger`
  - "Board update failed. Tap to retry." in 15pt, `danger`
  - Tap card -> retries the update

---

## 15. CalendarScreen v2 Updates

### 15.1 Sync Button

Added to the navigation bar, left of the existing [+] button.

```
| Calendar                [Sync] [+]     |
```

**Specifications:**
- Label: "Sync" in 15pt, Regular, `primary`
- Or icon-only: `RefreshCw`, 20px, `primary`
- Tap: Triggers POST /calendar/sync (pull from Google Calendar)
- During sync: Icon spins, label changes to "Syncing..."
- After sync: Brief checkmark flash (0.5s), then returns to normal
- If Google not connected: Button hidden

### 15.2 Event Source Badges

Each event card shows a badge indicating where the event originated.

**Badge types:**
- `[GCal]`: Event synced from Google Calendar
  - Background: `rgba(66, 133, 244, 0.12)`, text: `#4285F4` (Google blue)
  - 11pt, Medium, 4px horizontal padding, 10px pill radius
- `[App]`: Event created within Personal Bot
  - Background: `rgba(0, 122, 255, 0.12)`, text: `primary`
  - Same dimensions as [GCal]

**Placement:** Right-aligned on the event card's title row, after the time range.

### 15.3 External Events

Events pulled from Google Calendar that don't match any project are labeled "External":

```
+------------------------------------+
|  14:00-15:00  Client Call   [GCal] |
|  External                          |  <- Instead of project name
+------------------------------------+
```

- "External" label: 13pt, Italic, `textSecondary`
- Replaces the project tag line on events with no `project_id`

---

## 16. ProjectDetailScreen v2 Updates

### 16.1 Tab Strip

A horizontal tab strip added below the screen title, above the content area.

```
+------------------------------------------+
| < My App                      [...]     |
+------------------------------------------+
| [Tasks]   [Files]   [Emails]            |  <- Tab strip
+------------------------------------------+
```

**Tab strip specifications:**
- Height: 44px
- Background: `cardBackground`
- Bottom border: 0.5px, `border` (#C6C6C8)
- Tabs evenly spaced, `justifyContent: 'space-around'`
- Active tab: 15pt, Semibold, `primary`, with 2px bottom border in `primary`
- Inactive tab: 15pt, Regular, `textSecondary`
- Tap to switch tabs (no swipe gesture for simplicity)

### 16.2 Files Tab (Google Drive)

Shows files from the project's linked Google Drive folder.

```
+------------------------------------------+
|  FILES (Google Drive)                    |
|  +------------------------------------+  |
|  | [FileIcon] design-spec.pdf  2h ago |  |
|  | [FileIcon] api-docs.md      1d ago |  |
|  | [FileIcon] wireframes.fig   3d ago |  |
|  +------------------------------------+  |
|                            [Upload]      |
+------------------------------------------+
```

**File row specifications:**

| Element | Style | Details |
|---|---|---|
| **File icon** | 20px | Type-specific: `FileText` (doc), `Image` (image), `FileSpreadsheet` (sheet), `File` (generic) |
| **File name** | 15pt, Regular, `textPrimary` | Truncated at 28 chars |
| **Modified time** | 13pt, Regular, `textSecondary` | Right-aligned, relative format |

**Row styling:** 44px height, inset separators, grouped card container.

**Interactions:**
- Tap file -> Open in system viewer (via `Linking.openURL` with Drive URL)
- [Upload] button: Triggers file picker, uploads to Drive folder (POST /drive/upload/:projectId)

**Empty state:**
- If Google not connected: "Connect Google in Settings to see Drive files." with link to Settings
- If connected but no Drive folder: "No Drive folder linked to this project."
- If folder exists but empty: "No files in Drive yet."

### 16.3 Emails Tab

Shows imported emails that are related to this project (matched by AI or by email rules targeting this project).

```
+------------------------------------------+
|  RELATED EMAILS                          |
|  +------------------------------------+  |
|  | [AV] client@co.com       2h ago    |  |
|  |      Re: Launch timeline           |  |
|  |      "Can we push to next week..." |  |
|  |         [Create Task] [Draft Reply]|  |
|  +------------------------------------+  |
+------------------------------------------+
```

- Uses same email card design as Section 10.3
- Additional action button: [Draft Reply] in `textSecondary` (creates Gmail draft via voice or API)
- For demo: [Draft Reply] is disabled/hidden (read-only Google scope)

**Empty state:** "No emails matched to this project yet."

---

## 17. Settings Screen v2 Updates

### 17.1 Google Integration Row (replaces Gmail row)

The Integrations section is updated to show unified Google connection:

```
|  INTEGRATIONS                            |
|  +--------------------------------------+|
|  | [Globe]   Google         Connected > ||
|  |           Gmail, Calendar, Drive     ||
|  +--------------------------------------+|
```

**Specifications:**
- Icon: `Globe` (or Google "G" logo if custom asset available), 20px
- Container background: `rgba(66, 133, 244, 0.12)` (Google blue tint)
- Primary label: "Google", 17pt, Regular, `textPrimary`
- Sub-label: "Gmail, Calendar, Drive", 13pt, Regular, `textSecondary` (below primary)
- Status: "Connected" / "Not connected", same style as former Gmail badge
- Row height: 56px (taller to accommodate sub-label)
- Tap: Push to GoogleSettingsScreen (or for demo, a simple screen showing connected email + disconnect)

### 17.2 Board Update History Row (new)

Added to the TOOLS section:

```
|  TOOLS                                   |
|  +--------------------------------------+|
|  | [Heart]   Board Health              > ||
|  +--------------------------------------+|
|  | [Clock]   Board Update History      > ||  <- NEW
|  +--------------------------------------+|
```

- Icon: `Clock`, container: `rgba(0, 122, 255, 0.12)` (blue tint)
- Tap: Push to a screen showing past board update summaries (post-demo feature; for demo, this row can be hidden)
