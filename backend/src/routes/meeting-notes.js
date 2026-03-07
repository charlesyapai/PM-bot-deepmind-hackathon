"use strict";

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

// GET /api/v1/meeting-notes
router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    let query = supabase
      .from("meeting_notes")
      .select("*")
      .eq("user_id", userId);

    if (req.query.updated_after) {
      query = query.gt("updated_at", req.query.updated_after);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/meeting-notes
router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { audio_url, project_id, title, duration_seconds } = req.body;
    if (!audio_url) return res.status(400).json({ error: "audio_url is required" });

    const { data, error } = await supabase
      .from("meeting_notes")
      .insert({
        user_id: userId,
        audio_url,
        project_id: project_id || null,
        title: title || null,
        duration_seconds: duration_seconds || null,
        status: "transcribing",
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/meeting-notes/:id
router.get("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase
      .from("meeting_notes")
      .select("*, action_items(*)")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();

    if (error || !data) return res.status(404).json({ error: "Meeting note not found" });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/meeting-notes/:id/summarize
router.post("/:id/summarize", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase
      .from("meeting_notes")
      .update({ status: "summarizing" })
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: "Meeting note not found" });

    return res.status(202).json({ status: "summarizing" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/meeting-notes/:id/action-items/:actionId
router.put("/:id/action-items/:actionId", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { is_accepted } = req.body;
    if (typeof is_accepted !== "boolean") {
      return res.status(400).json({ error: "is_accepted (boolean) is required" });
    }

    // Verify the meeting note belongs to this user
    const { data: note, error: noteError } = await supabase
      .from("meeting_notes")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();

    if (noteError || !note) {
      return res.status(404).json({ error: "Meeting note not found" });
    }

    const { data: actionItem, error: aiError } = await supabase
      .from("action_items")
      .update({ is_accepted })
      .eq("id", req.params.actionId)
      .eq("meeting_note_id", req.params.id)
      .select()
      .single();

    if (aiError || !actionItem) return res.status(404).json({ error: "Action item not found" });

    // When accepted, auto-create a task from the action item description
    let createdTask = null;
    if (is_accepted) {
      const { data: noteForProject } = await supabase
        .from("meeting_notes")
        .select("project_id")
        .eq("id", req.params.id)
        .single();

      const { data: task } = await supabase
        .from("tasks")
        .insert({
          title: actionItem.description,
          project_id: noteForProject?.project_id || null,
        })
        .select()
        .single();

      createdTask = task;

      if (task) {
        await supabase
          .from("action_items")
          .update({ task_id: task.id })
          .eq("id", req.params.actionId);
      }
    }

    return res.json({ action_item: actionItem, created_task: createdTask });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
