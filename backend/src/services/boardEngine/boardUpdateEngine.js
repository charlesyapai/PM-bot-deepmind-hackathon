"use strict";

/*
 * Board Update Engine
 *
 * Orchestrates a compound board update:
 * 1. Email scan (fetch + import based on rules)
 * 2. Drive scan (list modified files per project)
 * 3. Calendar sync (bidirectional Google Calendar sync)
 * 4. Housekeeping analysis
 * 5. AI synthesis (Gemini summary + suggested actions)
 *
 * Required Supabase SQL:
 *
 * CREATE TABLE board_updates (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID NOT NULL REFERENCES auth.users(id),
 *   trigger TEXT NOT NULL CHECK (trigger IN ('voice', 'manual', 'scheduled')),
 *   summary TEXT,
 *   suggested_actions JSONB,
 *   email_data JSONB,
 *   drive_data JSONB,
 *   calendar_data JSONB,
 *   housekeeping_data JSONB,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 */

const supabase = require("../../lib/supabase");
const gmailClient = require("../gmail/gmailClient");
const driveService = require("../google/driveService");
const calendarSync = require("../google/calendarSyncService");
const { generateSummary } = require("./boardSummaryGenerator");

/**
 * Get valid Google tokens for a user (same logic as gmail.js getValidTokens)
 */
async function getValidTokens(userId) {
  const { data: integration, error } = await supabase
    .from("google_integrations")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !integration) return null;

  const expiry = new Date(integration.token_expiry);
  if (expiry.getTime() <= Date.now() + 5 * 60 * 1000) {
    try {
      const googleAuth = require("../google/googleAuthClient");
      const refreshed = await googleAuth.refreshAccessToken(integration.google_refresh_token);
      await supabase
        .from("google_integrations")
        .update({
          google_access_token: refreshed.access_token,
          token_expiry: new Date(refreshed.expiry_date).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      return { ...integration, google_access_token: refreshed.access_token };
    } catch {
      return null;
    }
  }

  return integration;
}

/**
 * Step 1: Email scan
 */
async function scanEmails(userId) {
  const integration = await getValidTokens(userId);
  if (!integration) return { newEmails: 0, imported: 0, byProject: {} };

  // Fetch rules
  const { data: rules } = await supabase
    .from("email_rules")
    .select("*")
    .eq("user_id", userId);

  if (!rules || rules.length === 0) return { newEmails: 0, imported: 0, byProject: {}, message: "No rules defined" };

  // Determine the "fetch since" cutoff:
  // 1. Use last_email_sync if we've synced before (only fetch new emails)
  // 2. Default to March 7, 2026 00:00 UTC as the initial baseline
  const DEFAULT_SINCE = "2026-03-07T00:00:00Z";
  const fetchSince = integration.last_email_sync || DEFAULT_SINCE;

  let totalImported = 0;
  const allEmails = [];

  for (const rule of rules) {
    const filters = {};
    if (rule.sender_filter) filters.sender = rule.sender_filter;
    if (rule.label_filter) filters.label = rule.label_filter;
    // Always use the sync-based cutoff; ignore rule.date_range_days for board updates
    filters.afterDate = fetchSince;

    try {
      const emails = await gmailClient.fetchEmails(integration.google_access_token, filters, 10);
      for (const email of emails) {
        const row = {
          user_id: userId,
          gmail_message_id: email.gmail_message_id,
          subject: email.subject,
          sender: email.sender,
          sender_name: email.sender_name,
          received_at: email.received_at ? new Date(email.received_at).toISOString() : null,
          snippet: email.snippet,
          labels: email.labels,
          is_read: email.is_read,
        };
        if (email.body_text) row.body_text = email.body_text;
        if (rule.project_id) row.project_id = rule.project_id;

        const { error: insertError } = await supabase
          .from("imported_emails")
          .upsert(row, { onConflict: "user_id,gmail_message_id" });

        if (!insertError) totalImported++;
        allEmails.push(email);
      }
    } catch (err) {
      console.error(`Email scan error for rule ${rule.rule_name}:`, err.message);
    }
  }

  // Update last email sync timestamp
  await supabase
    .from("google_integrations")
    .update({ last_email_sync: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return {
    newEmails: allEmails.length,
    imported: totalImported,
    rulesProcessed: rules.length,
    fetchedSince: fetchSince,
    recentSubjects: allEmails.slice(0, 5).map(e => ({ subject: e.subject, sender: e.sender_name })),
  };
}

/**
 * Step 2: Drive scan
 */
async function scanDrive(userId) {
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, drive_folder_id")
    .eq("user_id", userId)
    .neq("status", "archived")
    .not("drive_folder_id", "is", null);

  if (!projects || projects.length === 0) return { totalFiles: 0, byProject: {} };

  const byProject = {};
  let totalFiles = 0;

  for (const project of projects) {
    try {
      const files = await driveService.listFiles(userId, project.drive_folder_id);
      byProject[project.title] = files.map(f => ({
        name: f.name,
        modifiedTime: f.modifiedTime,
        mimeType: f.mimeType,
      }));
      totalFiles += files.length;
    } catch (err) {
      console.error(`Drive scan error for project ${project.title}:`, err.message);
      byProject[project.title] = { error: err.message };
    }
  }

  return { totalFiles, projectsScanned: projects.length, byProject };
}

/**
 * Step 3: Calendar sync
 */
async function syncCalendar(userId) {
  try {
    return await calendarSync.syncBidirectional(userId);
  } catch (err) {
    console.error("Calendar sync error:", err.message);
    return { error: err.message, pushed: 0, pulled: 0 };
  }
}

/**
 * Step 4: Housekeeping analysis (inline, mirrors housekeeping.js logic)
 */
async function runHousekeeping(userId) {
  const now = new Date();
  const todayISO = now.toISOString();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .eq("user_id", userId)
    .neq("status", "archived");

  const projectIds = (projects || []).map(p => p.id);
  if (projectIds.length === 0) {
    return { overdue: 0, stale: 0, unset: 0, pastEvents: 0, upcoming: 0 };
  }

  const [overdueResult, pastEventsResult, upcomingResult] = await Promise.all([
    supabase.from("tasks").select("id, title, due_date, project_id")
      .in("project_id", projectIds).lt("due_date", todayISO).neq("status", "done"),
    supabase.from("calendar_events").select("id, title, start_time")
      .eq("user_id", userId).eq("status", "scheduled").lt("start_time", todayISO),
    supabase.from("tasks").select("id, title, due_date, project_id")
      .in("project_id", projectIds).neq("status", "done")
      .gte("due_date", todayISO).lte("due_date", in48h),
  ]);

  const projectTitleMap = {};
  for (const p of projects) projectTitleMap[p.id] = p.title;

  return {
    overdue: (overdueResult.data || []).length,
    overdueTasks: (overdueResult.data || []).map(t => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date,
      project: projectTitleMap[t.project_id],
      project_id: t.project_id,
    })),
    pastEvents: (pastEventsResult.data || []).length,
    upcoming: (upcomingResult.data || []).length,
    upcomingDeadlines: (upcomingResult.data || []).map(t => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date,
      hours_remaining: Math.round((new Date(t.due_date) - now) / 3600000),
    })),
  };
}

/**
 * Run a full board update
 * @param {string} userId
 * @param {string} trigger - 'voice' | 'manual' | 'scheduled'
 * @returns {Promise<object>} Full board update result with suggestedActions
 */
async function runBoardUpdate(userId, trigger = "manual") {
  // Ensure a "General" project exists for admin/misc tasks
  let { data: generalProject } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("title", "General")
    .single();

  if (!generalProject) {
    const { data: created } = await supabase
      .from("projects")
      .insert({ user_id: userId, title: "General", description: "General admin tasks, meetings, and follow-ups", status: "active" })
      .select("id")
      .single();
    generalProject = created;
    console.log("[BoardUpdate] Created General project:", generalProject?.id);
  }

  // Get user's projects for context
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, drive_folder_id")
    .eq("user_id", userId)
    .neq("status", "archived");

  // Check if Google is connected
  const { data: integration } = await supabase
    .from("google_integrations")
    .select("id")
    .eq("user_id", userId)
    .single();

  const googleConnected = !!integration;

  // Run scans in parallel where possible
  const projectIds = (projects || []).map(p => p.id);

  const [emailData, driveData, calendarData, housekeepingData] = await Promise.all([
    googleConnected ? scanEmails(userId) : Promise.resolve({ skipped: true, reason: "Google not connected" }),
    googleConnected ? scanDrive(userId) : Promise.resolve({ skipped: true, reason: "Google not connected" }),
    googleConnected ? syncCalendar(userId) : Promise.resolve({ skipped: true, reason: "Google not connected" }),
    runHousekeeping(userId),
  ]);

  // Fetch recent emails with body_text for AI analysis
  // Always fetch — even with 0 projects, boss emails may trigger create_project
  // Only include UNPROCESSED emails (no project_id) plus recently tagged ones for context
  let recentEmails = [];
  {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: emails } = await supabase
      .from("imported_emails")
      .select("id, subject, sender_name, sender, snippet, body_text, project_id, received_at")
      .eq("user_id", userId)
      .gte("received_at", sevenDaysAgo)
      .order("received_at", { ascending: false })
      .limit(20);
    recentEmails = emails || [];
  }

  // Fetch current tasks for AI context (so it can reference task IDs)
  let currentTasks = [];
  if (projectIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, priority, due_date, project_id")
      .in("project_id", projectIds)
      .neq("status", "done")
      .order("due_date", { ascending: true })
      .limit(30);
    currentTasks = tasks || [];
  }

  // Fetch email rules for AI context (boss detection, sender-project mapping)
  let emailRules = [];
  const { data: rules } = await supabase
    .from("email_rules")
    .select("id, rule_name, sender_filter, project_id")
    .eq("user_id", userId);
  emailRules = (rules || []).map(r => ({
    ruleName: r.rule_name,
    senderFilter: r.sender_filter,
    projectId: r.project_id,
    isBoss: !r.project_id, // rules without a project_id = boss sender who can trigger new projects
  }));

  // Generate AI summary with suggested actions
  let summaryResult = { summary: "", suggestedActions: [] };
  try {
    summaryResult = await generateSummary({
      emailData,
      driveData,
      calendarData,
      housekeepingData,
      emailRules,
      projects: projects || [],
      emails: recentEmails.map(e => ({
        id: e.id,
        subject: e.subject,
        sender: e.sender_name || e.sender,
        body: e.body_text || e.snippet || "",
        project_id: e.project_id,
        already_processed: !!e.project_id,
        received_at: e.received_at,
      })),
      tasks: currentTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        project_id: t.project_id,
      })),
    });
  } catch (err) {
    console.error("Summary generation error:", err.message, err.stack);
    summaryResult.summary = `Board update complete. Scanned ${emailData.newEmails || 0} emails, ${housekeepingData.overdue || 0} overdue tasks, ${housekeepingData.upcoming || 0} upcoming deadlines. (AI summary unavailable: ${err.message})`;
  }

  // Store the board update
  // Try to include suggested_actions if the column exists; fall back without it
  let boardUpdate = null;
  let storeError = null;
  const insertRow = {
    user_id: userId,
    trigger,
    summary: summaryResult.summary,
    email_data: emailData,
    drive_data: driveData,
    calendar_data: calendarData,
    housekeeping_data: housekeepingData,
  };

  // First try with suggested_actions column
  const { data: d1, error: e1 } = await supabase
    .from("board_updates")
    .insert({ ...insertRow, suggested_actions: summaryResult.suggestedActions || [] })
    .select()
    .single();

  if (e1 && e1.message?.includes("suggested_actions")) {
    // Column doesn't exist yet — insert without it
    console.warn("board_updates.suggested_actions column missing, storing without it");
    const { data: d2, error: e2 } = await supabase
      .from("board_updates")
      .insert(insertRow)
      .select()
      .single();
    boardUpdate = d2;
    storeError = e2;
  } else {
    boardUpdate = d1;
    storeError = e1;
  }

  if (storeError) {
    console.error("Failed to store board update:", storeError.message);
  }

  return {
    id: boardUpdate?.id,
    summary: summaryResult.summary,
    suggestedActions: summaryResult.suggestedActions,
    emailData,
    driveData,
    calendarData,
    housekeepingData,
    created_at: boardUpdate?.created_at || new Date().toISOString(),
  };
}

module.exports = { runBoardUpdate };
