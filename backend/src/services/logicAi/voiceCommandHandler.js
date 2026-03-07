"use strict";

/**
 * voiceCommandHandler.js
 *
 * Orchestrates the full voice command flow:
 *   1. Fetch user context (projects, tasks, calendar events) from Supabase
 *   2. Include conversation history for multi-turn clarification
 *   3. Format context with today's date, project summaries, and upcoming events
 *   4. Call Gemini parseIntent with full context
 *   5. Execute the resulting intent via intentExecutor
 *   6. Return the result to be sent to the client
 */

const supabase = require("../../lib/supabase");
const { parseIntent } = require("./geminiClient");
const { executeIntent } = require("./intentExecutor");

// Per-user conversation history (userId -> array of { role, text })
// Cleared when session ends or after successful action
const conversationHistory = new Map();

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Get today's date info formatted for the AI context.
 */
function getTodayInfo() {
  const now = new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return {
    iso: now.toISOString().split("T")[0],
    dayOfWeek: days[now.getDay()],
    formatted: `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`,
  };
}

// ---------------------------------------------------------------------------
// Context fetching
// ---------------------------------------------------------------------------

/**
 * Fetch the user's projects, tasks, and upcoming events for Gemini context grounding.
 */
async function fetchUserContext(userId) {
  const today = getTodayInfo();

  const context = {
    userId,
    today: today.formatted,
    todayISO: today.iso,
    dayOfWeek: today.dayOfWeek,
    googleConnected: false,
    lastBoardUpdate: null,
    projects: [],
    recentTasks: [],
    upcomingEvents: [],
    recentEmails: [],
  };

  try {
    // Check Google integration status
    const { data: googleIntegration } = await supabase
      .from("google_integrations")
      .select("id, last_calendar_sync, last_email_sync, drive_root_folder_id")
      .eq("user_id", userId)
      .single();

    if (googleIntegration) {
      context.googleConnected = true;
    }

    // Check last board update timestamp
    const { data: lastUpdate } = await supabase
      .from("board_updates")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lastUpdate) {
      context.lastBoardUpdate = lastUpdate.created_at;
    }

    // Fetch active projects
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, status, drive_folder_id")
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(20);

    if (projects && projects.length > 0) {
      // Fetch task counts per project
      const projectIds = projects.map((p) => p.id);

      const { data: allTasks } = await supabase
        .from("tasks")
        .select("id, title, status, priority, project_id, due_date")
        .in("project_id", projectIds)
        .order("updated_at", { ascending: false })
        .limit(50);

      // Build task counts and group tasks by project
      const tasksByProject = {};
      if (allTasks) {
        for (const t of allTasks) {
          if (!tasksByProject[t.project_id]) {
            tasksByProject[t.project_id] = { total: 0, done: 0, pending: 0, tasks: [] };
          }
          const group = tasksByProject[t.project_id];
          group.total++;
          if (t.status === "done") {
            group.done++;
          } else {
            group.pending++;
          }
          // Include non-done tasks in the detail list
          if (t.status !== "done") {
            group.tasks.push({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              dueDate: t.due_date || null,
            });
          }
        }
      }

      // Fetch Drive files per project if Google is connected
      const driveFilesByProject = {};
      if (context.googleConnected) {
        const projectsWithDrive = projects.filter((p) => p.drive_folder_id);
        if (projectsWithDrive.length > 0) {
          // Query attachments that have drive_file_id as a lightweight proxy for Drive files
          const { data: driveAttachments } = await supabase
            .from("attachments")
            .select("id, file_name, drive_file_id, drive_url, updated_at, project_id")
            .in("project_id", projectsWithDrive.map((p) => p.id))
            .not("drive_file_id", "is", null)
            .order("updated_at", { ascending: false })
            .limit(50);

          if (driveAttachments) {
            for (const a of driveAttachments) {
              if (!driveFilesByProject[a.project_id]) {
                driveFilesByProject[a.project_id] = [];
              }
              driveFilesByProject[a.project_id].push({
                id: a.drive_file_id,
                name: a.file_name,
                modifiedTime: a.updated_at,
              });
            }
          }
        }
      }

      // Format projects with task summaries, grouped task lists, and Drive files
      context.projects = projects.map((p, i) => {
        const counts = tasksByProject[p.id] || { total: 0, done: 0, pending: 0, tasks: [] };
        const proj = {
          index: i + 1,
          id: p.id,
          title: p.title,
          pendingTasks: counts.pending,
          completedTasks: counts.done,
          totalTasks: counts.total,
          tasks: counts.tasks,
        };
        if (p.drive_folder_id) {
          proj.driveFolderId = p.drive_folder_id;
          proj.driveFiles = driveFilesByProject[p.id] || [];
        }
        return proj;
      });

      // Flatten recent non-done tasks for direct reference
      if (allTasks) {
        context.recentTasks = allTasks
          .filter((t) => t.status !== "done")
          .slice(0, 30)
          .map((t) => {
            const proj = projects.find((p) => p.id === t.project_id);
            return {
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              dueDate: t.due_date || null,
              projectId: t.project_id,
              projectTitle: proj ? proj.title : "Unknown",
            };
          });
      }
    }

    // Fetch upcoming calendar events (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekISO = nextWeek.toISOString().split("T")[0];

    const { data: events } = await supabase
      .from("calendar_events")
      .select("id, title, start_time, end_time, all_day, description, project_id, google_event_id")
      .eq("user_id", userId)
      .gte("start_time", `${today.iso}T00:00:00`)
      .lte("start_time", `${nextWeekISO}T23:59:59`)
      .order("start_time", { ascending: true })
      .limit(20);

    if (events && events.length > 0) {
      context.upcomingEvents = events.map((e) => ({
        id: e.id,
        title: e.title,
        startTime: e.start_time,
        endTime: e.end_time || null,
        allDay: e.all_day || false,
        description: e.description || null,
        projectId: e.project_id || null,
        source: e.google_event_id ? "google_calendar" : "app",
        googleEventId: e.google_event_id || null,
      }));
    }

    // Fetch recent imported emails (last 7 days, limit 10)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    const { data: emails } = await supabase
      .from("imported_emails")
      .select("id, subject, sender_name, sender, received_at, snippet, labels")
      .eq("user_id", userId)
      .gte("received_at", sevenDaysAgoISO)
      .order("received_at", { ascending: false })
      .limit(10);

    if (emails && emails.length > 0) {
      context.recentEmails = emails.map((e) => ({
        id: e.id,
        subject: e.subject,
        senderName: e.sender_name || null,
        senderEmail: e.sender,
        receivedAt: e.received_at,
        snippet: e.snippet || null,
        labels: e.labels || [],
      }));
    }
  } catch (err) {
    console.error("[VoiceCommandHandler] Error fetching context:", err.message);
  }

  return context;
}

// ---------------------------------------------------------------------------
// Conversation history management
// ---------------------------------------------------------------------------

/**
 * Get or initialize conversation history for a user.
 */
function getHistory(userId) {
  if (!conversationHistory.has(userId)) {
    conversationHistory.set(userId, []);
  }
  return conversationHistory.get(userId);
}

/**
 * Clear conversation history for a user (after successful action or session end).
 */
function clearHistory(userId) {
  conversationHistory.delete(userId);
}

/**
 * Format conversation history for inclusion in context.
 */
function formatHistory(history) {
  if (!history || history.length === 0) return null;

  return history.map((h, i) => {
    const prefix = h.role === "user" ? "User" : "Assistant";
    return `[Turn ${Math.floor(i / 2) + 1}] ${prefix}: ${h.text}`;
  }).join("\n");
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Handle a voice/text command end-to-end.
 *
 * @param {string} transcript - The user's spoken or typed command
 * @param {string} userId - Authenticated user ID
 * @param {Function} sendToClient - Function to send messages back to the WebSocket client
 */
async function handleCommand(transcript, userId, sendToClient) {
  console.log(`[VoiceCommandHandler] Processing: "${transcript}" for user ${userId}`);

  try {
    // 1. Fetch context
    const context = await fetchUserContext(userId);

    // 2. Add conversation history for multi-turn support
    const history = getHistory(userId);
    const formattedHistory = formatHistory(history);
    if (formattedHistory) {
      context.conversationHistory = formattedHistory;
    }

    // Record user message in history
    history.push({ role: "user", text: transcript });

    // 3. Parse intent with Gemini
    const intent = await parseIntent(transcript, context);
    console.log(`[VoiceCommandHandler] Intent:`, JSON.stringify(intent));

    // 4. Execute the intent
    const result = await executeIntent(intent, userId);
    console.log(`[VoiceCommandHandler] Result:`, result.message);

    // Record assistant response in history
    history.push({ role: "assistant", text: result.message });

    // 5. Send result to client
    if (sendToClient) {
      sendToClient({
        type: "action",
        intent,
        result: {
          success: result.success,
          message: result.message,
          data: result.data || undefined,
        },
      });
    }

    // Clear history after a successful non-clarify, non-respond action
    if (result.success && !result.requiresResponse && intent.name !== "respond") {
      clearHistory(userId);
    }

    // Keep history short (max 6 turns = 12 entries)
    if (history.length > 12) {
      history.splice(0, history.length - 12);
    }
  } catch (err) {
    console.error(`[VoiceCommandHandler] Error:`, err.message);
    if (sendToClient) {
      sendToClient({
        type: "error",
        message: "Failed to process command. Please try again.",
      });
    }
  }
}

module.exports = { handleCommand, clearHistory };
