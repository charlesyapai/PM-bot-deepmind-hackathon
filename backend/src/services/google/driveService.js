"use strict";

/*
 * Google Drive Integration Service
 *
 * Required Supabase SQL (ALTER existing tables):
 *
 * ALTER TABLE projects ADD COLUMN drive_folder_id TEXT;
 * ALTER TABLE projects ADD COLUMN drive_folder_url TEXT;
 * ALTER TABLE attachments ADD COLUMN drive_file_id TEXT;
 * ALTER TABLE attachments ADD COLUMN drive_url TEXT;
 * ALTER TABLE attachments ADD COLUMN source TEXT DEFAULT 'upload'
 *   CHECK (source IN ('upload', 'drive', 'email'));
 */

const { google } = require("googleapis");
const googleAuth = require("./googleAuthClient");
const supabase = require("../../lib/supabase");
const { Readable } = require("stream");

/**
 * Get a Google Drive API client for the user
 */
async function getDriveClient(userId) {
  const { data: integration, error } = await supabase
    .from("google_integrations")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !integration) return null;

  const { oauth2Client } = await googleAuth.getAuthenticatedClient(integration, supabase);
  const drive = google.drive({ version: "v3", auth: oauth2Client });
  return { drive, integration };
}

/**
 * Create the root "Personal Bot" folder in Drive
 * @returns {string} folder ID
 */
async function createRootFolder(userId) {
  const client = await getDriveClient(userId);
  if (!client) return null;

  const { drive, integration } = client;

  // Check if root folder already exists
  if (integration.drive_root_folder_id) {
    try {
      await drive.files.get({ fileId: integration.drive_root_folder_id, fields: "id" });
      return integration.drive_root_folder_id;
    } catch {
      // Folder was deleted, create a new one
    }
  }

  const res = await drive.files.create({
    requestBody: {
      name: "Personal Bot",
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id, webViewLink",
  });

  await supabase
    .from("google_integrations")
    .update({
      drive_root_folder_id: res.data.id,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return res.data.id;
}

/**
 * Create a per-project subfolder inside the root folder
 * @returns {{ folderId: string, folderUrl: string }}
 */
async function createProjectFolder(userId, projectId, projectTitle) {
  const rootFolderId = await createRootFolder(userId);
  if (!rootFolderId) return null;

  const client = await getDriveClient(userId);
  const { drive } = client;

  const res = await drive.files.create({
    requestBody: {
      name: projectTitle,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
    },
    fields: "id, webViewLink",
  });

  // Store folder ID on the project
  await supabase
    .from("projects")
    .update({
      drive_folder_id: res.data.id,
      drive_folder_url: res.data.webViewLink,
    })
    .eq("id", projectId);

  return { folderId: res.data.id, folderUrl: res.data.webViewLink };
}

/**
 * Upload a file to a project's Drive folder
 * @param {string} userId
 * @param {string} folderId - Google Drive folder ID
 * @param {object} file - { originalname, mimetype, buffer }
 * @returns {object} Drive file metadata
 */
async function uploadFile(userId, folderId, file) {
  const client = await getDriveClient(userId);
  if (!client) return null;

  const { drive } = client;

  const stream = new Readable();
  stream.push(file.buffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: file.originalname,
      parents: [folderId],
    },
    media: {
      mimeType: file.mimetype,
      body: stream,
    },
    fields: "id, name, mimeType, size, modifiedTime, webViewLink, iconLink",
  });

  return res.data;
}

/**
 * List files in a Drive folder
 */
async function listFiles(userId, folderId) {
  const client = await getDriveClient(userId);
  if (!client) return [];

  const { drive } = client;

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink)",
    orderBy: "modifiedTime desc",
  });

  return res.data.files || [];
}

/**
 * Get file content (for Google Docs/Sheets, exports as text; for others, returns metadata)
 */
async function getFileContent(userId, fileId) {
  const client = await getDriveClient(userId);
  if (!client) return null;

  const { drive } = client;

  // Get file metadata first
  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, size, modifiedTime, webViewLink",
  });

  const mimeType = meta.data.mimeType;
  let content = null;

  // Export Google Docs/Sheets as plain text
  if (mimeType === "application/vnd.google-apps.document") {
    const exp = await drive.files.export({ fileId, mimeType: "text/plain" });
    content = typeof exp.data === "string" ? exp.data.slice(0, 2000) : null;
  } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
    const exp = await drive.files.export({ fileId, mimeType: "text/csv" });
    content = typeof exp.data === "string" ? exp.data.slice(0, 2000) : null;
  }

  return { ...meta.data, content };
}

/**
 * Delete a file from Drive
 */
async function deleteFile(userId, fileId) {
  const client = await getDriveClient(userId);
  if (!client) return;

  await client.drive.files.delete({ fileId });
}

/**
 * Download/get download URL for a file
 */
async function getDownloadUrl(userId, fileId) {
  const client = await getDriveClient(userId);
  if (!client) return null;

  const { drive } = client;

  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, webContentLink, webViewLink",
  });

  // For Google Docs/Sheets, provide export links
  if (meta.data.mimeType.startsWith("application/vnd.google-apps.")) {
    return {
      type: "google_doc",
      viewUrl: meta.data.webViewLink,
      name: meta.data.name,
      mimeType: meta.data.mimeType,
    };
  }

  return {
    type: "file",
    downloadUrl: meta.data.webContentLink,
    viewUrl: meta.data.webViewLink,
    name: meta.data.name,
    mimeType: meta.data.mimeType,
  };
}

module.exports = {
  createRootFolder,
  createProjectFolder,
  uploadFile,
  listFiles,
  getFileContent,
  deleteFile,
  getDownloadUrl,
};
