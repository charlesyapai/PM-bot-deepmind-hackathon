"use strict";

/*
 * File Attachments CRUD API
 *
 * Required Supabase SQL (run in Supabase SQL editor):
 *
 * CREATE TABLE attachments (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID NOT NULL REFERENCES auth.users(id),
 *   task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
 *   project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
 *   file_name TEXT NOT NULL,
 *   file_type TEXT,
 *   file_size INTEGER,
 *   storage_path TEXT NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 *
 * Also create a Supabase Storage bucket named "attachments" (public or private).
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { randomUUID } = require("crypto");
const supabase = require("../lib/supabase");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

function getUserId(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return jwt.decode(token)?.sub || null;
}

// GET /api/v1/attachments?task_id=<UUID>&project_id=<UUID>
// List attachments for a task or project
router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    let query = supabase
      .from("attachments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (req.query.task_id) {
      query = query.eq("task_id", req.query.task_id);
    }
    if (req.query.project_id) {
      query = query.eq("project_id", req.query.project_id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/attachments — upload a file
// Body: multipart/form-data with field "file", plus optional "task_id" and "project_id"
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    if (!req.file) {
      return res.status(400).json({ error: "file is required" });
    }

    const { task_id, project_id } = req.body;
    const file = req.file;
    const fileExt = file.originalname.split(".").pop();
    const storagePath = `${userId}/${randomUUID()}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    // Save metadata to database
    const { data, error } = await supabase
      .from("attachments")
      .insert({
        user_id: userId,
        task_id: task_id || null,
        project_id: project_id || null,
        file_name: file.originalname,
        file_type: file.mimetype,
        file_size: file.size,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/attachments/:id/download — get a signed download URL
router.get("/:id/download", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Fetch attachment metadata with ownership check
    const { data: attachment, error: fetchError } = await supabase
      .from("attachments")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedData, error: signError } = await supabase.storage
      .from("attachments")
      .createSignedUrl(attachment.storage_path, 3600);

    if (signError) {
      return res.status(500).json({ error: signError.message });
    }

    return res.json({
      url: signedData.signedUrl,
      file_name: attachment.file_name,
      file_type: attachment.file_type,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/attachments/:id — delete file from storage + metadata
router.delete("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Verify ownership
    const { data: attachment, error: fetchError } = await supabase
      .from("attachments")
      .select("id, storage_path")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    // Delete from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from("attachments")
      .remove([attachment.storage_path]);

    if (storageError) {
      return res.status(500).json({ error: storageError.message });
    }

    // Delete metadata from database
    const { error } = await supabase
      .from("attachments")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", userId);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
