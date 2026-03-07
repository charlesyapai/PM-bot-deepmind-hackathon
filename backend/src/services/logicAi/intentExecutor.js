"use strict";

/**
 * intentExecutor.js
 *
 * Executes parsed intents from Gemini by performing the actual CRUD operations
 * against Supabase. Returns a human-readable result message.
 */

const supabase = require("../../lib/supabase");

/**
 * Execute a parsed intent and return the result.
 *
 * @param {{ name: string, args: object }} intent - The parsed intent from Gemini
 * @param {string} userId - The authenticated user ID
 * @returns {Promise<{ success: boolean, message: string, data?: object, requiresResponse?: boolean }>}
 */
async function executeIntent(intent, userId) {
  const { name, args } = intent;

  switch (name) {
    // --- Project Management ---
    case "create_project":
      return createProject(args, userId);
    case "list_projects":
      return listProjects(userId);
    case "delete_project":
      return deleteProject(args, userId);

    // --- Task Management ---
    case "create_task":
      return createTask(args, userId);
    case "update_task":
      return updateTask(args, userId);
    case "list_tasks":
      return listTasks(args, userId);

    // --- Calendar Events ---
    case "create_event":
      return createEvent(args, userId);
    case "update_event":
      return updateEvent(args, userId);
    case "delete_event":
      return deleteEvent(args, userId);

    // --- Housekeeping ---
    case "run_housekeeping":
      return runHousekeeping(userId);
    case "auto_cleanup":
      return autoCleanup(args, userId);

    // --- Gmail Integration ---
    case "check_emails":
      return checkEmails(args, userId);
    case "create_task_from_email":
      return createTaskFromEmail(args, userId);

    // --- Google Integration (v2) ---
    case "sync_calendar":
      return syncCalendar(args, userId);
    case "run_board_update":
      return runBoardUpdate(args, userId);
    case "upload_to_drive":
      return uploadToDrive(args, userId);
    case "list_drive_files":
      return listDriveFiles(args, userId);
    case "read_drive_file":
      return readDriveFile(args, userId);
    case "draft_email":
      return draftEmail(args, userId);

    // --- Accept Suggestion (from board update) ---
    case "accept_suggestion":
      return acceptSuggestion(args, userId);

    // --- General Assistant ---
    case "respond":
      return {
        success: true,
        message: args.message || "How can I help you?",
        data: args.suggestedActions ? { suggestedActions: args.suggestedActions } : undefined,
      };

    // --- Clarification ---
    case "clarify":
      return {
        success: true,
        message: args.promptText || "Could you clarify your request?",
        requiresResponse: true,
      };

    default:
      return { success: false, message: `Unknown action: ${name}` };
  }
}

// ---------------------------------------------------------------------------
// Project handlers
// ---------------------------------------------------------------------------

async function createProject({ title, description, templateId, tasks }, userId) {
  const insert = { user_id: userId, title };
  if (description) insert.description = description;
  if (templateId) insert.template_id = templateId;

  const { data, error } = await supabase
    .from("projects")
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error("[IntentExecutor] create_project error:", error.message);
    return { success: false, message: `Failed to create project: ${error.message}` };
  }

  // Batch-create tasks if provided
  let taskCount = 0;
  if (tasks && Array.isArray(tasks) && tasks.length > 0) {
    const taskInserts = tasks.map((t) => {
      const row = {
        project_id: data.id,
        title: t.title,
        priority: t.priority || "medium",
        due_date: t.dueDate || null,
      };
      if (t.description) row.description = t.description;
      if (t.tags && Array.isArray(t.tags)) row.tags = t.tags;
      return row;
    });

    let { error: taskError } = await supabase
      .from("tasks")
      .insert(taskInserts);

    // If tags column doesn't exist yet, retry without tags
    if (taskError && taskError.message?.includes("tags")) {
      const withoutTags = taskInserts.map(({ tags: _t, ...rest }) => rest);
      ({ error: taskError } = await supabase
        .from("tasks")
        .insert(withoutTags));
    }

    if (taskError) {
      console.error("[IntentExecutor] create_project tasks error:", taskError.message);
      return {
        success: true,
        message: `Created project "${data.title}" but failed to add tasks: ${taskError.message}`,
        data,
      };
    }
    taskCount = taskInserts.length;
  }

  const taskMsg = taskCount > 0 ? ` with ${taskCount} task${taskCount === 1 ? "" : "s"}` : "";
  return {
    success: true,
    message: `Created project "${data.title}"${taskMsg}.`,
    data,
  };
}

async function listProjects(userId) {
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, status, created_at")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[IntentExecutor] list_projects error:", error.message);
    return { success: false, message: `Failed to fetch projects: ${error.message}` };
  }

  if (!projects || projects.length === 0) {
    return {
      success: true,
      message: "You don't have any active projects yet. Would you like to create one?",
      data: { projects: [] },
    };
  }

  // Fetch task counts per project
  const projectIds = projects.map((p) => p.id);
  const { data: tasks } = await supabase
    .from("tasks")
    .select("project_id, status")
    .in("project_id", projectIds);

  const taskCounts = {};
  if (tasks) {
    for (const t of tasks) {
      if (!taskCounts[t.project_id]) {
        taskCounts[t.project_id] = { total: 0, done: 0 };
      }
      taskCounts[t.project_id].total++;
      if (t.status === "done") taskCounts[t.project_id].done++;
    }
  }

  const lines = projects.map((p, i) => {
    const counts = taskCounts[p.id] || { total: 0, done: 0 };
    const pending = counts.total - counts.done;
    return `${i + 1}. ${p.title} (${pending} pending tasks, ${counts.done} done)`;
  });

  return {
    success: true,
    message: `You have ${projects.length} active project${projects.length === 1 ? "" : "s"}:\n${lines.join("\n")}`,
    data: { projects },
  };
}

async function deleteProject({ projectId }, userId) {
  if (!projectId) {
    return { success: false, message: "No project ID provided to delete." };
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from("projects")
    .select("id, title, user_id")
    .eq("id", projectId)
    .single();

  if (!existing) {
    return { success: false, message: "Project not found." };
  }
  if (existing.user_id !== userId) {
    return { success: false, message: "You can only delete your own projects." };
  }

  // Soft delete (archive)
  const { error } = await supabase
    .from("projects")
    .update({ status: "archived" })
    .eq("id", projectId);

  if (error) {
    console.error("[IntentExecutor] delete_project error:", error.message);
    return { success: false, message: `Failed to delete project: ${error.message}` };
  }

  return {
    success: true,
    message: `Archived project "${existing.title}". Its tasks are preserved but hidden.`,
  };
}

// ---------------------------------------------------------------------------
// Task handlers
// ---------------------------------------------------------------------------

async function createTask({ projectId, title, priority, dueDate, description, tags }, userId) {
  // Validate projectId is a real UUID; treat placeholder strings as missing
  if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    projectId = null;
  }
  // If no projectId, try to find the user's most recent project
  if (!projectId) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title")
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (!projects || projects.length === 0) {
      return {
        success: false,
        message: "You don't have any projects yet. Create a project first.",
      };
    }
    projectId = projects[0].id;
  }

  const insert = { project_id: projectId, title };
  if (priority) insert.priority = priority;
  if (dueDate) insert.due_date = dueDate;
  if (description) insert.description = description;
  if (tags && Array.isArray(tags)) insert.tags = tags;

  let { data, error } = await supabase
    .from("tasks")
    .insert(insert)
    .select()
    .single();

  // If tags column doesn't exist yet, retry without it
  if (error && error.message?.includes("tags") && insert.tags) {
    delete insert.tags;
    ({ data, error } = await supabase
      .from("tasks")
      .insert(insert)
      .select()
      .single());
  }

  // If FK constraint fails on project_id, retry with user's most recent project
  if (error && error.message?.includes("project_id_fkey")) {
    const { data: fallbackProjects } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (fallbackProjects && fallbackProjects.length > 0) {
      insert.project_id = fallbackProjects[0].id;
      const retry = await supabase.from("tasks").insert(insert).select().single();
      data = retry.data;
      error = retry.error;
    }
  }

  if (error) {
    console.error("[IntentExecutor] create_task error:", error.message);
    return { success: false, message: `Failed to create task: ${error.message}` };
  }

  return {
    success: true,
    message: `Created task "${data.title}" (${data.priority || "medium"} priority).`,
    data,
  };
}

async function updateTask({ taskId, status, priority, title }, userId) {
  if (!taskId) {
    return { success: false, message: "No task ID provided to update." };
  }

  const fields = {};
  if (status) fields.status = status;
  if (priority) fields.priority = priority;
  if (title) fields.title = title;

  if (Object.keys(fields).length === 0) {
    return { success: false, message: "No fields to update." };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(fields)
    .eq("id", taskId)
    .select()
    .single();

  if (error || !data) {
    return { success: false, message: `Failed to update task: ${error?.message || "not found"}` };
  }

  const changes = Object.entries(fields)
    .map(([k, v]) => `${k} -> ${v}`)
    .join(", ");

  return {
    success: true,
    message: `Updated task "${data.title}" (${changes}).`,
    data,
  };
}

async function listTasks({ projectId, status, priority } = {}, userId) {
  let query = supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, project_id, projects(title)")
    .order("created_at", { ascending: false })
    .limit(30);

  if (projectId) {
    query = query.eq("project_id", projectId);
  } else {
    // Scope to user's projects
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", userId)
      .neq("status", "archived");

    if (!projects || projects.length === 0) {
      return {
        success: true,
        message: "You don't have any projects or tasks yet.",
        data: { tasks: [] },
      };
    }
    query = query.in("project_id", projects.map((p) => p.id));
  }

  if (status) {
    query = query.eq("status", status);
  }
  if (priority) {
    query = query.eq("priority", priority);
  }

  const { data: tasks, error } = await query;

  if (error) {
    console.error("[IntentExecutor] list_tasks error:", error.message);
    return { success: false, message: `Failed to fetch tasks: ${error.message}` };
  }

  if (!tasks || tasks.length === 0) {
    const filterDesc = [status, priority].filter(Boolean).join(", ");
    return {
      success: true,
      message: filterDesc
        ? `No tasks found matching: ${filterDesc}.`
        : "You don't have any active tasks right now.",
      data: { tasks: [] },
    };
  }

  const lines = tasks.map((t, i) => {
    const proj = t.projects?.title || "Unknown project";
    const due = t.due_date ? ` (due ${t.due_date})` : "";
    return `${i + 1}. [${t.status}] ${t.title} - ${t.priority} priority${due} (${proj})`;
  });

  return {
    success: true,
    message: `Found ${tasks.length} task${tasks.length === 1 ? "" : "s"}:\n${lines.join("\n")}`,
    data: { tasks },
  };
}

// ---------------------------------------------------------------------------
// Calendar event handlers
// ---------------------------------------------------------------------------

/**
 * Normalize a time string to 24h HH:MM format.
 * Handles: "11:00 AM", "2:30 PM", "14:00", "2:30PM", etc.
 */
function normTime(t) {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = (m[3] || "").toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

async function createEvent({ title, date, startTime, endTime, description, projectId }, userId) {
  // Normalize 12h -> 24h time formats from AI
  startTime = normTime(startTime) || startTime;
  endTime = normTime(endTime) || endTime;

  // DB schema uses start_time TIMESTAMPTZ — combine date + time into ISO timestamp
  let startTimestamp = date;
  if (startTime) {
    startTimestamp = `${date}T${startTime}:00`;
  } else {
    startTimestamp = `${date}T00:00:00`;
  }

  const insert = {
    user_id: userId,
    title,
    start_time: startTimestamp,
    all_day: !startTime,
  };
  if (endTime) insert.end_time = `${date}T${endTime}:00`;
  if (description) insert.description = description;
  // Only set project_id if it looks like a valid UUID
  if (projectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    insert.project_id = projectId;
  }

  let { data, error } = await supabase
    .from("calendar_events")
    .insert(insert)
    .select()
    .single();

  // If FK constraint fails on project_id, retry without it
  if (error && error.message?.includes("project_id_fkey") && insert.project_id) {
    delete insert.project_id;
    const retry = await supabase.from("calendar_events").insert(insert).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("[IntentExecutor] create_event error:", error.message);
    return { success: false, message: `Failed to create event: ${error.message}` };
  }

  const displayTime = startTime ? ` at ${startTime}${endTime ? " - " + endTime : ""}` : "";

  return {
    success: true,
    message: `Scheduled "${data.title}" on ${date}${displayTime}.`,
    data,
  };
}

async function updateEvent({ eventId, title, date, startTime, endTime, description }, userId) {
  if (!eventId) {
    return { success: false, message: "No event ID provided to update." };
  }

  const fields = {};
  if (title) fields.title = title;
  if (date && startTime) {
    fields.start_time = `${date}T${startTime}:00`;
  } else if (date) {
    fields.start_time = `${date}T00:00:00`;
  }
  if (date && endTime) {
    fields.end_time = `${date}T${endTime}:00`;
  } else if (endTime) {
    // endTime without date — we'd need existing date, skip for now
  }
  if (description) fields.description = description;

  if (Object.keys(fields).length === 0) {
    return { success: false, message: "No fields to update on the event." };
  }

  // Verify ownership before updating
  const { data: existing } = await supabase
    .from("calendar_events")
    .select("id, user_id")
    .eq("id", eventId)
    .single();

  if (!existing) {
    return { success: false, message: "Event not found." };
  }
  if (existing.user_id !== userId) {
    return { success: false, message: "You can only update your own events." };
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .update(fields)
    .eq("id", eventId)
    .select()
    .single();

  if (error || !data) {
    return { success: false, message: `Failed to update event: ${error?.message || "not found"}` };
  }

  const changes = Object.entries(fields)
    .map(([k, v]) => `${k} -> ${v}`)
    .join(", ");

  return {
    success: true,
    message: `Updated event "${data.title}" (${changes}).`,
    data,
  };
}

async function deleteEvent({ eventId }, userId) {
  if (!eventId) {
    return { success: false, message: "No event ID provided to delete." };
  }

  // Verify ownership before deleting
  const { data: existing } = await supabase
    .from("calendar_events")
    .select("id, user_id, title")
    .eq("id", eventId)
    .single();

  if (!existing) {
    return { success: false, message: "Event not found." };
  }
  if (existing.user_id !== userId) {
    return { success: false, message: "You can only delete your own events." };
  }

  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", eventId);

  if (error) {
    console.error("[IntentExecutor] delete_event error:", error.message);
    return { success: false, message: `Failed to delete event: ${error.message}` };
  }

  return {
    success: true,
    message: `Deleted event "${existing.title}".`,
  };
}

// ---------------------------------------------------------------------------
// Housekeeping handler
// ---------------------------------------------------------------------------

async function runHousekeeping(userId) {
  const now = new Date();
  const todayISO = now.toISOString().split("T")[0];
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const report = {
    overdueTasks: [],
    staleProjects: [],
    untriagedTasks: [],
    pastEvents: [],
    upcomingDeadlines: [],
  };

  try {
    // 1. Get user's active project IDs
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .neq("status", "archived");

    const projectIds = (projects || []).map((p) => p.id);

    if (projectIds.length > 0) {
      // 2. Overdue tasks (due_date < today, status != done)
      const { data: overdue } = await supabase
        .from("tasks")
        .select("id, title, due_date, priority, project_id")
        .in("project_id", projectIds)
        .lt("due_date", todayISO)
        .neq("status", "done")
        .order("due_date", { ascending: true })
        .limit(20);

      report.overdueTasks = (overdue || []).map((t) => {
        const proj = projects.find((p) => p.id === t.project_id);
        return { title: t.title, dueDate: t.due_date, priority: t.priority, project: proj?.title || "Unknown" };
      });

      // 3. Tasks without due_date or priority
      const { data: untriaged } = await supabase
        .from("tasks")
        .select("id, title, due_date, priority, project_id")
        .in("project_id", projectIds)
        .neq("status", "done")
        .or("due_date.is.null,priority.is.null")
        .limit(20);

      report.untriagedTasks = (untriaged || []).map((t) => {
        const proj = projects.find((p) => p.id === t.project_id);
        const missing = [];
        if (!t.due_date) missing.push("due date");
        if (!t.priority) missing.push("priority");
        return { title: t.title, missing, project: proj?.title || "Unknown" };
      });

      // 4. Stale projects (no task updates in 7+ days)
      // Get latest task update per project
      const { data: recentTasks } = await supabase
        .from("tasks")
        .select("project_id, updated_at")
        .in("project_id", projectIds)
        .order("updated_at", { ascending: false });

      const latestByProject = {};
      if (recentTasks) {
        for (const t of recentTasks) {
          if (!latestByProject[t.project_id] || t.updated_at > latestByProject[t.project_id]) {
            latestByProject[t.project_id] = t.updated_at;
          }
        }
      }

      report.staleProjects = (projects || [])
        .filter((p) => {
          const latest = latestByProject[p.id];
          return !latest || latest < sevenDaysAgo;
        })
        .map((p) => ({ title: p.title, lastActivity: latestByProject[p.id] || p.updated_at }));

      // 5. Upcoming deadlines (due_date within 48h)
      const { data: upcoming } = await supabase
        .from("tasks")
        .select("id, title, due_date, priority, project_id")
        .in("project_id", projectIds)
        .neq("status", "done")
        .gte("due_date", todayISO)
        .lte("due_date", in48h.split("T")[0])
        .order("due_date", { ascending: true })
        .limit(20);

      report.upcomingDeadlines = (upcoming || []).map((t) => {
        const proj = projects.find((p) => p.id === t.project_id);
        return { title: t.title, dueDate: t.due_date, priority: t.priority, project: proj?.title || "Unknown" };
      });
    }

    // 6. Past calendar events (start_time < now, status = scheduled)
    const { data: pastEvents } = await supabase
      .from("calendar_events")
      .select("id, title, start_time")
      .eq("user_id", userId)
      .lt("start_time", now.toISOString())
      .eq("status", "scheduled")
      .order("start_time", { ascending: false })
      .limit(10);

    report.pastEvents = (pastEvents || []).map((e) => ({ title: e.title, startTime: e.start_time }));
  } catch (err) {
    console.error("[IntentExecutor] run_housekeeping error:", err.message);
    return { success: false, message: `Housekeeping analysis failed: ${err.message}` };
  }

  // Format conversational response
  const sections = [];
  const { overdueTasks, staleProjects, untriagedTasks, pastEvents, upcomingDeadlines } = report;

  if (overdueTasks.length > 0) {
    const items = overdueTasks.map((t) => `  - "${t.title}" was due ${t.dueDate} (${t.project})`).join("\n");
    sections.push(`Overdue tasks (${overdueTasks.length}):\n${items}`);
  }

  if (upcomingDeadlines.length > 0) {
    const items = upcomingDeadlines.map((t) => `  - "${t.title}" due ${t.dueDate} [${t.priority || "medium"}] (${t.project})`).join("\n");
    sections.push(`Upcoming deadlines in next 48h (${upcomingDeadlines.length}):\n${items}`);
  }

  if (untriagedTasks.length > 0) {
    const items = untriagedTasks.map((t) => `  - "${t.title}" missing ${t.missing.join(" & ")} (${t.project})`).join("\n");
    sections.push(`Tasks needing triage (${untriagedTasks.length}):\n${items}`);
  }

  if (staleProjects.length > 0) {
    const items = staleProjects.map((p) => `  - "${p.title}" (last activity: ${p.lastActivity ? p.lastActivity.split("T")[0] : "never"})`).join("\n");
    sections.push(`Stale projects with no recent activity (${staleProjects.length}):\n${items}`);
  }

  if (pastEvents.length > 0) {
    const items = pastEvents.map((e) => `  - "${e.title}" (was ${e.startTime})`).join("\n");
    sections.push(`Past events still marked as scheduled (${pastEvents.length}):\n${items}`);
  }

  if (sections.length === 0) {
    return {
      success: true,
      message: "Everything looks great! No overdue tasks, no stale projects, and all events are up to date.",
      data: report,
    };
  }

  // Build automated cleanup suggestions
  const suggestions = [];

  // Auto-archive stale projects
  if (staleProjects.length > 0) {
    for (const p of staleProjects) {
      suggestions.push({
        action: "archive_project",
        label: `Archive stale project "${p.title}"`,
        description: `No activity since ${p.lastActivity ? p.lastActivity.split("T")[0] : "creation"}`,
      });
    }
  }

  // Auto-mark overdue tasks with suggested actions
  if (overdueTasks.length > 0) {
    for (const t of overdueTasks) {
      suggestions.push({
        action: "mark_done_or_reschedule",
        label: `"${t.title}" is overdue (due ${t.dueDate})`,
        description: `Mark as done or reschedule`,
      });
    }
  }

  // Auto-triage tasks missing priority/due date
  if (untriagedTasks.length > 0) {
    suggestions.push({
      action: "triage_tasks",
      label: `${untriagedTasks.length} task${untriagedTasks.length === 1 ? "" : "s"} need triage`,
      description: `Missing due dates or priorities`,
    });
  }

  // Clean up past events
  if (pastEvents.length > 0) {
    suggestions.push({
      action: "cleanup_events",
      label: `${pastEvents.length} past event${pastEvents.length === 1 ? "" : "s"} still scheduled`,
      description: `Mark as completed or remove`,
    });
  }

  report.suggestions = suggestions;

  const suggestionText = suggestions.length > 0
    ? `\n\nSuggested cleanup actions:\n${suggestions.map((s, i) => `  ${i + 1}. ${s.label} — ${s.description}`).join("\n")}\n\nSay "clean up" or tell me which ones to do.`
    : "";

  return {
    success: true,
    message: `Here's your board health check:\n\n${sections.join("\n\n")}${suggestionText}`,
    data: report,
  };
}

async function autoCleanup({ archiveStaleProjects = true, completePastEvents = true } = {}, userId) {
  const actions = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Archive stale projects
    if (archiveStaleProjects) {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title, updated_at")
        .eq("user_id", userId)
        .neq("status", "archived");

      if (projects && projects.length > 0) {
        const projectIds = projects.map((p) => p.id);

        // Get latest task activity per project
        const { data: recentTasks } = await supabase
          .from("tasks")
          .select("project_id, updated_at")
          .in("project_id", projectIds)
          .order("updated_at", { ascending: false });

        const latestByProject = {};
        if (recentTasks) {
          for (const t of recentTasks) {
            if (!latestByProject[t.project_id] || t.updated_at > latestByProject[t.project_id]) {
              latestByProject[t.project_id] = t.updated_at;
            }
          }
        }

        const staleIds = projects
          .filter((p) => {
            const latest = latestByProject[p.id];
            return !latest || latest < sevenDaysAgo;
          })
          .map((p) => p.id);

        if (staleIds.length > 0) {
          const { error } = await supabase
            .from("projects")
            .update({ status: "archived" })
            .in("id", staleIds);

          if (!error) {
            const names = projects.filter((p) => staleIds.includes(p.id)).map((p) => p.title);
            actions.push(`Archived ${staleIds.length} stale project${staleIds.length === 1 ? "" : "s"}: ${names.join(", ")}`);
          }
        }
      }
    }

    // 2. Mark past scheduled events as completed
    if (completePastEvents) {
      const { data: pastEvents } = await supabase
        .from("calendar_events")
        .select("id, title")
        .eq("user_id", userId)
        .lt("start_time", now.toISOString())
        .eq("status", "scheduled");

      if (pastEvents && pastEvents.length > 0) {
        const pastIds = pastEvents.map((e) => e.id);
        const { error } = await supabase
          .from("calendar_events")
          .update({ status: "completed" })
          .in("id", pastIds);

        if (!error) {
          actions.push(`Marked ${pastEvents.length} past event${pastEvents.length === 1 ? "" : "s"} as completed`);
        }
      }
    }
  } catch (err) {
    console.error("[IntentExecutor] auto_cleanup error:", err.message);
    return { success: false, message: `Cleanup failed: ${err.message}` };
  }

  if (actions.length === 0) {
    return { success: true, message: "Nothing to clean up — your boards are already tidy!" };
  }

  return {
    success: true,
    message: `Cleanup complete:\n${actions.map((a) => `  ✓ ${a}`).join("\n")}`,
  };
}

// ---------------------------------------------------------------------------
// Accept Suggestion handler (from board update)
// ---------------------------------------------------------------------------

async function acceptSuggestion({ type, args, label }, userId) {
  try {
    switch (type) {
      case "create_project":
        return createProject(args, userId);
      case "create_task":
        return createTask(args, userId);
      case "update_task":
        return updateTask(args, userId);
      case "create_event":
        return createEvent(args, userId);
      case "update_event":
        return updateEvent(args, userId);
      default:
        return { success: false, message: `Unknown suggestion type: ${type}` };
    }
  } catch (err) {
    console.error("[IntentExecutor] accept_suggestion error:", err.message);
    return { success: false, message: `Failed to execute suggestion: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Gmail integration handlers
// ---------------------------------------------------------------------------

async function checkEmails({ sender, label, since, projectId } = {}, userId) {
  const defaultSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const sinceDate = since || defaultSince;

  try {
    let query = supabase
      .from("imported_emails")
      .select("id, subject, sender_name, sender, received_at, snippet, body_text, labels, project_id")
      .eq("user_id", userId)
      .gte("received_at", sinceDate)
      .order("received_at", { ascending: false })
      .limit(20);

    if (sender) {
      query = query.or(`sender_name.ilike.%${sender}%,sender.ilike.%${sender}%`);
    }
    if (label) {
      query = query.contains("labels", [label]);
    }
    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data: emails, error } = await query;

    if (error) {
      console.error("[IntentExecutor] check_emails error:", error.message);
      return { success: false, message: `Failed to check emails: ${error.message}` };
    }

    if (!emails || emails.length === 0) {
      const filterDesc = sender ? ` from "${sender}"` : "";
      return {
        success: true,
        message: `No imported emails found${filterDesc} in the last ${since ? "specified period" : "7 days"}.`,
        data: { emails: [] },
      };
    }

    const lines = emails.map((e, i) => {
      const date = e.received_at ? e.received_at.split("T")[0] : "unknown date";
      return `${i + 1}. "${e.subject}" from ${e.sender_name || e.sender} (${date})`;
    });

    return {
      success: true,
      message: `Found ${emails.length} email${emails.length === 1 ? "" : "s"}:\n${lines.join("\n")}`,
      data: { emails },
    };
  } catch (err) {
    console.error("[IntentExecutor] check_emails error:", err.message);
    return { success: false, message: `Failed to check emails: ${err.message}` };
  }
}

async function createTaskFromEmail({ emailId, projectId, priority }, userId) {
  if (!emailId) {
    return { success: false, message: "No email ID provided." };
  }

  try {
    // Fetch the email
    const { data: email, error: emailErr } = await supabase
      .from("imported_emails")
      .select("id, subject, sender_name, sender, snippet, body_text, project_id")
      .eq("id", emailId)
      .eq("user_id", userId)
      .single();

    if (emailErr || !email) {
      return { success: false, message: "Email not found or you don't have access to it." };
    }

    // Resolve project: use email's project_id, then provided projectId, then most recent
    if (!projectId && email.project_id) {
      projectId = email.project_id;
    }
    if (!projectId) {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title")
        .eq("user_id", userId)
        .neq("status", "archived")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (!projects || projects.length === 0) {
        return { success: false, message: "You don't have any projects yet. Create a project first." };
      }
      projectId = projects[0].id;
    }

    // Create the task from email — use body_text for richer description
    const taskTitle = `[Email] ${email.subject}`;
    const emailContent = email.body_text || email.snippet || "";
    const taskDesc = `From: ${email.sender_name || email.sender}\n\n${emailContent}`.trim();

    const insert = {
      project_id: projectId,
      title: taskTitle,
      description: taskDesc,
    };
    if (priority) insert.priority = priority;

    const { data: task, error: taskErr } = await supabase
      .from("tasks")
      .insert(insert)
      .select()
      .single();

    if (taskErr) {
      console.error("[IntentExecutor] create_task_from_email error:", taskErr.message);
      return { success: false, message: `Failed to create task from email: ${taskErr.message}` };
    }

    return {
      success: true,
      message: `Created task "${taskTitle}" from ${email.sender_name || email.sender}'s email (${priority || "medium"} priority).`,
      data: task,
    };
  } catch (err) {
    console.error("[IntentExecutor] create_task_from_email error:", err.message);
    return { success: false, message: `Failed to create task from email: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Google Integration (v2) handlers
// ---------------------------------------------------------------------------

/**
 * Check if the user has a connected Google integration.
 * Returns the integration row or null.
 */
async function getGoogleIntegration(userId) {
  const { data } = await supabase
    .from("google_integrations")
    .select("id, google_access_token, google_refresh_token, token_expiry, calendar_sync_token, drive_root_folder_id, last_calendar_sync, last_email_sync")
    .eq("user_id", userId)
    .single();
  return data || null;
}

async function syncCalendar({ direction = "both" } = {}, userId) {
  const integration = await getGoogleIntegration(userId);
  if (!integration) {
    return {
      success: false,
      message: "You'll need to connect your Google account first. Head to Settings > Google Account to get started.",
    };
  }

  try {
    // Delegate to calendarSyncService when available
    let calendarSyncService;
    try {
      calendarSyncService = require("../google/calendarSyncService");
    } catch {
      return {
        success: true,
        message: `Calendar sync (${direction}) is set up but the sync service is still being built. Stay tuned!`,
      };
    }

    const result = await calendarSyncService.sync(userId, integration, direction);
    const pulled = result.pulled || 0;
    const pushed = result.pushed || 0;

    const parts = [];
    if (direction === "pull" || direction === "both") parts.push(`pulled ${pulled} event${pulled === 1 ? "" : "s"} from Google Calendar`);
    if (direction === "push" || direction === "both") parts.push(`pushed ${pushed} event${pushed === 1 ? "" : "s"} to Google Calendar`);

    return {
      success: true,
      message: `Calendar sync complete! ${parts.join(" and ")}.`,
      data: result,
    };
  } catch (err) {
    console.error("[IntentExecutor] sync_calendar error:", err.message);
    return { success: false, message: `Calendar sync failed: ${err.message}` };
  }
}

async function runBoardUpdate({ projectId } = {}, userId) {
  try {
    let boardUpdateEngine;
    try {
      boardUpdateEngine = require("../boardEngine/boardUpdateEngine");
    } catch {
      // Fallback: run housekeeping as a partial board update until board engine is built
      const housekeepingResult = await runHousekeeping(userId);
      return {
        success: true,
        message: `Board update (partial -- Google services pending):\n\n${housekeepingResult.message}`,
        data: housekeepingResult.data,
      };
    }

    const result = await boardUpdateEngine.runBoardUpdate(userId, "voice");
    return {
      success: true,
      message: result.summary || "Board update complete!",
      data: {
        ...result,
        suggestedActions: result.suggestedActions || [],
      },
    };
  } catch (err) {
    console.error("[IntentExecutor] run_board_update error:", err.message);
    return { success: false, message: `Board update failed: ${err.message}` };
  }
}

async function uploadToDrive({ projectId, fileName }, userId) {
  if (!projectId || !fileName) {
    return { success: false, message: "I need a project and file name to upload to Drive." };
  }

  const integration = await getGoogleIntegration(userId);
  if (!integration) {
    return {
      success: false,
      message: "You'll need to connect your Google account first. Head to Settings > Google Account to get started.",
    };
  }

  // Verify the project has a Drive folder
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, drive_folder_id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (!project) {
    return { success: false, message: "Project not found." };
  }
  if (!project.drive_folder_id) {
    return {
      success: false,
      message: `The project "${project.title}" doesn't have a Google Drive folder yet. A folder will be created automatically on the next board update.`,
    };
  }

  try {
    let driveService;
    try {
      driveService = require("../google/driveService");
    } catch {
      return {
        success: true,
        message: `Upload to Drive for "${project.title}" is set up but the Drive service is still being built. Stay tuned!`,
      };
    }

    const result = await driveService.uploadFile(userId, integration, project.drive_folder_id, fileName);
    return {
      success: true,
      message: `Uploaded "${fileName}" to the "${project.title}" Drive folder.`,
      data: result,
    };
  } catch (err) {
    console.error("[IntentExecutor] upload_to_drive error:", err.message);
    return { success: false, message: `Failed to upload file: ${err.message}` };
  }
}

async function listDriveFiles({ projectId }, userId) {
  if (!projectId) {
    return { success: false, message: "Which project's Drive files would you like to see?" };
  }

  const integration = await getGoogleIntegration(userId);
  if (!integration) {
    return {
      success: false,
      message: "You'll need to connect your Google account first. Head to Settings > Google Account to get started.",
    };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, drive_folder_id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (!project) {
    return { success: false, message: "Project not found." };
  }
  if (!project.drive_folder_id) {
    return {
      success: true,
      message: `The project "${project.title}" doesn't have a Google Drive folder yet. No files to show.`,
      data: { files: [] },
    };
  }

  try {
    let driveService;
    try {
      driveService = require("../google/driveService");
    } catch {
      return {
        success: true,
        message: `Drive file listing for "${project.title}" is set up but the Drive service is still being built. Stay tuned!`,
      };
    }

    const files = await driveService.listFiles(userId, integration, project.drive_folder_id);

    if (!files || files.length === 0) {
      return {
        success: true,
        message: `No files in the "${project.title}" Drive folder yet.`,
        data: { files: [] },
      };
    }

    const lines = files.map((f, i) => {
      const modified = f.modifiedTime ? ` (modified ${f.modifiedTime.split("T")[0]})` : "";
      return `${i + 1}. ${f.name}${modified}`;
    });

    return {
      success: true,
      message: `Files in "${project.title}" Drive folder:\n${lines.join("\n")}`,
      data: { files },
    };
  } catch (err) {
    console.error("[IntentExecutor] list_drive_files error:", err.message);
    return { success: false, message: `Failed to list Drive files: ${err.message}` };
  }
}

async function readDriveFile({ fileId, fileName, projectId }, userId) {
  if (!fileId && !fileName) {
    return { success: false, message: "I need a file name or file ID to read from Drive." };
  }

  const integration = await getGoogleIntegration(userId);
  if (!integration) {
    return {
      success: false,
      message: "You'll need to connect your Google account first. Head to Settings > Google Account to get started.",
    };
  }

  try {
    let driveService;
    try {
      driveService = require("../google/driveService");
    } catch {
      return {
        success: true,
        message: "Drive file reading is set up but the Drive service is still being built. Stay tuned!",
      };
    }

    const content = await driveService.readFile(userId, integration, { fileId, fileName, projectId });
    return {
      success: true,
      message: content.summary || `Here's the content of "${content.name}":\n\n${content.text || "(No readable content)"}`,
      data: content,
    };
  } catch (err) {
    console.error("[IntentExecutor] read_drive_file error:", err.message);
    return { success: false, message: `Failed to read Drive file: ${err.message}` };
  }
}

async function draftEmail({ to, subject, body, replyToEmailId }, userId) {
  if (!to || !subject || !body) {
    return { success: false, message: "I need a recipient, subject, and body to draft an email." };
  }

  const integration = await getGoogleIntegration(userId);
  if (!integration) {
    return {
      success: false,
      message: "You'll need to connect your Google account first. Head to Settings > Google Account to get started.",
    };
  }

  try {
    let gmailService;
    try {
      gmailService = require("../google/gmailService");
    } catch {
      // Fallback to existing gmailClient if available
      try {
        gmailService = require("../gmail/gmailClient");
      } catch {
        return {
          success: true,
          message: `Email draft to ${to} is ready but the Gmail draft service is still being built. Stay tuned!`,
        };
      }
    }

    const result = await gmailService.createDraft(userId, integration, { to, subject, body, replyToEmailId });
    const replyNote = replyToEmailId ? " (reply)" : "";
    return {
      success: true,
      message: `Draft${replyNote} created! Subject: "${subject}" to ${to}. Check your Gmail drafts to review and send.`,
      data: result,
    };
  } catch (err) {
    console.error("[IntentExecutor] draft_email error:", err.message);
    return { success: false, message: `Failed to create email draft: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { executeIntent };
