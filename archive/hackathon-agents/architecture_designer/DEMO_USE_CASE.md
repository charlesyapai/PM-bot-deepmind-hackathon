# Demo Use Case: Research Analyst

**Date:** 2026-03-07
**Authors:** Architecture Designer + UX Designer

---

## The Persona

**Alex**, a research analyst managing 3 active research projects, each under a different PI (Principal Investigator). Alex juggles:
- Emails from PIs with feedback, deadlines, and meeting requests
- Research documents in Google Drive (papers, data files, notes)
- Calendar coordination for lab meetings, reviews, and deadlines
- Task tracking across all projects (literature review, data analysis, draft writing)

Alex wants to open the app, hit "Update my board", and instantly know what's changed across all projects -- without manually checking 3 email threads, 3 Drive folders, and a packed calendar.

---

## Demo Projects (Pre-populated)

| Project | PI | Drive Folder | Email Rule |
|---|---|---|---|
| Genomics Study | Dr. Sarah Chen | `Personal Bot/Genomics Study/` | From: `sarah.chen@university.edu` |
| Climate Modeling | Prof. James Rivera | `Personal Bot/Climate Modeling/` | From: `j.rivera@research.org` |
| Drug Discovery | Dr. Aisha Patel | `Personal Bot/Drug Discovery/` | From: `a.patel@pharmalab.com` |

---

## Feature Gap Analysis

### What the current architecture DOES support:

1. Email import by sender filter (email_rules table) -- YES
2. List Drive files per project -- YES
3. Pull Google Calendar events -- YES
4. Board Update compound scan -- YES
5. AI-synthesized summary -- YES
6. Voice commands for task CRUD -- YES
7. Housekeeping (overdue tasks, stale projects) -- YES

### What the researcher use case REQUIRES but we're MISSING:

---

### GAP 1: Email-to-Project Association

**Current:** `email_rules` has `sender_filter` and `label_filter`, but no `project_id`. Emails are imported user-wide, not per-project. The Board Update "tags emails by project" via AI matching, but this is loose and unreliable.

**Needed:** Each email rule should be linked to a specific project. When emails are imported, they get a `project_id` so they show up in the project's Emails tab deterministically.

**Fix:**
```sql
ALTER TABLE email_rules ADD COLUMN project_id UUID REFERENCES projects(id);
ALTER TABLE imported_emails ADD COLUMN project_id UUID REFERENCES projects(id);
```

When an email is imported via a rule that has `project_id`, the email gets that `project_id`. This way "emails from Dr. Chen" always land under "Genomics Study".

**UX Impact:** The "Add Rule" modal (Section 10.2) needs a Project picker field. The project's Emails tab shows emails with matching `project_id` directly, not via AI guessing.

---

### GAP 2: AI Reads Email Bodies (Not Just Metadata)

**Current:** `imported_emails` stores `subject`, `sender`, `snippet` (first ~100 chars). The Board Update counts emails and reports subjects. The AI doesn't read the actual email content.

**Needed:** The AI needs to read the full email body to:
- Summarize what the PI said ("Dr. Chen wants the revised analysis by Friday")
- Detect actionable items ("submit the draft", "schedule a meeting")
- Detect scheduling language ("let's meet Thursday at 2pm")

**Fix:**
```sql
ALTER TABLE imported_emails ADD COLUMN body_text TEXT;
```

The Gmail service already fetches the full body (`gmailClient.js` has `getEmailDetails` which extracts body text). We just need to store it and feed it to Gemini during board updates.

**Board Update Engine change:** Step 1 (EMAIL SCAN) needs to pass email body text (truncated to ~1000 chars per email) into the Gemini context, not just subject/sender/snippet.

**Demo scope impact:** This is critical for the researcher demo. Without it, the AI can only say "3 emails from Dr. Chen" instead of "Dr. Chen wants the revised analysis by Friday and suggested meeting Thursday at 2pm."

---

### GAP 3: AI Suggests Task Updates (Not Just Reports)

**Current:** The Board Update AI summary is informational -- it tells you what's happening. It doesn't propose specific task mutations.

**Needed:** After reading emails and checking task status, the AI should propose concrete actions:
- "Based on Dr. Chen's email, I suggest: (1) Update 'Data Analysis' due date to March 14, (2) Add new task 'Submit revised figures' with due date March 12"
- These suggestions should be tappable/actionable in the UI

**Fix:** Enhance the `boardSummaryGenerator.js` Gemini prompt to include a `suggestedActions` array in its response:

```json
{
  "summary": "...",
  "suggestedActions": [
    { "type": "update_task", "taskId": "xxx", "field": "due_date", "value": "2026-03-14", "reason": "Dr. Chen requested by Friday" },
    { "type": "create_task", "projectId": "xxx", "title": "Submit revised figures", "due_date": "2026-03-12", "reason": "Mentioned in Dr. Chen's email" },
    { "type": "create_event", "title": "Meeting with Dr. Chen", "date": "2026-03-13", "time": "14:00", "reason": "Dr. Chen suggested Thursday at 2pm" }
  ]
}
```

**UX Impact:** The Board Update response (Section 14) needs to render suggested actions as more than just text pills. Each suggestion should be a mini-card:

```
+------------------------------------------+
| SUGGESTED ACTIONS                        |
| +--------------------------------------+ |
| | Update "Data Analysis" due date      | |
| | March 10 -> March 14                 | |
| | Reason: Dr. Chen requested by Friday | |
| |                    [Apply] [Dismiss]  | |
| +--------------------------------------+ |
| +--------------------------------------+ |
| | New task: "Submit revised figures"   | |
| | Due: March 12 | Genomics Study       | |
| |                    [Create] [Dismiss] | |
| +--------------------------------------+ |
| +--------------------------------------+ |
| | Schedule: Meeting with Dr. Chen      | |
| | Thu, March 13 at 2:00 PM             | |
| |                [Schedule] [Dismiss]   | |
| +--------------------------------------+ |
+------------------------------------------+
```

This is a major differentiator: the AI doesn't just report -- it proposes actions you can accept with one tap.

---

### GAP 4: Auto-Schedule Calendar Events from Emails

**Current:** Calendar events can only be created via explicit voice command ("schedule a meeting tomorrow at 2pm") or UI. The Board Update doesn't create events.

**Needed:** When the AI reads an email body containing scheduling language ("let's meet Thursday at 2pm", "deadline is March 15"), it should propose calendar events as suggested actions (see Gap 3 above).

**Fix:** This is handled by Gap 3's `suggestedActions` with `type: "create_event"`. The AI detects scheduling intent from email content and proposes it. The user taps [Schedule] to confirm.

**Important:** We do NOT auto-create events without user confirmation. The AI proposes, the user accepts. This prevents calendar spam from misinterpreted emails.

**Demo scope impact:** For the demo, we need the Google Calendar scope to be `calendar` (read+write), not `calendar.readonly`. This is a change from the demo plan which said "all read-only". We need write access to actually push events to Google Calendar -- that's the wow factor ("it scheduled the meeting AND it appeared in my real Google Calendar").

---

### GAP 5: Save AI Artifacts to Google Drive

**Current:** Meeting summaries are stored in the `meeting_notes` table in Supabase. Drive integration is read-only (list files). No ability to write files to Drive.

**Needed:** When the AI generates artifacts (board update summaries, meeting transcription summaries), the user should be able to save them to the project's Google Drive folder. The flow:
1. AI generates meeting summary or board update report
2. User taps "Save to Drive"
3. Backend creates a Google Doc (or uploads a .md/.txt file) in the project's Drive folder
4. File appears in the project's Files tab

**Fix:**
- Change Drive scope from `drive.readonly` to `drive.file` (allows creating files in app-created folders)
- Add `save_to_drive` AI function declaration
- Add `POST /drive/save/:projectId` endpoint that accepts text content and creates a file
- `driveService.js` needs a `createFile(folderId, fileName, content, mimeType)` method

**Schema:** No schema change needed -- the file lives in Drive, and when the Files tab lists Drive files, it will appear automatically.

**UX Impact:** Add a "Save to Drive" button on:
- Board Update detail view (save the full report as a document)
- Meeting Notes detail view (save transcript + summary to project Drive)
- VoiceOverlay after board update ("Save this report to Drive" as a suggested action)

---

### GAP 6: Email Rules Need Project Association in the UI

**Current:** Email rules are managed on the GmailSettingsScreen (Section 10), globally. There's no way to say "this rule is for the Genomics Study project."

**Needed:** The "Add Rule" modal needs a Project picker. The ProjectDetailScreen's Emails tab should also have a shortcut to add a rule for that project.

**UX Impact:**
- Section 10.2 (Add Rule Modal): Add a "Project" picker field (same as the event create modal's project picker)
- Section 16.3 (Emails Tab): Add a "+ Add Rule" button if no rules exist for this project, with project pre-selected

---

## Updated Demo Script (Researcher Analyst)

### Act 1: Setup (30 seconds)
- "Alex is a research analyst managing 3 projects under different PIs."
- Show Dashboard with 3 projects: Genomics Study, Climate Modeling, Drug Discovery
- Each has some tasks, some overdue
- "Alex's Gmail, Drive, and Calendar are connected."

### Act 2: Board Update (90 seconds) -- THE HERO
- Alex taps [Update] or says "Update my board"
- Progress: "Scanning emails... Checking Drive... Syncing calendar... Generating summary..."
- AI summary appears:

```
Genomics Study (Dr. Chen):
  - New email: "Please revise the analysis figures by Friday.
    Let's meet Thursday at 2pm to discuss."
  - analysis-v3.xlsx updated in Drive 3 hours ago
  - 'Literature Review' task is overdue by 3 days

Climate Modeling (Prof. Rivera):
  - New email: "Model run results look promising. Can you
    prepare a summary for the department meeting Monday?"
  - 2 new files in Drive: model-output-v4.csv, results-chart.png

Drug Discovery (Dr. Patel):
  - No new emails
  - Compound screening deadline tomorrow

SUGGESTED ACTIONS:
  [1] Update 'Revise figures' due date to March 14 (Dr. Chen requested Friday)
  [2] Schedule meeting with Dr. Chen - Thu March 13 at 2pm
  [3] Add task 'Prepare summary for dept meeting' to Climate Modeling (due Monday)
```

### Act 3: Accept Suggestions (60 seconds)
- Alex taps [Schedule] on the meeting suggestion -> event appears in Google Calendar
- Alex taps [Create] on the summary task -> task appears in Climate Modeling project
- Alex says "Mark literature review as complete" -> done

### Act 4: Save Report to Drive (30 seconds)
- Alex taps "Save to Drive" on the board update report
- Report saved as "Board Update - March 7.md" in the Genomics Study Drive folder
- Show it appear in the Files tab

### Act 5: Drill-down (30 seconds)
- Tap into Genomics Study -> Emails tab shows Dr. Chen's email
- Files tab shows the updated analysis-v3.xlsx AND the just-saved board report
- "All context for this project, in one place."

---

## Revised Demo Scope (What Changes)

### Originally cut, now needed for this use case:

| Feature | Original Demo Plan | Revised | Why |
|---|---|---|---|
| Email body storage | Cut (metadata only) | MUST HAVE | AI needs to read email content to summarize and suggest actions |
| Email-project linking | Loose AI matching | MUST HAVE | Researcher needs deterministic email-to-project mapping |
| AI suggested actions | Informational summary only | MUST HAVE | The "propose + accept" flow IS the demo differentiation |
| Calendar write (push) | Cut (read-only) | MUST HAVE | Auto-scheduling meetings from emails is a key wow moment |
| Drive write (save file) | Cut (read-only) | NICE TO HAVE | Saving reports to Drive is impressive but not the hero moment |

### Google OAuth scopes (revised):

```
Scopes:
  - gmail.readonly          (read emails -- unchanged)
  - calendar                (read AND WRITE -- changed from readonly)
  - drive.file              (create files in app folders -- changed from readonly)
  - userinfo.email          (unchanged)
```

### New/Modified AI Functions:

| # | Function | Change |
|---|---|---|
| 16 | `run_board_update` | Enhanced: returns `suggestedActions[]` array with actionable proposals |
| 21 | `accept_suggestion` | NEW: accepts a suggested action from board update (creates task, event, or updates task) |
| 22 | `save_to_drive` | NEW: saves text content as a file in project's Drive folder |

### Schema Changes (in addition to existing plan):

```sql
-- Email rules linked to projects
ALTER TABLE email_rules ADD COLUMN project_id UUID REFERENCES projects(id);

-- Emails linked to projects + full body
ALTER TABLE imported_emails ADD COLUMN project_id UUID REFERENCES projects(id);
ALTER TABLE imported_emails ADD COLUMN body_text TEXT;

-- Board updates store suggested actions
-- (already JSONB, just add suggestedActions to the shape)
```

---

## UX Additions Needed

### 1. Suggested Actions Card (new component for Board Update response)

After the AI summary, render actionable suggestion cards:

```
+--------------------------------------+
| [Calendar] Schedule meeting          |
| Meeting with Dr. Chen                |
| Thu, March 13 at 2:00 PM            |
| Source: Dr. Chen's email             |
|                [Schedule] [Dismiss]   |
+--------------------------------------+
```

**Card specs:**
- Background: `rgba(0, 122, 255, 0.05)` (light blue tint)
- Border: 1px solid `rgba(0, 122, 255, 0.15)`
- Border radius: 12px
- Padding: 12px
- Icon: 20px, colored by action type (Calendar=`primary`, Task=`success`, Update=`warning`)
- Title: 15pt, Semibold, `textPrimary` (the action description)
- Detail lines: 14pt, Regular, `textSecondary`
- Source line: 13pt, Italic, `textSecondary` (which email triggered this)
- [Accept] button: `primary` background, white text, 32px height, pill shape
- [Dismiss] button: `backgroundLight` background, `textSecondary` text

**In VoiceOverlay:** Suggested actions render as scrollable cards below the AI summary. User can tap [Accept] or speak "accept all" / "schedule the meeting" / "skip that one".

**On Dashboard:** After board update, suggested actions appear as a section below the Board Status Card:

```
SUGGESTED ACTIONS (3)
+--------------------------------------+
| Update due date: Revise figures      |
| March 10 -> March 14    [Apply] [x]  |
+--------------------------------------+
| Schedule: Meeting with Dr. Chen      |
| Thu 2pm            [Schedule] [x]    |
+--------------------------------------+
| New task: Prepare dept summary       |
| Climate Modeling   [Create] [x]      |
+--------------------------------------+
```

### 2. "Add Rule" Modal Update (Section 10.2)

Add Project picker field:

```
|  Project       [None                  v]  |  <- Picker: user's projects + "None"
```

- Same picker style as event create modal
- Position: after Subject Contains field, before Save Rule button
- When set, imported emails from this rule get `project_id` automatically

### 3. "Save to Drive" Button

Appears on:
- Board Update detail view: top-right action button
- Meeting Notes detail: action button in header
- VoiceOverlay: as a suggested action pill after board update

```
[Save to Drive] -- pill button, `primary` outline style
```

On tap: shows project picker (which Drive folder?) -> saves as markdown file -> success toast "Saved to Genomics Study Drive"

### 4. Email Card Enhancement (Section 10.3)

Email cards in the project Emails tab should show an AI-extracted summary line:

```
+------------------------------------------+
| [AV]  Dr. Sarah Chen        2h ago      |
|       Re: Analysis revision              |
|       "Please revise figures by Friday.  |
|        Let's meet Thursday at 2pm."      |
|                                          |
|  AI: Requests revised figures by Fri.    |  <- NEW: AI summary line
|      Proposes meeting Thu 2pm.           |
|                                          |
|  [Create Task] [Schedule Meeting]        |  <- Enhanced actions
+------------------------------------------+
```

- AI summary line: 13pt, Medium, `primary`, with a sparkle icon (8px) prefix
- The action buttons are contextual: if the AI detected a scheduling request, show [Schedule Meeting] instead of generic [Draft Reply]

---

## Risk Assessment for Revised Scope

| Risk | Impact | Mitigation |
|---|---|---|
| Calendar write scope needs Google verification | HIGH | Use test/development OAuth (unverified apps work for <100 users). Demo is single-user. |
| Drive write scope needs consent | MEDIUM | `drive.file` is a restricted scope but works in dev mode. Pre-authorize before demo. |
| AI suggested actions are wrong | MEDIUM | Seed specific emails with clear actionable language. Test the exact email content beforehand. |
| Email body text is too long for Gemini context | LOW | Truncate to 1000 chars per email. 10 emails = 10k chars, well within context window. |
| Board update takes too long with email body reading | LOW | 3 projects x 2-3 emails each = 6-9 emails. Gmail API is fast. Add progress indicator. |

---

## Build Priority (Revised)

1. **Email body storage + project linking** (schema + gmail service update) -- FIRST, unblocks everything
2. **Enhanced Board Update Engine** (read email bodies, generate suggestedActions) -- THE HERO
3. **Calendar write** (push events to Google Calendar from suggestions) -- KEY WOW
4. **Suggested Actions UI** (cards with accept/dismiss on Dashboard + VoiceOverlay) -- CRITICAL UX
5. **Drive write** (save reports to Drive) -- NICE TO HAVE
6. **Updated email rules with project picker** -- POLISH

---

## Alignment with Test Engineer's Demo Scenario

The Test Engineer produced `test_engineer/DEMO_SCENARIO.md` with a research analyst persona (Dr. Alex Chen, 3 projects, 3 PIs). Here is how their scenario maps to our feature gaps:

| Test Engineer Scene | Requires | Gap Status |
|---|---|---|
| Scene 1: "Catch me up" -> Board Update | Email body reading, AI summary, task status | **GAP 2** (email bodies) + existing board update |
| Scene 2: Email triage + create task from email | Email-project association, email body storage | **GAP 1** + **GAP 2** |
| Scene 3: Task management + overdue detection | Existing v1 features | NO GAP -- works today |
| Scene 4: Scheduling meetings | Calendar write (push to Google Calendar) | **GAP 4** -- need calendar write scope |
| Scene 5: Drive files listing | Existing v2 architecture | NO GAP -- already planned |
| Scene 6: Quick create project with batch tasks | Existing v1 create_project with tasks[] | NO GAP -- works today |

### What the Test Engineer scenario DOESN'T cover but we should add:

1. **AI suggested actions from email content** (Gap 3) -- The test scenario has the user manually creating tasks from emails. Our enhanced version should show the AI PROPOSING actions automatically during board update. This is the key differentiator.

2. **Auto-detected calendar scheduling from emails** (Gap 4) -- Scene 2 has "Dr. Park reminded about conference abstract deadline." Our version should have the AI propose: "[Schedule] Conference abstract deadline - March 15" as a suggested action.

3. **Save to Drive** (Gap 5) -- Not in the test scenario, but would be a strong closing moment: "Save this morning's board report to my Alzheimer's project Drive."

### Recommended: Merge the scenarios

The test engineer's project names and seed data are better (NIH Grant, NSF Study, Industry Collab -- sounds real and professional). We should adopt their naming and seed data but overlay our enhanced features on top.

**Revised Scene 1 (The Hero -- merging both versions):**
```
Voice: "Good morning, catch me up"
AI: "Here's your morning update:

  NIH Grant - Alzheimer's Biomarkers:
    Dr. Mitchell shared preliminary biomarker results and
    asked to discuss them Friday. She also sent a protocol
    amendment requiring updated consent forms.

  NSF Climate Modeling:
    Dr. Park reminded you: conference abstract deadline is
    March 15 (8 days away). Model calibration is overdue by 3 days.

  Industry Collab - Genomics:
    Meeting with Dr. Sharma tomorrow at 10am. No new emails.

  SUGGESTED ACTIONS:
  [1] Create task: 'Review protocol amendment' in Alzheimer's (from Dr. Mitchell's email)
  [2] Schedule: Meeting with Dr. Mitchell - Friday 2pm (she suggested this)
  [3] Update: Move 'Model calibration' due date (overdue by 3 days)
  [4] Reminder: Conference abstract due March 15 - consider adding to calendar"
```

User taps [Schedule] -> meeting appears in Google Calendar.
User taps [Create] -> task appears in Alzheimer's project.
User says "Push model calibration to next Friday" -> done.

This combines the test engineer's realistic data with our suggested-actions UX. The test engineer should update their seed data to include:
- Email bodies with clear actionable language (not just subjects/snippets)
- `project_id` on email rules so emails map to specific projects
- Calendar events should include `google_event_id` for synced events
