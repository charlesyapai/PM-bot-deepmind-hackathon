"use strict";

const express = require("express");
const jwt = require("jsonwebtoken");
const supabase = require("../lib/supabase");
const driveService = require("../services/google/driveService");

const router = express.Router();

function getUserId(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return jwt.decode(token)?.sub || null;
}

// GET /api/v1/projects
router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    let query = supabase.from("projects").select("*").eq("user_id", userId);

    if (req.query.status) {
      query = query.eq("status", req.query.status);
    }
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

// POST /api/v1/projects
router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { title, description, template_id } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });

    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: userId, title, description, template_id })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Auto-create Google Drive folder if Google is connected (best-effort)
    try {
      await driveService.createProjectFolder(userId, data.id, data.title);
    } catch {
      // Google not connected or folder creation failed — project still created
    }

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/projects/:id
router.get("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();

    if (error || !data) return res.status(404).json({ error: "Project not found" });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/projects/:id
router.put("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { title, description, template_id, status } = req.body;
    const fields = {};
    if (title !== undefined) fields.title = title;
    if (description !== undefined) fields.description = description;
    if (template_id !== undefined) fields.template_id = template_id;
    if (status !== undefined) fields.status = status;

    const { data, error } = await supabase
      .from("projects")
      .update(fields)
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: "Project not found" });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/projects/:id — soft delete (archive) or hard delete (?hard=true)
router.delete("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    if (req.query.hard === "true") {
      // Hard delete — remove tasks first, then project
      await supabase.from("tasks").delete().eq("project_id", req.params.id);
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", req.params.id)
        .eq("user_id", userId);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).send();
    }

    // Soft delete (archive)
    const { data, error } = await supabase
      .from("projects")
      .update({ status: "archived" })
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: "Project not found" });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/projects/:id/restore — unarchive a project
router.post("/:id/restore", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase
      .from("projects")
      .update({ status: "active" })
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: "Project not found" });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
