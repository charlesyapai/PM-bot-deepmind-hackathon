"use strict";

/**
 * geminiClient.js
 *
 * Gemini 2.5 Flash wrapper for voice-command intent parsing.
 *
 * Responsibilities:
 *   - Initialise the Google Generative AI SDK with the project's API key
 *   - Define function declarations for project management, task management,
 *     calendar events, and general assistant responses
 *   - Export parseIntent(transcript, context) -- called by the voice pipeline
 *     after Deepgram returns a final transcript
 *
 * Environment variables required:
 *   GEMINI_API_KEY  -- Google AI Studio / Vertex AI API key
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ---------------------------------------------------------------------------
// SDK initialisation
// ---------------------------------------------------------------------------

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------------------------------------------------------------------
// System instruction
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION = `
You are the AI assistant for PersonalBot, a voice-driven personal project and task manager.
You act as a helpful, conversational personal project manager -- not just an intent parser.

YOUR PERSONALITY:
- Friendly, concise, and proactive
- When greeting the user or answering general questions, use the "respond" function
- Offer helpful suggestions and status summaries when appropriate
- Be encouraging about progress ("Nice work -- 3 tasks done today!")

CONTEXT USAGE -- CRITICAL RULES:
- You receive the user's projects (with their tasks grouped underneath), tasks, calendar events, and imported emails as structured context
- When the user references "my project" or "the project" and context has EXACTLY ONE project, auto-select it -- do NOT ask for clarification
- When context has multiple projects, infer from conversation history or recent context which one they mean. Only clarify if truly ambiguous
- Use task titles, project names, and IDs from context to resolve references. NEVER invent IDs or entity names
- Today's date and day of week are provided in context -- use them to resolve relative dates ("tomorrow", "next Monday", "in 3 days")
- Projects in context include a "tasks" array -- use it to find tasks by title within a specific project

SMART INFERENCE:
- If the user just created a project and then says "add a task", use that project
- If conversation history mentions a specific project, prefer it for subsequent commands
- Match partial names: "the marketing project" should match "Marketing Campaign Q2"
- For task references like "mark the first one done", use the task list order from context

DUPLICATE & COMPLETION DETECTION:
- Before creating a task, check the context for existing tasks with similar titles
- If a matching task already has status "done", respond: "That task is already completed! Anything else?"
- If a similar task exists and is not done, ask: "You already have '[task title]' -- did you mean to update it?"
- Use fuzzy matching: "buy groceries" matches "Buy Groceries", "groceries shopping" etc.

DURATION & DEADLINE INFERENCE:
- When the user says "this should take about 2 days" or "I need this done by Friday", calculate the dueDate
- For duration mentions ("takes 3 days", "about a week"), set dueDate = todayISO + duration
- For named days ("by Friday", "next Tuesday"), resolve to the correct ISO date using todayISO and dayOfWeek
- If a task already has a due date in context, confirm before overwriting: "That task is due [date] -- want me to change it to [new date]?"

TASK REFINEMENT:
- When the user gives a vague task ("work on the app", "do stuff"), suggest breaking it into sub-tasks based on the project context
- Use respond with suggestedActions like: "That's pretty broad. Want me to break it into: 'Fix login bug', 'Update styling', 'Add tests'?"
- Base suggestions on existing tasks and project context when possible

STATUS-AWARE UPDATES:
- When the user says "mark the design task as done", find the task by fuzzy matching the title against context
- If multiple tasks match, use clarify with the specific options listed
- If the task is already done, say so: "That task is already marked as done!"
- If the task doesn't exist, suggest creating it: "I don't see that task. Want me to create it?"

EMAIL AWARENESS:
- The user may have imported emails in their context (recentEmails array)
- You can reference email subjects and senders when suggesting tasks
- Proactively mention relevant emails: "You got 3 emails from Sarah about the marketing project -- want me to create tasks from them?"
- Use check_emails to search/filter emails, and create_task_from_email to turn an email into a task

HOUSEKEEPING:
- When the user asks to "clean up", "organize", "do a health check", "what needs attention?", or "any overdue tasks?", use run_housekeeping
- Present the results conversationally, highlighting the most important items first
- After showing housekeeping results, if the user says "clean up", "do it", "fix it", "archive the stale ones", use auto_cleanup to perform the suggested actions automatically
- "Clean up my boards" on FIRST mention -> run_housekeeping (show report first). On SECOND mention or after seeing results -> auto_cleanup (perform actions)

GOOGLE ECOSYSTEM AWARENESS:
- The context includes a "googleConnected" boolean. If false, and the user requests a Google-specific action (sync calendar, upload to Drive, draft email, board update), use respond to say: "You'll need to connect your Google account first. Head to Settings > Google Account to get started."
- Their Google Calendar events are synced. When they say "schedule a meeting", create it both locally AND on Google Calendar via sync_calendar.
- Each project may have a Google Drive folder (indicated by "driveFolderId" in context). When they mention files or documents, check the project's Drive folder first.
- When they say "update my board" or "what's new", trigger run_board_update which scans emails, Drive, calendar, and tasks holistically. This is the POWER COMMAND for broad status requests.
- When they say "draft a reply to that email", use draft_email to compose a Gmail draft they can review before sending.
- Never send an email directly -- always create a draft. The user must explicitly confirm sending.
- "driveFiles" per project shows files with names and modified times. Reference these when the user asks about documents.
- "lastBoardUpdate" shows when the last board update was performed. If recent (< 5 min), suggest using the cached results instead of re-running.
- "upcomingEvents" includes a "source" field ('google_calendar' or 'app') -- mention this when listing events so the user knows where they came from.

BOARD UPDATE vs SPECIFIC QUERIES:
- "What's new?" / "Catch me up" / "Status update" / "Update my board" -> run_board_update (broad compound operation)
- "What's new in my marketing project?" -> run_board_update with projectId (focused update)
- "What tasks do I have?" -> list_tasks (specific query, don't use board update)
- "Any emails from Sarah?" -> check_emails (specific query, don't use board update)
- "What's on my calendar?" -> list_events (specific query, don't use board update)
- Board update is for when the user wants a holistic cross-source status, not for specific queries

GUARDRAILS -- follow without exception:
1. Destructive actions (delete) require an explicit, exact name match from context. Ambiguous phrases like "delete that thing" must trigger clarify.
2. Hallucination prevention: only reference entities that exist in the supplied context. If the referenced entity is not in context, call clarify.
3. Low confidence: if you are less than 70% confident about the user's intent, call clarify with a clear question.
4. Single intent per request: only call one function per turn. If the user requests multiple actions, handle the most important one and suggest the rest via respond's suggestedActions.
5. Always call a function -- never return plain text without a function call.

FUNCTION SELECTION GUIDE:
- Greetings, status questions, general chat -> respond
- "What are my projects?" / "Show projects" -> list_projects
- "What tasks do I have?" / "Show my tasks" -> list_tasks
- "Add a task..." / "Create task..." -> create_task
- "Mark X as done" / "Update task..." -> update_task
- "Start a new project..." -> create_project
- "Delete project X" / "Remove project X" -> delete_project
- "Schedule a meeting..." / "Add event..." -> create_event
- "What's on my calendar?" / "Events this week" -> list_events
- "Move the meeting to..." / "Change event time..." -> update_event
- "Cancel the meeting..." / "Delete event..." -> delete_event
- "Clean up my board" / "What needs attention?" -> run_housekeeping
- "Check my emails" / "Any emails from Sarah?" -> check_emails
- "Make a task from that email" -> create_task_from_email
- "Sync my calendar" -> sync_calendar
- "Update my board" / "What's new?" / "Catch me up" -> run_board_update
- "Upload this to my project" -> upload_to_drive
- "What files are in my Drive?" -> list_drive_files
- "Read the design spec" -> read_drive_file
- "Draft a reply to that email" / "Send an email to..." -> draft_email
`.trim();

// ---------------------------------------------------------------------------
// Function declarations (Gemini schema format)
// ---------------------------------------------------------------------------

const functionDeclarations = [
  // --- Project Management ---
  {
    name: "create_project",
    description:
      "Create a new project. Use when the user wants to start a new project or initiative.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: {
          type: "STRING",
          description: "Name of the new project.",
        },
        templateId: {
          type: "STRING",
          description: "UUID of the template to apply (optional).",
        },
        description: {
          type: "STRING",
          description: "Optional description of the project.",
        },
        tasks: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "Task title." },
              priority: { type: "STRING", description: "Priority: low, medium, high, or urgent.", enum: ["low", "medium", "high", "urgent"] },
              dueDate: { type: "STRING", description: "ISO 8601 due date (optional)." },
            },
            required: ["title"],
          },
          description: "Optional list of tasks to create inside the new project. Use when the user mentions tasks alongside the project creation.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "list_projects",
    description:
      "List the user's projects. Use when the user asks 'show my projects', 'what am I working on?', or wants an overview of their projects.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "delete_project",
    description:
      "Delete (archive) a project. GUARDRAIL: requires explicit project name match from context. Use when the user says 'delete project X', 'remove project X', or 'get rid of project X'.",
    parameters: {
      type: "OBJECT",
      properties: {
        projectId: {
          type: "STRING",
          description: "The UUID of the project to delete. Must match a project in context by title.",
        },
      },
      required: ["projectId"],
    },
  },

  // --- Task Management ---
  {
    name: "create_task",
    description:
      "Create a new task in a project. Use when the user wants to add a task or to-do item. If context has exactly one project, use its ID automatically.",
    parameters: {
      type: "OBJECT",
      properties: {
        projectId: {
          type: "STRING",
          description: "The UUID of the target project. Auto-select if only one project exists in context.",
        },
        title: {
          type: "STRING",
          description: "Short, clear title for the task.",
        },
        priority: {
          type: "STRING",
          description: "Priority level: low, medium, high, or urgent.",
          enum: ["low", "medium", "high", "urgent"],
        },
        dueDate: {
          type: "STRING",
          description: "ISO 8601 due date string (optional). Resolve relative dates using today's date from context.",
        },
        description: {
          type: "STRING",
          description: "Optional longer description of the task.",
        },
      },
      required: ["projectId", "title"],
    },
  },
  {
    name: "update_task",
    description:
      "Update an existing task's status, priority, or title. Use when the user wants to modify, complete, or change a task. 'Mark as done' sets status to 'done'.",
    parameters: {
      type: "OBJECT",
      properties: {
        taskId: {
          type: "STRING",
          description: "The UUID of the task to update. Resolve from context by matching task title.",
        },
        status: {
          type: "STRING",
          description:
            "New status value: todo, in_progress, or done.",
        },
        priority: {
          type: "STRING",
          description: "New priority: low, medium, high, or urgent.",
          enum: ["low", "medium", "high", "urgent"],
        },
        title: {
          type: "STRING",
          description: "Updated task title (optional).",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "list_tasks",
    description:
      "List tasks, optionally filtered by project, status, or priority. Use when the user asks 'what tasks do I have?', 'show my to-dos', or 'what's left to do?'.",
    parameters: {
      type: "OBJECT",
      properties: {
        projectId: {
          type: "STRING",
          description: "Filter by project UUID (optional). Auto-select if only one project.",
        },
        status: {
          type: "STRING",
          description: "Filter by status: todo, in_progress, or done (optional).",
        },
        priority: {
          type: "STRING",
          description: "Filter by priority: low, medium, high, or urgent (optional).",
          enum: ["low", "medium", "high", "urgent"],
        },
      },
    },
  },

  // --- Calendar Events ---
  {
    name: "create_event",
    description:
      "Create a new calendar event. Use when the user wants to schedule a meeting, appointment, deadline, or reminder.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: {
          type: "STRING",
          description: "Title/name of the event.",
        },
        date: {
          type: "STRING",
          description: "ISO 8601 date (YYYY-MM-DD). Resolve relative dates like 'tomorrow' using today's date from context.",
        },
        startTime: {
          type: "STRING",
          description: "Start time in HH:MM (24h) format.",
        },
        endTime: {
          type: "STRING",
          description: "End time in HH:MM (24h) format.",
        },
        description: {
          type: "STRING",
          description: "Optional description or notes for the event.",
        },
        projectId: {
          type: "STRING",
          description: "Optional project UUID to associate this event with.",
        },
      },
      required: ["title", "date"],
    },
  },
  {
    name: "list_events",
    description:
      "List calendar events within a date range. Use when the user asks 'what's on my calendar?', 'events this week', or 'what do I have tomorrow?'.",
    parameters: {
      type: "OBJECT",
      properties: {
        fromDate: {
          type: "STRING",
          description: "Start date filter in ISO 8601 (YYYY-MM-DD). Defaults to today if not specified.",
        },
        toDate: {
          type: "STRING",
          description: "End date filter in ISO 8601 (YYYY-MM-DD). Defaults to 7 days from fromDate if not specified.",
        },
      },
    },
  },
  {
    name: "update_event",
    description:
      "Update an existing calendar event. Use when the user wants to reschedule, rename, or modify an event.",
    parameters: {
      type: "OBJECT",
      properties: {
        eventId: {
          type: "STRING",
          description: "The UUID of the event to update. Resolve from context by matching event title.",
        },
        title: {
          type: "STRING",
          description: "Updated event title (optional).",
        },
        date: {
          type: "STRING",
          description: "Updated date in ISO 8601 (optional).",
        },
        startTime: {
          type: "STRING",
          description: "Updated start time in HH:MM 24h format (optional).",
        },
        endTime: {
          type: "STRING",
          description: "Updated end time in HH:MM 24h format (optional).",
        },
        description: {
          type: "STRING",
          description: "Updated description (optional).",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "delete_event",
    description:
      "Delete a calendar event. GUARDRAIL: requires explicit name match from context. Do not delete if the name is ambiguous.",
    parameters: {
      type: "OBJECT",
      properties: {
        eventId: {
          type: "STRING",
          description: "The UUID of the event to delete. Must match an event in context by exact title.",
        },
      },
      required: ["eventId"],
    },
  },

  // --- Housekeeping ---
  {
    name: "run_housekeeping",
    description:
      "Analyze the user's projects, tasks, and calendar for items needing attention. Use when user asks to clean up, organize, or wants a health check of their boards.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "auto_cleanup",
    description:
      "Perform automated cleanup: archive stale projects, mark past events as completed. Use when the user says 'clean up', 'do the cleanup', 'fix it', 'archive the stale ones' AFTER seeing housekeeping results. Also use for 'delete all stale projects'.",
    parameters: {
      type: "OBJECT",
      properties: {
        archiveStaleProjects: {
          type: "BOOLEAN",
          description: "Whether to archive projects with no recent activity (default true).",
        },
        completePastEvents: {
          type: "BOOLEAN",
          description: "Whether to mark past scheduled events as completed (default true).",
        },
      },
    },
  },

  // --- Gmail Integration ---
  {
    name: "check_emails",
    description:
      "Check the user's imported emails based on their defined rules. Use when the user asks about emails, messages from someone, or wants to review communications.",
    parameters: {
      type: "OBJECT",
      properties: {
        sender: {
          type: "STRING",
          description: "Filter by sender email or name (optional).",
        },
        label: {
          type: "STRING",
          description: "Filter by Gmail label (optional).",
        },
        since: {
          type: "STRING",
          description:
            "ISO date to filter emails from (optional, defaults to last 7 days).",
        },
      },
    },
  },
  {
    name: "create_task_from_email",
    description:
      "Create a task from an imported email. Use when the user says 'make a task from that email' or 'add Sarah's email to my project'.",
    parameters: {
      type: "OBJECT",
      properties: {
        emailId: {
          type: "STRING",
          description: "The ID of the imported email to create a task from.",
        },
        projectId: {
          type: "STRING",
          description:
            "Target project ID (auto-select if only one project exists).",
        },
        priority: {
          type: "STRING",
          description: "Priority level for the created task.",
          enum: ["low", "medium", "high", "urgent"],
        },
      },
      required: ["emailId"],
    },
  },

  // --- Google Integration (v2) ---
  {
    name: "sync_calendar",
    description:
      "Trigger a sync between the app's calendar and Google Calendar. Use when the user says 'sync my calendar', 'pull my Google events', or 'push my events to Google'.",
    parameters: {
      type: "OBJECT",
      properties: {
        direction: {
          type: "STRING",
          description: "Sync direction: 'pull' (Google -> app), 'push' (app -> Google), or 'both' (bidirectional). Defaults to 'both'.",
          enum: ["pull", "push", "both"],
        },
      },
    },
  },
  {
    name: "run_board_update",
    description:
      "Trigger a full board update -- a compound operation that scans emails, checks Drive files, syncs calendar, and runs housekeeping analysis. Returns a holistic AI-synthesized status report. Use for broad status requests like 'update my board', 'what's new?', 'catch me up', 'give me a status update'. Optionally focus on a single project.",
    parameters: {
      type: "OBJECT",
      properties: {
        projectId: {
          type: "STRING",
          description: "Optional project UUID to focus the board update on a single project. If omitted, updates across all projects.",
        },
      },
    },
  },
  {
    name: "upload_to_drive",
    description:
      "Upload a file to a project's Google Drive folder. Use when the user says 'upload this to my project', 'save to Drive', or 'add file to project'. Requires Google to be connected and the project to have a Drive folder.",
    parameters: {
      type: "OBJECT",
      properties: {
        projectId: {
          type: "STRING",
          description: "The UUID of the target project. Auto-select if only one project exists.",
        },
        fileName: {
          type: "STRING",
          description: "The name of the file to upload.",
        },
      },
      required: ["projectId", "fileName"],
    },
  },
  {
    name: "list_drive_files",
    description:
      "List files in a project's Google Drive folder. Use when the user asks 'what files are in my Drive?', 'show project files', or 'what documents do I have?'.",
    parameters: {
      type: "OBJECT",
      properties: {
        projectId: {
          type: "STRING",
          description: "The UUID of the project whose Drive files to list. Auto-select if only one project.",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "read_drive_file",
    description:
      "Get the content or summary of a file in a project's Google Drive folder. For Google Docs/Sheets, exports and summarizes content. Use when the user says 'read the design spec', 'what's in that document?', or 'summarize the file'.",
    parameters: {
      type: "OBJECT",
      properties: {
        fileId: {
          type: "STRING",
          description: "The Google Drive file ID (use if known from context).",
        },
        fileName: {
          type: "STRING",
          description: "The file name to search for (use with projectId if fileId is unknown).",
        },
        projectId: {
          type: "STRING",
          description: "The project UUID to search within (used with fileName).",
        },
      },
    },
  },
  {
    name: "draft_email",
    description:
      "Create a Gmail draft email. NEVER sends directly -- always creates a draft for the user to review. Use when the user says 'draft a reply', 'write an email to...', 'respond to that email'. For replies, use replyToEmailId from the email context.",
    parameters: {
      type: "OBJECT",
      properties: {
        to: {
          type: "STRING",
          description: "Recipient email address. For replies, resolved from the original email's sender.",
        },
        subject: {
          type: "STRING",
          description: "Email subject line. For replies, auto-prefixed with 'Re: '.",
        },
        body: {
          type: "STRING",
          description: "The email body content. Write it in the user's voice based on what they said.",
        },
        replyToEmailId: {
          type: "STRING",
          description: "The ID of the imported email to reply to (optional). If set, this creates a reply draft.",
        },
      },
      required: ["to", "subject", "body"],
    },
  },

  // --- Accept Suggestion (from board update) ---
  {
    name: "accept_suggestion",
    description:
      "Execute a suggested action from a board update. Use when the user says 'do the first one', 'accept suggestion 1', 'yes create that task', 'schedule that meeting', or taps a suggested action card. The suggestion object contains the type and args from the board update.",
    parameters: {
      type: "OBJECT",
      properties: {
        type: {
          type: "STRING",
          description: "The action type: create_project, create_task, update_task, create_event, update_event.",
          enum: ["create_project", "create_task", "update_task", "create_event", "update_event"],
        },
        args: {
          type: "OBJECT",
          description: "The arguments for the action, passed through from the suggestion.",
          properties: {
            title: { type: "STRING" },
            projectId: { type: "STRING" },
            taskId: { type: "STRING" },
            eventId: { type: "STRING" },
            priority: { type: "STRING" },
            dueDate: { type: "STRING" },
            status: { type: "STRING" },
            date: { type: "STRING" },
            startTime: { type: "STRING" },
            endTime: { type: "STRING" },
            description: { type: "STRING" },
          },
        },
        label: {
          type: "STRING",
          description: "Human-readable description of the suggestion being accepted.",
        },
      },
      required: ["type", "args"],
    },
  },

  // --- General Assistant ---
  {
    name: "respond",
    description:
      "Send a conversational response to the user. Use for greetings, status summaries, encouragement, answering questions about their data, or when no CRUD action is needed. Also use when suggesting next steps.",
    parameters: {
      type: "OBJECT",
      properties: {
        message: {
          type: "STRING",
          description: "The assistant's response message to display to the user.",
        },
        suggestedActions: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Optional list of quick-action suggestions the user might want to do next (e.g., 'Create a task', 'Check calendar').",
        },
      },
      required: ["message"],
    },
  },

  // --- Clarification (existing) ---
  {
    name: "clarify",
    description:
      "Ask the user for clarification. Use ONLY when the intent is truly ambiguous, confidence is below 0.7, or the required entity cannot be identified from context. Prefer smart inference over clarification.",
    parameters: {
      type: "OBJECT",
      properties: {
        promptText: {
          type: "STRING",
          description: "The clarifying question to surface to the user.",
        },
      },
      required: ["promptText"],
    },
  },
];

// ---------------------------------------------------------------------------
// Model initialisation
// ---------------------------------------------------------------------------

const model = genAI.getGenerativeModel({
  model: "gemini-3.1-flash-lite-preview",
  systemInstruction: SYSTEM_INSTRUCTION,
  tools: [{ functionDeclarations }],
  generationConfig: { temperature: 0.1 },
});

// ---------------------------------------------------------------------------
// parseIntent
// ---------------------------------------------------------------------------

/**
 * Parse a voice transcript into a structured intent (function call).
 *
 * @param {string} transcript  - Final transcript from Deepgram STT.
 * @param {object} [context]   - Current app state to ground the model's decisions.
 * @returns {Promise<{ name: string, args: object }>}
 */
async function parseIntent(transcript, context = {}) {
  const contextBlock = JSON.stringify(context, null, 2);

  const prompt = `
User's spoken command: "${transcript}"

Current app context (use this to resolve entity names to IDs):
${contextBlock}

Based on the command and context above, call the appropriate function.
`.trim();

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const calls = response.functionCalls();

    if (calls && calls.length > 0) {
      const { name, args } = calls[0];
      return { name, args };
    }

    // Model returned text instead of a function call -- fall back to respond
    const text = response.text();
    if (text) {
      return {
        name: "respond",
        args: { message: text },
      };
    }

    console.warn("[geminiClient] No function call returned for transcript:", transcript);
    return {
      name: "clarify",
      args: { promptText: "I didn't quite catch that. Could you rephrase?" },
    };
  } catch (err) {
    console.error("[geminiClient] Error calling Gemini API:", err.message);
    return {
      name: "clarify",
      args: { promptText: "Something went wrong processing your command. Please try again." },
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { parseIntent };
