"use strict";

require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Root — browser-friendly status page
// ---------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><title>Personal Bot API</title><style>
        body { font-family: monospace; padding: 2rem; background: #0f0f0f; color: #e0e0e0; }
        h1 { color: #7c3aed; } h2 { color: #a78bfa; margin-top: 2rem; }
        a { color: #60a5fa; } li { margin: 0.4rem 0; }
        .badge { background: #16a34a; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; }
        .badge.ws { background: #0369a1; }
      </style></head>
      <body>
        <h1>🤖 Personal Bot — Backend API</h1>
        <p><span class="badge">● LIVE</span> &nbsp; Running on port ${PORT}</p>
        <h2>REST Endpoints</h2>
        <ul>
          <li><a href="/health">GET /health</a> — Server health check</li>
          <li><a href="/api/v1/projects">GET /api/v1/projects</a> — List projects</li>
          <li><a href="/api/v1/tasks">GET /api/v1/tasks</a> — List tasks</li>
          <li><a href="/api/v1/templates">GET /api/v1/templates</a> — List templates</li>
          <li><a href="/api/v1/meeting-notes">GET /api/v1/meeting-notes</a> — List meeting notes</li>
          <li><a href="/api/v1/calendar">GET /api/v1/calendar</a> — List calendar events (?from=&to=&project_id=)</li>
          <li>POST /api/v1/calendar — Create calendar event</li>
          <li>GET /api/v1/calendar/:id — Get single event</li>
          <li>PUT /api/v1/calendar/:id — Update event</li>
          <li>DELETE /api/v1/calendar/:id — Delete event</li>
          <li><a href="/api/v1/housekeeping">GET /api/v1/housekeeping</a> — Housekeeping health report</li>
          <li>GET /api/v1/attachments — List attachments (?task_id=&project_id=)</li>
          <li>POST /api/v1/attachments — Upload file attachment (multipart/form-data)</li>
          <li>GET /api/v1/attachments/:id/download — Get signed download URL</li>
          <li>DELETE /api/v1/attachments/:id — Delete attachment</li>
          <li>GET /api/v1/gmail/auth-url — Gmail OAuth2 authorization URL</li>
          <li>GET /api/v1/gmail/callback — Gmail OAuth callback</li>
          <li>GET /api/v1/gmail/status — Gmail connection status</li>
          <li>GET /api/v1/gmail/emails — Fetch emails (?sender=&label=&since=)</li>
          <li>POST /api/v1/gmail/rules — Create email rule</li>
          <li>GET /api/v1/gmail/rules — List email rules</li>
          <li>DELETE /api/v1/gmail/rules/:id — Delete email rule</li>
          <li>POST /api/v1/gmail/sync — Sync emails based on rules</li>
          <li><a href="/api/v1/google/auth-url">GET /api/v1/google/auth-url</a> — Unified Google OAuth URL (Gmail+Calendar+Drive)</li>
          <li>GET /api/v1/google/callback — Google OAuth callback</li>
          <li><a href="/api/v1/google/status">GET /api/v1/google/status</a> — Google connection status + scopes</li>
          <li>DELETE /api/v1/google/disconnect — Revoke Google tokens</li>
          <li>POST /api/v1/calendar/sync — Trigger calendar sync (body: { direction: 'pull'|'push'|'both' })</li>
          <li>GET /api/v1/drive/files/:projectId — List Drive files for project</li>
          <li>POST /api/v1/drive/upload/:projectId — Upload file to project Drive folder</li>
          <li>GET /api/v1/drive/download/:fileId — Download/export from Drive</li>
          <li>DELETE /api/v1/drive/files/:fileId — Remove file from Drive</li>
          <li>POST /api/v1/board-update — Trigger full board update</li>
          <li>GET /api/v1/board-update/history — Past board update summaries</li>
          <li>POST /api/v1/voice/transcribe — Batch meeting transcription (Deepgram)</li>
          <li>POST /api/v1/voice/command — Text command fallback</li>
        </ul>
        <h2>WebSocket</h2>
        <ul>
          <li><span class="badge ws">WS</span> ws://localhost:${PORT}/voice/stream — Live voice streaming (Deepgram)</li>
        </ul>
      </body>
    </html>
  `);
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Supabase-backed route handlers
// ---------------------------------------------------------------------------
app.use("/api/v1/projects", require("./src/routes/projects"));
app.use("/api/v1/tasks", require("./src/routes/tasks"));
app.use("/api/v1/templates", require("./src/routes/templates"));
app.use("/api/v1/meeting-notes", require("./src/routes/meeting-notes"));
app.use("/api/v1/calendar", require("./src/routes/calendar"));
app.use("/api/v1/housekeeping", require("./src/routes/housekeeping"));
app.use("/api/v1/attachments", require("./src/routes/attachments"));
app.use("/api/v1/gmail", require("./src/routes/gmail"));
app.use("/api/v1/google", require("./src/routes/google"));
app.use("/api/v1/drive", require("./src/routes/drive"));
app.use("/api/v1/board-update", require("./src/routes/board-update"));

// ---------------------------------------------------------------------------
// Voice REST endpoints (transcribe + text command fallback)
// ---------------------------------------------------------------------------
const { voiceRestRouter, voiceStreamRouter } = require("./src/services/voice");
const { handleCommand } = require("./src/services/logicAi/voiceCommandHandler");
app.use("/api/v1/voice", voiceRestRouter);

// ---------------------------------------------------------------------------
// Create HTTP server and attach WebSocket voice stream
// ---------------------------------------------------------------------------
const server = http.createServer(app);

voiceStreamRouter.attach(server, {
  path: "/voice/stream",
  apiKey: process.env.DEEPGRAM_API_KEY,
  onFinalTranscript: handleCommand,
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Voice WebSocket endpoint: ws://localhost:${PORT}/voice/stream`);
  });
}

module.exports = { app, server };
