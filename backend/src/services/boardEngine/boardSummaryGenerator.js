"use strict";

/*
 * Board Summary Generator
 *
 * Feeds board update data to Gemini to produce a structured, conversational summary
 * with concrete suggested actions the user can accept with one tap.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SUMMARY_SYSTEM_PROMPT = `
You are the AI assistant for PersonalBot. You've just completed a board update scan.
Given the raw data from email, Drive, calendar, and housekeeping scans, produce a
structured, conversational status report AND concrete suggested actions.

You MUST respond with valid JSON in this exact format (no markdown, no code fences):
{
  "summary": "A concise, friendly status report organized by project. Use newline characters for line breaks.",
  "suggestedActions": [
    {
      "type": "create_task",
      "label": "Short human-readable description",
      "args": { "title": "Task title", "projectId": "uuid-from-context", "priority": "high", "dueDate": "2026-03-10" }
    }
  ]
}

RULES FOR SUGGESTED ACTIONS:
- Analyze email content for actionable items: meetings to schedule, tasks to create, deadlines mentioned
- Check overdue tasks and suggest rescheduling with realistic new dates (today + a few days)
- Check upcoming deadlines and suggest prioritization
- Each action must reference real IDs from the context (project IDs, task IDs)
- Action types: "create_project", "create_task", "update_task", "create_event"
- Generate 2-8 concrete, specific actions — not vague suggestions
- The label should be human-readable so the user can quickly accept/dismiss each one
- Keep the summary concise -- it will be read on a small screen or spoken aloud

EMAIL DEDUPLICATION:
- Emails with "already_processed": true have ALREADY been acted on (project/tasks created). Do NOT suggest new actions for these emails.
- Only suggest create_project or create_task for emails where "already_processed" is false.
- You may still mention processed emails in the summary for context, but do NOT generate suggestedActions for them.

BOSS / NEW PROJECT DETECTION:
- The context includes "emailRules" with sender filters. Rules with isBoss=true or no project_id indicate senders who can trigger new project creation.
- When an email describes a NEW initiative, collaboration, or body of work that doesn't match any existing project, suggest "create_project" with tasks extracted from the email body.
- When an email clearly relates to an existing project (matched by sender rule's project_id or by topic), suggest "create_task" within that project instead.
- Always prefer mapping to existing projects when the topic matches. Only suggest create_project for genuinely new initiatives.

TASK ENRICHMENT:
- Every task MUST include a "description" field: 1-2 sentences explaining what the task involves, any context from the email, and what the expected output/deliverable is.
- Every task MUST include a "tags" field: an array of short labels categorizing the task. Use tags from these categories:
  - Size: "big", "medium", or "small" (estimate effort)
  - Type: "meeting", "email-reply", "research", "writing", "review", "admin", "analysis", "coding"
  - Any other relevant context tag (e.g. "urgent", "follow-up", "external")
- Example tags: ["medium", "email-reply", "follow-up"] or ["big", "research", "analysis"]

ACTION ARGS BY TYPE:
- For create_project args: { title, description, tasks: [{ title, priority, dueDate, description, tags }], sourceEmailIds: ["email-id-1"] }
  - sourceEmailIds: include the IDs of emails that triggered this project creation (from the email context)
- For create_task args: { title, projectId, priority, dueDate, description, tags }
- For update_task args: { taskId, status?, priority?, dueDate? }
- For create_event args: { title, date, startTime, endTime, description, projectId }
`;

/**
 * Generate an AI-powered summary with suggested actions from board update data
 * @param {object} data - { emailData, driveData, calendarData, housekeepingData, projects, tasks, emails }
 * @returns {Promise<{ summary: string, suggestedActions: Array }>}
 */
async function generateSummary(data) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

  const prompt = `
Here is the latest board update data. Analyze it and respond with JSON containing a summary and suggestedActions:

EMAIL SCAN:
${JSON.stringify(data.emailData || {}, null, 2)}

RECENT EMAILS (with full body text for action extraction):
${JSON.stringify(data.emails || [], null, 2)}

EMAIL RULES (sender-to-project mapping; isBoss=true means this sender can trigger new project creation):
${JSON.stringify(data.emailRules || [], null, 2)}

DRIVE SCAN:
${JSON.stringify(data.driveData || {}, null, 2)}

CALENDAR SYNC:
${JSON.stringify(data.calendarData || {}, null, 2)}

HOUSEKEEPING:
${JSON.stringify(data.housekeepingData || {}, null, 2)}

ACTIVE PROJECTS (use these IDs in suggestedActions):
${JSON.stringify((data.projects || []).map(p => ({ title: p.title, id: p.id })), null, 2)}

CURRENT TASKS (use these IDs for update_task suggestions):
${JSON.stringify(data.tasks || [], null, 2)}

TODAY'S DATE: ${new Date().toISOString().split("T")[0]}
`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: SUMMARY_SYSTEM_PROMPT }] },
    generationConfig: { maxOutputTokens: 16384, temperature: 0.4 },
  });

  const text = result.response.text();

  // Parse JSON response
  try {
    // Strip potential markdown code fences
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary || text,
      suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
    };
  } catch {
    // Fallback if Gemini returns plain text instead of JSON
    return { summary: text, suggestedActions: [] };
  }
}

module.exports = { generateSummary };
