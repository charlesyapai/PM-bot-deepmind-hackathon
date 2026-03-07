"use strict";

/*
 * Housekeeping Analysis API
 *
 * No new table required — this endpoint queries existing tables
 * (tasks, projects, calendar_events) to produce a health report.
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const supabase = require("../lib/supabase");

const router = express.Router();

function getUserId(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return jwt.decode(token)?.sub || null;
}

// GET /api/v1/housekeeping — analyze user data and return health report
router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const now = new Date();
    const todayISO = now.toISOString();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    // First fetch user's active projects (tasks are scoped via project_id, not user_id)
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title")
      .eq("user_id", userId)
      .neq("status", "archived");

    const projectIds = (projects || []).map((p) => p.id);
    const hasProjects = projectIds.length > 0;

    // Run all queries in parallel
    const [
      overdueResult,
      unsetResult,
      allTasksResult,
      pastEventsResult,
      upcomingResult,
    ] = await Promise.all([
      // 1. Overdue tasks: due_date < today AND status != 'done'
      hasProjects
        ? supabase
            .from("tasks")
            .select("id, title, due_date, project_id")
            .in("project_id", projectIds)
            .lt("due_date", todayISO)
            .neq("status", "done")
        : Promise.resolve({ data: [] }),

      // 3. Unset tasks: missing due_date or priority
      hasProjects
        ? supabase
            .from("tasks")
            .select("id, title, due_date, priority, project_id")
            .in("project_id", projectIds)
            .neq("status", "done")
        : Promise.resolve({ data: [] }),

      // For stale projects: get all tasks with their project_id and updated_at
      hasProjects
        ? supabase
            .from("tasks")
            .select("project_id, updated_at")
            .in("project_id", projectIds)
        : Promise.resolve({ data: [] }),

      // 4. Past events: start_time < now AND status = 'scheduled'
      supabase
        .from("calendar_events")
        .select("id, title, start_time")
        .eq("user_id", userId)
        .eq("status", "scheduled")
        .lt("start_time", todayISO),

      // 5. Upcoming deadlines: due_date within next 48 hours, status != 'done'
      hasProjects
        ? supabase
            .from("tasks")
            .select("id, title, due_date, project_id")
            .in("project_id", projectIds)
            .neq("status", "done")
            .gte("due_date", todayISO)
            .lte("due_date", in48h)
        : Promise.resolve({ data: [] }),
    ]);

    const projectsResult = { data: projects };

    // Build project title lookup
    const projectTitleMap = {};
    if (projectsResult.data) {
      for (const p of projectsResult.data) {
        projectTitleMap[p.id] = p.title;
      }
    }

    // 1. Overdue tasks — enrich with project_title
    const overdueTasks = (overdueResult.data || []).map((t) => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date,
      project_title: projectTitleMap[t.project_id] || null,
    }));

    // 2. Stale projects — projects with no task updated_at in last 7 days
    const tasksByProject = {};
    for (const t of allTasksResult.data || []) {
      if (!t.project_id) continue;
      if (
        !tasksByProject[t.project_id] ||
        t.updated_at > tasksByProject[t.project_id]
      ) {
        tasksByProject[t.project_id] = t.updated_at;
      }
    }

    const staleProjects = [];
    for (const p of projectsResult.data || []) {
      const lastActivity = tasksByProject[p.id] || null;
      if (!lastActivity || lastActivity < sevenDaysAgo) {
        staleProjects.push({
          id: p.id,
          title: p.title,
          last_activity: lastActivity,
        });
      }
    }

    // 3. Unset tasks — missing due_date or priority
    const unsetTasks = [];
    for (const t of unsetResult.data || []) {
      const missing = [];
      if (!t.due_date) missing.push("due_date");
      if (!t.priority) missing.push("priority");
      if (missing.length > 0) {
        unsetTasks.push({ id: t.id, title: t.title, missing });
      }
    }

    // 4. Past events
    const pastEvents = (pastEventsResult.data || []).map((e) => ({
      id: e.id,
      title: e.title,
      start_time: e.start_time,
    }));

    // 5. Upcoming deadlines — enrich with hours_remaining and project_title
    const upcomingDeadlines = (upcomingResult.data || []).map((t) => {
      const hoursRemaining = Math.round(
        (new Date(t.due_date).getTime() - now.getTime()) / (1000 * 60 * 60)
      );
      return {
        id: t.id,
        title: t.title,
        due_date: t.due_date,
        project_title: projectTitleMap[t.project_id] || null,
        hours_remaining: hoursRemaining,
      };
    });

    return res.json({
      overdueTasks,
      staleProjects,
      unsetTasks,
      pastEvents,
      upcomingDeadlines,
      summary: {
        overdue: overdueTasks.length,
        stale: staleProjects.length,
        unset: unsetTasks.length,
        pastEvents: pastEvents.length,
        upcoming: upcomingDeadlines.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
