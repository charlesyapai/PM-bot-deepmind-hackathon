# Logic-AI Designer -- Working Notes

---

## AI Prompt Engineering Strategy (Gemini Function Calling)

**Date:** 2026-03-07
**Status:** Complete (v5 -- Google Integration, Board Update, Drive, Drafts)

### 1. Core Model & Setup

- **Provider:** Google Gemini via `@google/generative-ai` npm package
- **Model:** `gemini-2.5-flash`
- **Temperature:** `0.1` (deterministic structured output for reliable intent parsing)
- **Response Format:** Gemini native **Function Calling** API with `functionDeclarations` arrays
- **System Prompt:** Set via `systemInstruction` field at model init time

### 2. System Prompt Strategy (v5 -- Google Ecosystem)

The AI is now positioned as a **personal project manager assistant with deep Google integration**, not just an intent parser.

**Key personality traits:**
- Friendly, concise, proactive
- Offers status summaries and suggestions unprompted
- Uses encouraging language for progress updates
- Handles greetings, general questions, and small talk via `respond` function

**Smart context inference:**
- Auto-selects project when context has exactly 1 project (no unnecessary clarification)
- Infers project from conversation history for follow-up commands
- Matches partial names ("marketing project" -> "Marketing Campaign Q2")
- Resolves relative dates using today's date from context
- Handles positional references ("the first one", "that task")

**Reduced clarification:** The prompt now instructs the model to prefer smart inference over asking for clarification. `clarify` is a last resort when truly ambiguous.

**v4 Intelligence additions (retained):**
- Duplicate/completion detection: checks existing tasks before creating, warns if similar task exists or is already done
- Duration & deadline inference: resolves "takes 2 days", "by Friday" to ISO due dates; confirms before overwriting
- Task refinement: suggests sub-tasks when user gives vague commands like "work on the app"
- Status-aware updates: fuzzy-matches task titles, handles already-done and not-found cases gracefully
- Email awareness: references imported emails in context, can suggest creating tasks from emails

**v5 Google ecosystem additions:**
- Google-awareness gating: checks `googleConnected` boolean before Google-specific actions, prompts user to connect if needed
- Board update as power command: `run_board_update` for holistic cross-source status vs specific query functions
- Calendar source tracking: events show `source` field ('google_calendar' or 'app')
- Drive file awareness: projects include `driveFiles` array for file references
- Draft-only email guardrail: `draft_email` never sends -- always creates a draft
- Board update recency: checks `lastBoardUpdate` timestamp to avoid redundant re-runs
- Clear routing guide: distinguishes "what's new?" (board update) from "what tasks do I have?" (list_tasks)

### 3. Function Declarations (21 total)

| # | Function | Purpose | Required Params |
|---|---|---|---|
| 1 | `create_project` | Create new project | title |
| 2 | `list_projects` | Show user's projects with task counts | (none) |
| 3 | `delete_project` | Archive a project | projectId |
| 4 | `create_task` | Create task in project | projectId, title |
| 5 | `update_task` | Modify task status/priority/title | taskId |
| 6 | `list_tasks` | Query tasks with filters | (none, all optional) |
| 7 | `create_event` | Schedule calendar event | title, date |
| 8 | `list_events` | Query events by date range | (none, all optional) |
| 9 | `update_event` | Modify event details | eventId |
| 10 | `delete_event` | Remove calendar event (guarded) | eventId |
| 11 | `run_housekeeping` | Board health check and cleanup analysis | (none) |
| 12 | `auto_cleanup` | Archive stale projects, mark past events | (none, all optional) |
| 13 | `check_emails` | Query imported emails with optional filters | (none, all optional) |
| 14 | `create_task_from_email` | Create a task from an imported email | emailId |
| 15 | `respond` | General assistant responses | message |
| 16 | `clarify` | Ask for clarification (last resort) | promptText |
| 17 | `sync_calendar` | Google Calendar bidirectional sync | (none, direction optional) |
| 18 | `run_board_update` | Full compound board update | (none, projectId optional) |
| 19 | `upload_to_drive` | Upload file to project Drive folder | projectId, fileName |
| 20 | `list_drive_files` | List files in project Drive folder | projectId |
| 21 | `read_drive_file` | Read/summarize a Drive file | (fileId or fileName) |
| 22 | `draft_email` | Create Gmail draft (never sends) | to, subject, body |

### 4. Guardrails

1. **Destructive Actions Guard:** Delete requires explicit name match from context
2. **Hallucination Prevention:** Only reference entities from supplied context
3. **Low Confidence Fallback:** Below 70% confidence triggers clarify
4. **Single Intent Per Turn:** One function call per request; suggest others via `respond.suggestedActions`
5. **Always Call a Function:** Never return plain text without a function call
6. **Draft-Only Email:** `draft_email` never sends -- always creates a draft for user review
7. **Google Gating:** Google-specific functions check `googleConnected` before executing; guide user to Settings if not connected
8. **Board Update Routing:** Broad "what's new?" -> `run_board_update`; specific queries -> dedicated functions

### 5. Context Enrichment (voiceCommandHandler.js)

The context object sent to Gemini now includes:
- **Today's date** (ISO + formatted + day of week) for relative date resolution
- **googleConnected** boolean -- whether user has linked Google account
- **lastBoardUpdate** timestamp -- when last board update was performed
- **Projects** with task count summaries, grouped task arrays, AND Drive file lists per project (driveFolderId + driveFiles array)
- **Recent tasks** with project titles, priorities, due dates
- **Upcoming calendar events** (next 7 days) with times, **source** field ('google_calendar' or 'app'), and googleEventId
- **Recent imported emails** (last 7 days, limit 10) with subject, sender, snippet, label
- **Conversation history** formatted with turn numbers

### 6. Intent Executor Changes (v5)

New handlers:
- `sync_calendar` -- delegates to `calendarSyncService.sync()`, graceful fallback if service not yet built
- `run_board_update` -- delegates to `boardUpdateEngine.runUpdate()`, falls back to housekeeping if engine not built
- `upload_to_drive` -- verifies project has `drive_folder_id`, delegates to `driveService.uploadFile()`
- `list_drive_files` -- verifies project has `drive_folder_id`, delegates to `driveService.listFiles()`
- `read_drive_file` -- delegates to `driveService.readFile()` with fileId or fileName+projectId
- `draft_email` -- delegates to `gmailService.createDraft()` or falls back to `gmailClient`

All new handlers:
- Check Google integration via `getGoogleIntegration()` helper
- Return friendly "connect Google first" message if not connected
- Use graceful `try/catch` require for backend services not yet built
- Verify project ownership before Drive operations

### 7. Backend Service Dependencies (not yet built)

These intent executor handlers call services that are pending implementation by Backend Engineer:

| Service | Used By | Status |
|---|---|---|
| `google/calendarSyncService.js` | `sync_calendar` | Pending |
| `boardEngine/boardUpdateEngine.js` | `run_board_update` | Pending |
| `google/driveService.js` | `upload_to_drive`, `list_drive_files`, `read_drive_file` | Pending |
| `google/gmailService.js` | `draft_email` | Pending |

### 8. Meeting Summarization Pipeline

Unchanged from v2. Uses a separate model instance with `extract_meeting_data` function.

### 9. Q4 Research: Meeting Recording Duration Limits

Unchanged. 120-minute cap retained as operational guardrail.
