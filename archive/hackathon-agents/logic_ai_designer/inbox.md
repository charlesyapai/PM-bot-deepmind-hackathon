# 📬 Logic-AI Designer — Inbox

**Role:** Logic-AI Designer — responsible for the AI prompt engineering, intent parsing, guardrails, and Gemini function calling strategy.

**Responsibilities:**

- Design the AI prompt engineering strategy for voice commands
- Define function declarations and guardrails for Gemini
- Ensure intent parsing is accurate, context-aware, and conversational
- Coordinate with Backend Engineer on intent execution

> 📡 **READ FIRST:** [Communication Protocol](../communication_protocol.md) — all agents must follow these rules.
> 📋 **Project Spec:** [Project Requirements](../project_manager/project_requirements.md)

---

## Messages

### PM → Logic-AI Designer: 11:30am, 7th March 2026

**From:** Project Manager
**Subject:** 🔴 URGENT — Smarter AI Intelligence + Housekeeping + Gmail Context Integration

---

Hi Logic-AI Designer,

Three major upgrades to the AI system this session. These are critical for the demo — we need the AI to feel like a real personal project manager, not just a command parser.

**TASK 1: Smarter Context-Aware Tooling**

The AI needs to be significantly smarter about working with existing data. Update the Gemini system instruction and function declarations to handle these scenarios:

1. **Duplicate/completion detection**: Before creating a task, the AI should check context for similar existing tasks. If a match exists:
   - If the task is already `done`, respond: "That task is already completed! Anything else?"
   - If a similar task exists (fuzzy title match), ask: "You already have 'Buy groceries' — did you mean to update it?"

2. **Duration & deadline inference**: When the user says "this should take about 2 days" or "I need this done by Friday", the AI should:
   - Calculate the `dueDate` from relative expressions using today's date
   - For duration mentions, set `dueDate = today + duration`
   - If a task already has a due date, confirm before overwriting

3. **Task refinement**: When the user gives a vague task ("work on the app"), the AI should:
   - Suggest breaking it into sub-tasks based on the project context
   - Use `respond` with `suggestedActions` like: "That's pretty broad. Want me to break it into: 'Fix login bug', 'Update styling', 'Add tests'?"

4. **Status-aware updates**: When the user says "mark the design task as done", the AI should:
   - Find the task by fuzzy matching the title against context
   - If multiple matches, use `clarify` with the specific options
   - If the task is already done, say so instead of updating redundantly
   - If the task doesn't exist, suggest creating it

5. **Smart project inference improvement**: Strengthen the context formatting so Gemini has task titles grouped under each project, making it easier to resolve "add a task to my marketing project" without clarification.

**TASK 2: Housekeeping Function**

Add a new `run_housekeeping` function declaration to Gemini. This is triggered when the user says things like:
- "Clean up my board"
- "What needs attention?"
- "Do a health check"
- "Any overdue tasks?"
- "Help me organize"

The function should take no parameters. The intent executor will call a backend analysis endpoint that returns a structured health report. The AI then presents the findings conversationally via `respond`.

The housekeeping analysis should cover:
- Overdue tasks (due_date < today, status != done)
- Stale projects (no task updates in 7+ days)
- Tasks without due dates or priorities
- Calendar events that already passed (status still 'scheduled')
- Upcoming deadlines in next 48 hours

Add the function declaration:
```
{
  name: "run_housekeeping",
  description: "Analyze the user's projects, tasks, and calendar for items needing attention. Use when user asks to clean up, organize, or wants a health check of their boards.",
  parameters: { type: "OBJECT", properties: {} }
}
```

**TASK 3: Gmail Context Integration (AI Side)**

We're adding Gmail integration. The AI needs to understand email context. Add a new function declaration:

```
{
  name: "check_emails",
  description: "Check the user's imported emails based on their defined rules. Use when the user asks about emails, messages from someone, or wants to review communications.",
  parameters: {
    type: "OBJECT",
    properties: {
      sender: { type: "STRING", description: "Filter by sender email or name (optional)" },
      label: { type: "STRING", description: "Filter by Gmail label (optional)" },
      since: { type: "STRING", description: "ISO date to filter emails from (optional, defaults to last 7 days)" }
    }
  }
}
```

Also add `create_task_from_email`:
```
{
  name: "create_task_from_email",
  description: "Create a task from an imported email. Use when the user says 'make a task from that email' or 'add Sarah's email to my project'.",
  parameters: {
    type: "OBJECT",
    properties: {
      emailId: { type: "STRING", description: "The ID of the imported email to create a task from" },
      projectId: { type: "STRING", description: "Target project ID (auto-select if only one)" },
      priority: { type: "STRING", enum: ["low", "medium", "high", "urgent"] }
    },
    required: ["emailId"]
  }
}
```

Update the system instruction to mention:
- The user may have imported emails in their context
- The AI can reference email subjects/senders when suggesting tasks
- "You got 3 emails from Sarah about the marketing project — want me to create tasks from them?"

**Files to update:**
1. `backend/src/services/logicAi/geminiClient.js` — Add new function declarations + update system instruction
2. `backend/src/services/logicAi/intentExecutor.js` — Add handlers for `run_housekeeping`, `check_emails`, `create_task_from_email`
3. `backend/src/services/logicAi/voiceCommandHandler.js` — Add imported emails to context object, enhance task context with grouped-by-project format
4. `logic_ai_designer/notes.md` — Update strategy documentation
5. `logic_ai_designer/progress.md` — Update status
6. Write status to `project_manager/inbox_from_logic_ai_designer.md`

**— Project Manager**

---

### PM → Logic-AI Designer: 8:00pm, 7th March 2026

**From:** Project Manager
**Subject:** v2 Google Integration — 6 New Gemini Function Declarations

---

Hi Logic-AI Designer,

v1 intents are working well (14 functions, Gemini 2.0 Flash). We're now adding **6 new function declarations** for v2 Google integration. Read `architecture_designer/GOOGLE_INTEGRATION_ARCHITECTURE.md` Section 7 for full details.

**NEW FUNCTION DECLARATIONS**

| # | Function | Purpose | Key Params |
|---|---|---|---|
| 15 | `sync_calendar` | Trigger Google Calendar sync | `direction`: 'pull' / 'push' / 'both' |
| 16 | `run_board_update` | Trigger full board update (compound operation) | `projectId` (optional, for single-project focus) |
| 17 | `upload_to_drive` | Upload file to project's Drive folder | `projectId`, `fileName` |
| 18 | `list_drive_files` | List files in project's Drive folder | `projectId` |
| 19 | `read_drive_file` | Get content/summary of a Drive file | `fileId` or `fileName` + `projectId` |
| 20 | `draft_email` | Create a Gmail draft (reply or new) | `to`, `subject`, `body`, `replyToEmailId` (optional) |

**SYSTEM INSTRUCTION ADDITIONS**

Add to the existing system instruction:
```
You are also aware of the user's Google ecosystem:
- Their Google Calendar events are synced. When they say "schedule a meeting",
  create it both locally AND on Google Calendar.
- Each project may have a Google Drive folder. When they mention files or documents,
  check the project's Drive folder first.
- When they say "update my board" or "what's new", trigger run_board_update
  which scans emails, Drive, calendar, and tasks holistically.
- When they say "draft a reply to that email", use draft_email to compose
  a Gmail draft they can review before sending.
- Never send an email directly -- always create a draft. The user must
  explicitly confirm sending.
```

**UPDATED CONTEXT OBJECT**

The `voiceCommandHandler.js` context now needs to include:
- `googleConnected: boolean` -- whether user has Google linked
- `driveFiles` per project -- list of Drive files with names and modified times
- `upcomingEvents` with `source` field ('google_calendar' or 'app')
- `recentEmails` -- last N imported emails
- `lastBoardUpdate` -- timestamp of last board update

**VOICE COMMAND EXAMPLES**

| Voice Command | AI Function |
|---|---|
| "Update my board" | `run_board_update` |
| "What's new in my marketing project?" | `run_board_update(projectId)` |
| "Upload this to the app project" | `upload_to_drive(projectId)` |
| "What files are in my marketing Drive?" | `list_drive_files(projectId)` |
| "Read the design spec" | `read_drive_file(fileName, projectId)` |
| "Draft a reply saying we'll push to next week" | `draft_email(replyToEmailId, body)` |
| "Sync my calendar" | `sync_calendar(direction: 'both')` |

**KEY GUARDRAIL: Never send emails directly. Always create a draft.**

**Files to update:**
1. `backend/src/services/logicAi/geminiClient.js` -- Add 6 new function declarations + system instruction update
2. `backend/src/services/logicAi/intentExecutor.js` -- Add handlers for new intents
3. `backend/src/services/logicAi/voiceCommandHandler.js` -- Expand context with Google data
4. `logic_ai_designer/notes.md` -- Update documentation
5. `logic_ai_designer/progress.md` -- Update status
6. Write to `project_manager/inbox_from_logic_ai_designer.md`

**-- Project Manager**

---
