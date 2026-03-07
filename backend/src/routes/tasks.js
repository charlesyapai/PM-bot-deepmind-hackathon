"use strict";

const express = require("express");
const jwt = require("jsonwebtoken");
const supabase = require("../lib/supabase");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const router = express.Router();

function getUserId(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return jwt.decode(token)?.sub || null;
}

// GET /api/v1/tasks
// Supports ?project_id= and ?updated_after= for offline sync
router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    let query = supabase
      .from("tasks")
      .select("*, projects!inner(user_id, status, title)")
      .eq("projects.user_id", userId)
      .neq("projects.status", "archived");

    if (req.query.project_id) {
      query = query.eq("project_id", req.query.project_id);
    }
    if (req.query.updated_after) {
      query = query.gt("updated_at", req.query.updated_after);
    }
    if (req.query.status) {
      query = query.eq("status", req.query.status);
    }
    if (req.query.priority) {
      query = query.eq("priority", req.query.priority);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/tasks
router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { title, description, project_id, priority, due_date, parent_task_id } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });

    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, description, project_id, priority, due_date, parent_task_id })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/tasks/daily-summary — AI-generated workflow recommendation for today
router.get("/daily-summary", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Fetch active projects
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title")
      .eq("user_id", userId)
      .neq("status", "archived");

    const projectIds = (projects || []).map((p) => p.id);
    if (projectIds.length === 0) {
      return res.json({ summary: "No active projects yet. Create a project to get started!" });
    }

    const projectTitleMap = {};
    for (const p of projects) projectTitleMap[p.id] = p.title;

    // Fetch non-done tasks from active projects
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, project_id")
      .in("project_id", projectIds)
      .neq("status", "done")
      .order("due_date", { ascending: true });

    if (!tasks || tasks.length === 0) {
      return res.json({ summary: "All tasks are done! Great work." });
    }

    // Fetch today's calendar events for context
    const todayStart = new Date().toISOString().split("T")[0] + "T00:00:00";
    const todayEnd = new Date().toISOString().split("T")[0] + "T23:59:59";
    const { data: events } = await supabase
      .from("calendar_events")
      .select("id, title, start_time, end_time")
      .eq("user_id", userId)
      .gte("start_time", todayStart)
      .lte("start_time", todayEnd)
      .order("start_time", { ascending: true });

    const tasksWithProject = tasks.map((t) => ({
      title: t.title,
      description: t.description || "",
      priority: t.priority,
      status: t.status,
      due_date: t.due_date,
      project: projectTitleMap[t.project_id] || "Unknown",
    }));

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
    const prompt = `You are a productivity assistant. Analyze the user's pending tasks across their projects and today's calendar to recommend a focused workflow for today. Consider:
- Which tasks are overdue or due soonest (highest urgency)
- Which tasks are high priority vs low priority
- The project context (which projects need attention)
- Task tags (meetings, email replies are typically time-sensitive)
- Available time blocks around calendar events

Be concise (3-5 sentences). Reference specific task names and their projects. Clearly separate "do now" tasks from "do if time allows" tasks.

TODAY'S DATE: ${new Date().toISOString().split("T")[0]}

PENDING TASKS (by project):
${JSON.stringify(tasksWithProject, null, 2)}

TODAY'S CALENDAR:
${JSON.stringify((events || []).map((e) => ({ title: e.title, start: e.start_time, end: e.end_time })), null, 2)}

Respond with ONLY plain text (no JSON, no markdown formatting).`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.5 },
    });

    const summary = result.response.text().trim();
    return res.json({ summary });
  } catch (err) {
    console.error("[Tasks] daily-summary error:", err.message);
    return res.json({ summary: "Unable to generate summary right now. Check your tasks below." });
  }
});

// POST /api/v1/tasks/:id/ai-edit — AI-powered task editing from natural language
router.post("/:id/ai-edit", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { instruction } = req.body;
    if (!instruction) return res.status(400).json({ error: "instruction is required" });

    // Fetch the current task
    const { data: task, error: fetchErr } = await supabase
      .from("tasks")
      .select("*, projects!inner(user_id, title)")
      .eq("id", req.params.id)
      .single();

    if (fetchErr || !task) return res.status(404).json({ error: "Task not found" });
    if (task.projects.user_id !== userId) return res.status(403).json({ error: "Forbidden" });

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
    const prompt = `You are editing a task based on a user instruction. Given the current task and the user's request, return ONLY valid JSON with the fields to update. Only include fields that need to change.

CURRENT TASK:
- Title: ${task.title}
- Description: ${task.description || "(none)"}
- Status: ${task.status}
- Priority: ${task.priority}
- Due date: ${task.due_date || "(none)"}
- Tags: ${JSON.stringify(task.tags || [])}
- Project: ${task.projects.title}

USER INSTRUCTION: "${instruction}"

TODAY'S DATE: ${new Date().toISOString().split("T")[0]}

Return JSON with only changed fields. Valid fields: title, description, status (todo/in_progress/done/blocked), priority (low/medium/high), due_date (YYYY-MM-DD), tags (string array).
Example: {"status": "done"} or {"due_date": "2026-03-15", "priority": "high"}
Return ONLY the JSON object, nothing else.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 256, temperature: 0.1 },
    });

    const text = result.response.text().trim();
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
    const updates = JSON.parse(cleaned);

    // Whitelist allowed fields
    const allowed = ["title", "description", "status", "priority", "due_date", "tags"];
    const fields = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) fields[key] = updates[key];
    }

    if (Object.keys(fields).length === 0) {
      return res.json({ message: "No changes needed", task });
    }

    const { data: updated, error: updateErr } = await supabase
      .from("tasks")
      .update(fields)
      .eq("id", req.params.id)
      .select()
      .single();

    if (updateErr) return res.status(500).json({ error: updateErr.message });

    return res.json({
      message: `Updated: ${Object.keys(fields).join(", ")}`,
      task: updated,
    });
  } catch (err) {
    console.error("[Tasks] ai-edit error:", err.message);
    return res.status(500).json({ error: `AI edit failed: ${err.message}` });
  }
});

// PUT /api/v1/tasks/reorder — must be defined before /:id to avoid route conflict
router.put("/reorder", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const items = req.body; // expected: array of { id, position }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Request body must be a non-empty array of { id, position }" });
    }

    const updates = items.map(({ id, position }) =>
      supabase.from("tasks").update({ position }).eq("id", id)
    );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed) return res.status(500).json({ error: failed.error.message });

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/tasks/:id
router.put("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { title, description, status, priority, due_date, position, tags } = req.body;
    const fields = {};
    if (title !== undefined) fields.title = title;
    if (description !== undefined) fields.description = description;
    if (status !== undefined) fields.status = status;
    if (priority !== undefined) fields.priority = priority;
    if (due_date !== undefined) fields.due_date = due_date;
    if (position !== undefined) fields.position = position;
    if (tags !== undefined) fields.tags = tags;

    const { data, error } = await supabase
      .from("tasks")
      .update(fields)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: "Task not found" });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/tasks/:id
router.delete("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Verify ownership via project
    const { data: task, error: fetchError } = await supabase
      .from("tasks")
      .select("id, projects!inner(user_id)")
      .eq("id", req.params.id)
      .single();

    if (fetchError || !task) return res.status(404).json({ error: "Task not found" });
    if (task.projects.user_id !== userId) return res.status(403).json({ error: "Forbidden" });

    const { error } = await supabase.from("tasks").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/tasks/:id/subtasks
router.post("/:id/subtasks", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { title, description, priority } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });

    // Fetch the parent task to get its project_id
    const { data: parentTask, error: parentError } = await supabase
      .from("tasks")
      .select("id, project_id")
      .eq("id", req.params.id)
      .single();

    if (parentError || !parentTask) {
      return res.status(404).json({ error: "Parent task not found" });
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title,
        description,
        priority,
        project_id: parentTask.project_id,
        parent_task_id: req.params.id,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
