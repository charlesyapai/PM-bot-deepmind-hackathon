"use strict";

/*
 * Google Drive Routes
 *
 * Endpoints:
 *   GET    /api/v1/drive/files/:projectId   - List Drive files for a project
 *   POST   /api/v1/drive/upload/:projectId  - Upload file to project's Drive folder
 *   GET    /api/v1/drive/download/:fileId   - Download/export from Drive
 *   DELETE /api/v1/drive/files/:fileId      - Remove file from Drive
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const supabase = require("../lib/supabase");
const driveService = require("../services/google/driveService");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function getUserId(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return jwt.decode(token)?.sub || null;
}

// GET /api/v1/drive/files/:projectId — list Drive files for a project
router.get("/files/:projectId", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Get project's drive_folder_id
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, drive_folder_id")
      .eq("id", req.params.projectId)
      .eq("user_id", userId)
      .single();

    if (pErr || !project) return res.status(404).json({ error: "Project not found" });
    if (!project.drive_folder_id) return res.json([]);

    const files = await driveService.listFiles(userId, project.drive_folder_id);
    return res.json(files);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/drive/upload/:projectId — upload file to project's Drive folder
router.post("/upload/:projectId", upload.single("file"), async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    // Get or create project Drive folder
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, title, drive_folder_id")
      .eq("id", req.params.projectId)
      .eq("user_id", userId)
      .single();

    if (pErr || !project) return res.status(404).json({ error: "Project not found" });

    let folderId = project.drive_folder_id;
    if (!folderId) {
      const folder = await driveService.createProjectFolder(userId, project.id, project.title);
      if (!folder) return res.status(400).json({ error: "Google Drive not connected" });
      folderId = folder.folderId;
    }

    const driveFile = await driveService.uploadFile(userId, folderId, req.file);

    // Also create an attachment record
    await supabase.from("attachments").insert({
      user_id: userId,
      project_id: project.id,
      file_name: req.file.originalname,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      storage_path: `drive://${driveFile.id}`,
      drive_file_id: driveFile.id,
      drive_url: driveFile.webViewLink,
      source: "drive",
    });

    return res.status(201).json(driveFile);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/drive/download/:fileId — download/export from Drive
router.get("/download/:fileId", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const result = await driveService.getDownloadUrl(userId, req.params.fileId);
    if (!result) return res.status(404).json({ error: "File not found or Drive not connected" });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/drive/files/:fileId — remove file from Drive
router.delete("/files/:fileId", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await driveService.deleteFile(userId, req.params.fileId);

    // Also remove attachment record if exists
    await supabase
      .from("attachments")
      .delete()
      .eq("drive_file_id", req.params.fileId)
      .eq("user_id", userId);

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
