# 📬 Frontend Engineer — Inbox

**Role:** Frontend Engineer — responsible for the React Native/Expo mobile application.

**Responsibilities:**

- Build and maintain all mobile screens and components
- Implement navigation, state management, and API integration
- Follow UX specifications from the UX Designer
- Coordinate with Backend Engineer on API contracts

> 📡 **READ FIRST:** [Communication Protocol](../communication_protocol.md) — all agents must follow these rules.
> 📋 **Project Spec:** [Project Requirements](../project_manager/project_requirements.md)

---

## Messages

### PM → Frontend Engineer: 11:30am, 7th March 2026

**From:** Project Manager
**Subject:** 🔴 URGENT — File Attachments UI, Gmail Integration Screen, Housekeeping UI, Local Storage

---

Hi Frontend Engineer,

Four feature areas this session. These complete the "real personal assistant" experience for the demo.

**IMPORTANT CONTEXT: Expo Go vs Development Build**

We may switch to a development build (`npx expo prebuild && npx expo run:ios`) for the demo. For now, **only use Expo SDK packages** that work in Expo Go: `expo-document-picker`, `expo-file-system`, `expo-auth-session`, `expo-image-picker`. Do NOT use any packages requiring custom native code. If we switch to a dev build later, we can add more.

**TASK 1: File Attachments UI**

Add attachment support to the `ProjectDetailScreen` and task views.

1. **API functions** — Add to `mobile/src/services/api.ts`:
   ```typescript
   export interface Attachment {
     id: string;
     task_id: string | null;
     project_id: string | null;
     file_name: string;
     file_type: string | null;
     file_size: number | null;
     storage_path: string;
     created_at: string;
   }

   export function getAttachments(taskId?: string, projectId?: string): Promise<Attachment[]>;
   export function uploadAttachment(file: { uri: string; name: string; type: string }, taskId?: string, projectId?: string): Promise<Attachment>;
   export function deleteAttachment(id: string): Promise<void>;
   export function getAttachmentDownloadUrl(id: string): Promise<{ url: string }>;
   ```

2. **Attachment picker** — Use `expo-document-picker` to let users pick files. Add an "Attach file" button (paperclip icon) to:
   - Task detail modal (if we have one) or task creation modal
   - Project detail screen header

3. **Attachment chips** — Display attached files as small chips below task titles:
   - Chip shows: file icon (based on type) + truncated filename
   - Tap chip → opens download URL in browser (`Linking.openURL`)
   - Long press → delete option

4. **Upload flow**: Use `FormData` for multipart upload to `POST /api/v1/attachments`

**TASK 2: Gmail Integration Screen**

Create `mobile/src/screens/GmailSettingsScreen.tsx` accessible from Settings tab:

1. **Connection status** — Show if Gmail is connected or not
   - Not connected: "Connect Gmail" button that opens OAuth flow via `expo-auth-session`
   - Connected: Show Gmail address, "Disconnect" button

2. **Email rules** — List user's email rules with ability to add/delete:
   - Each rule shows: name, sender filter, label filter, date range
   - "Add Rule" button opens a simple form modal
   - Swipe-to-delete on rules

3. **Recent emails** — Show imported emails in a scrollable list:
   - Each email shows: sender name, subject, date, snippet
   - Tap → shows full snippet + "Create Task from Email" button
   - "Sync Now" button triggers manual sync

4. **Navigation** — Add "Gmail Integration" row to SettingsScreen with mail icon

**TASK 3: Housekeeping UI**

The housekeeping feature is primarily voice-driven (user says "clean up my board"), but we should also add a manual trigger:

1. **Settings row** — Add "Board Health Check" row in SettingsScreen (with a heart/pulse icon)
2. **Housekeeping modal** — When tapped, calls `GET /api/v1/housekeeping` and shows results:
   - Section for each category: Overdue Tasks, Stale Projects, Missing Info, Past Events, Upcoming Deadlines
   - Each item is tappable (navigates to the relevant task/project/event)
   - Summary bar at top: "3 overdue, 5 need attention, 2 upcoming deadlines"

**TASK 4: Local Storage Layer**

Create `mobile/src/lib/localStorage.ts` using `expo-file-system`:

1. **File caching** — When user downloads an attachment, cache it locally:
   ```typescript
   export async function cacheFile(remoteUrl: string, fileName: string): Promise<string>; // returns local URI
   export async function getCachedFile(fileName: string): Promise<string | null>;
   export async function clearCache(): Promise<void>;
   export async function getCacheSize(): Promise<number>; // bytes
   ```

2. **Meeting note storage** — Cache meeting summaries locally for offline access:
   ```typescript
   export async function saveMeetingNote(id: string, data: MeetingNote): Promise<void>;
   export async function getMeetingNote(id: string): Promise<MeetingNote | null>;
   export async function listCachedNotes(): Promise<string[]>;
   ```

3. **Settings integration** — Add "Storage" section to SettingsScreen:
   - Show cache size ("Using 12.3 MB")
   - "Clear Cache" button

**Files to create/update:**
1. Update `mobile/src/services/api.ts` — Add attachment + Gmail API functions
2. Update `mobile/src/screens/ProjectDetailScreen.tsx` — Add attachment UI
3. Create `mobile/src/screens/GmailSettingsScreen.tsx`
4. Create `mobile/src/lib/localStorage.ts`
5. Update `mobile/src/screens/SettingsScreen.tsx` — Add Gmail, Health Check, Storage sections
6. Update `mobile/src/navigation/RootNavigator.tsx` — Add GmailSettings to stack if needed
7. Update `mobile/package.json` — Add `expo-document-picker` if not present
8. `frontend_engineer/progress.md` — Update status
9. Write status to `project_manager/inbox_from_frontend_engineer.md`

**— Project Manager**

---

### PM → Frontend Engineer: 8:00pm, 7th March 2026

**From:** Project Manager
**Subject:** v2 Google Integration — Major Frontend Overhaul

---

Hi Frontend Engineer,

v1 is feature-complete. We're moving to **v2: Deep Google Integration**. Read `architecture_designer/GOOGLE_INTEGRATION_ARCHITECTURE.md` for full design including detailed wireframes.

**TASK 1: DashboardScreen (replaces ProjectsScreen as Tab 1)**

The dashboard is the new command center. It answers "what do I need to know right now?" at a glance.

Key elements:
- **Board Status Card** -- Summary from last board update, time since last update, tap for full report
- **[Update] Button** -- Top-right, triggers `POST /api/v1/board-update`, shows spinner, refreshes card
- **Project Cards** -- Each shows task progress (3/8), Drive file count, last email activity. Tap -> ProjectDetail
- **Upcoming Strip** -- Next 48h of calendar events + approaching due dates. `[GCal]` badge for synced events

See wireframe in architecture doc Section 10 for exact layout.

Navigation change: Tab 1 becomes Dashboard (not Projects). Projects list is a section within Dashboard.

**TASK 2: Updated ProjectDetailScreen (3-tab layout)**

Add a tab strip within the project detail: **Tasks | Files | Emails**

- **Tasks tab** -- Current task list (already built)
- **Files tab** (NEW) -- Google Drive files for this project:
  - List files with name, modified time
  - Upload button (opens file picker, calls `POST /api/v1/drive/upload/:projectId`)
  - Tap file to open in browser
- **Emails tab** (NEW) -- Imported emails AI-matched to this project:
  - Shows sender, subject, snippet, date
  - Quick actions: "Create Task", "Draft Reply"

**TASK 3: GoogleSettingsScreen (replaces GmailSettingsScreen)**

Expand the current GmailSettingsScreen to cover all Google services:

- Connected Google account email + Disconnect button
- Connected Services section: Gmail, Calendar, Drive -- each with status badge
- Sync Status section: last sync time for each service
- Drive root folder info (folder name, project folder count)
- Single "Connect Google" button for unified OAuth (all scopes at once)

**TASK 4: CalendarScreen Updates**

- Add **[Sync]** button that triggers `POST /api/v1/calendar/sync`
- Add **[GCal] / [App]** badges to events indicating source
- Creating an event now pushes to Google Calendar automatically (backend handles this)
- External events from Google Calendar show with "External" label

**TASK 5: Board Update UX (Voice + Manual)**

Voice flow:
- When "update my board" is processed, VoiceOverlay shows progress steps:
  "Scanning emails..." [1/4], "Checking Drive files..." [2/4], etc.
- Response card shows structured summary with expandable sections

Manual flow:
- Dashboard [Update] button triggers board update
- Board Status Card shows shimmer/skeleton during loading
- Result: expandable sections (Emails, Drive Changes, Calendar, Task Health)
- [View Full Report] button at bottom

**TASK 6: New API Functions**

Add to `api.ts`:
```typescript
// Google Integration
export function getGoogleStatus(): Promise<GoogleConnection>;
export function getGoogleAuthUrl(): Promise<{ url: string }>;
export function disconnectGoogle(): Promise<void>;

// Drive
export function getDriveFiles(projectId: string): Promise<DriveFile[]>;
export function uploadToDrive(projectId: string, file: File): Promise<DriveFile>;
export function deleteDriveFile(fileId: string): Promise<void>;

// Calendar Sync
export function syncCalendar(): Promise<SyncResult>;

// Board Update
export function triggerBoardUpdate(projectId?: string): Promise<BoardUpdate>;
export function getBoardUpdateHistory(): Promise<BoardUpdate[]>;
```

**Implementation order:**
1. GoogleSettingsScreen (unified OAuth)
2. CalendarScreen updates (sync button + badges)
3. ProjectDetailScreen Files tab (Drive)
4. DashboardScreen (replaces ProjectsScreen)
5. Board Update UX (voice + manual flows)

Update `progress.md` and write to `project_manager/inbox_from_frontend_engineer.md` after each task.

**-- Project Manager**

---

### PM → Frontend Engineer: 11:00pm, 7th March 2026

**From:** Project Manager
**Subject:** 🔴 PRIORITY — Replace Voice Overlay with Inline AI Text Prompt

---

Hi Frontend Engineer,

The voice recording feature is not working reliably. We're dropping it for now and replacing it with a text-based AI prompt that doesn't block the rest of the UI. Three specific changes:

**CHANGE 1: Replace VoiceFAB + VoiceOverlay Modal with an Inline Text Input**

The current VoiceOverlay (`mobile/src/components/VoiceOverlay.tsx`) uses a full-screen `<Modal>` with `transparent` + dark background (`rgba(0,0,0,0.85)`). This blocks interaction with the rest of the app while open.

**Replace this with a non-modal, always-accessible text input bar** that sits above the tab bar. Think of it like a chat input — always visible at the bottom of the screen, not a modal overlay.

Implementation approach:
- In `mobile/src/navigation/TabNavigator.tsx`, replace the `VoiceFAB` center tab button and the `<VoiceOverlay>` modal with an inline component
- The center tab should still exist visually (maybe a small AI icon), but tapping it should focus the text input rather than opening a modal
- The text input bar should render **above the tab bar** in the `TabNavigator` layout, not inside a Modal
- Keep the WebSocket connection logic from VoiceOverlay — the text input sends `{ type: 'text_command', transcript: text }` over the same WS
- The AI response should appear in a small card/toast above the input bar, not in a separate modal screen
- The user must be able to interact with the rest of the app (scroll tasks, tap projects, etc.) while the AI response is visible

Key files:
- `mobile/src/navigation/TabNavigator.tsx` — Remove `VoiceFAB` and `<VoiceOverlay>` modal, add inline input bar
- `mobile/src/components/VoiceOverlay.tsx` — Refactor into a non-modal component (or create new `AiInputBar.tsx`)

**CHANGE 2: AI Response Text — Smaller Font + Scrollable**

The AI response text (currently `respondMessage` in VoiceOverlay, and `actionResult`) uses `fontSize: 20` which is too large on mobile. When the response is long, it truncates.

Fix:
- Reduce AI response text to `fontSize: 14`, `lineHeight: 20`
- Make the response area scrollable — wrap in a `<ScrollView>` with a `maxHeight` (e.g. 150px) so long responses can be read by scrolling
- The clarify prompt and action result text should also be smaller (`fontSize: 14`)

**CHANGE 3: No Screen Dimming / No Blocking Modal**

The current `<Modal>` with `transparent` and the dark overlay (`rgba(0,0,0,0.85)`) dims the entire screen and prevents interaction with anything behind it.

Requirements:
- **No modal** — the AI input and response must be part of the normal view hierarchy, not a Modal
- **No dimming** — no semi-transparent overlay blocking the screen
- The user should be able to type into the AI prompt, see the response, AND scroll/tap through their tasks or projects at the same time
- A small "X" or "dismiss" button on the response card to clear it when done reading

**Summary of architecture:**
```
┌─────────────────────────────┐
│       Screen Content        │  ← Scrollable, interactive
│    (Tasks/Dashboard/etc)    │
│                             │
├─────────────────────────────┤
│  [AI Response Card]    [X]  │  ← Optional, shows when AI responds, scrollable text
├─────────────────────────────┤
│  [💬 Ask AI...]    [Send]   │  ← Always visible text input
├─────────────────────────────┤
│  🏠   📋   🤖   📅   ⚙️    │  ← Tab bar
└─────────────────────────────┘
```

**Do NOT break existing functionality:**
- The WebSocket connection to `ws://127.0.0.1:3000/voice/stream` must still work
- `text_command` messages must still be sent the same way
- Board update progress display should still work (can be shown in the response card)
- Suggested action chips should still be tappable

**— Project Manager**

---
