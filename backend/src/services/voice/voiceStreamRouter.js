/**
 * voiceStreamRouter.js
 *
 * WebSocket upgrade handler for the WSS /voice/stream endpoint.
 * Integrates with Express via the `ws` package's WebSocketServer.
 *
 * Responsibilities:
 *   - Authenticate the incoming WebSocket connection (validate JWT from query
 *     string, since WebSocket clients cannot set custom HTTP headers easily)
 *   - Create a VoiceSession for each authenticated client
 *   - Track active sessions and clean up on disconnect
 *   - Enforce a per-user concurrency limit (1 active session per user)
 *
 * Usage in server.js:
 *   const voiceStreamRouter = require('./src/services/voice/voiceStreamRouter');
 *   voiceStreamRouter.attach(server);   // `server` = http.Server from express
 *
 * WebSocket endpoint:
 *   WSS /voice/stream?token=<JWT>
 */

"use strict";

const { WebSocketServer } = require("ws");
const VoiceSession = require("./voiceSession");
const { verifyJwt } = require("../../middleware/auth");

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** Map of userId → VoiceSession (enforces one active session per user) */
const activeSessions = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract and verify the JWT from the WebSocket upgrade request.
 * Clients pass the token as a query parameter: ?token=<JWT>
 *
 * @param {import("http").IncomingMessage} req
 * @returns {Promise<{ userId: string }|null>}
 */
async function authenticateUpgrade(req) {
  try {
    const urlParams = new URLSearchParams(req.url.replace(/^[^?]*\?/, ""));
    const token = urlParams.get("token");
    if (!token) return null;

    const payload = await verifyJwt(token);
    return payload ? { userId: payload.sub || payload.userId } : null;
  } catch {
    return null;
  }
}

/**
 * Close any existing session for a user before starting a new one.
 * This prevents stale sessions from holding Deepgram connections open.
 *
 * @param {string} userId
 */
function closePreviousSession(userId) {
  const existing = activeSessions.get(userId);
  if (existing) {
    console.log(`[VoiceStreamRouter] Replacing existing session for user ${userId}`);
    existing.close();
    activeSessions.delete(userId);
  }
}

// ---------------------------------------------------------------------------
// Attach to HTTP server
// ---------------------------------------------------------------------------

/**
 * Attach the WebSocket server to an existing Node.js http.Server.
 * This avoids creating a second HTTP server — the WS upgrade is handled
 * on the same port as Express.
 *
 * @param {import("http").Server} httpServer
 * @param {object} [opts]
 * @param {string} [opts.path]     - URL path to accept WS connections on (default: /voice/stream)
 * @param {string} [opts.apiKey]   - Deepgram API key (defaults to process.env.DEEPGRAM_API_KEY)
 * @param {Function} [opts.onFinalTranscript] - Handler for final transcripts
 */
function attach(httpServer, opts = {}) {
  const {
    path = "/voice/stream",
    apiKey = process.env.DEEPGRAM_API_KEY,
    onFinalTranscript,
  } = opts;

  if (!apiKey) {
    throw new Error(
      "voiceStreamRouter: DEEPGRAM_API_KEY is not set. " +
      "Set it in your environment or pass it as opts.apiKey."
    );
  }

  const wss = new WebSocketServer({ server: httpServer, path });

  wss.on("connection", async (ws, req) => {
    // --- Authentication ---
    const auth = await authenticateUpgrade(req);
    if (!auth) {
      ws.close(4001, "Unauthorized: invalid or missing token");
      return;
    }

    const { userId } = auth;
    console.log(`[VoiceStreamRouter] New connection from user ${userId}`);

    // --- Session management ---
    closePreviousSession(userId);

    const session = new VoiceSession({
      clientWs: ws,
      userId,
      apiKey,
      onFinalTranscript: onFinalTranscript || defaultTranscriptHandler,
    });

    activeSessions.set(userId, session);

    session.on("ended", () => {
      activeSessions.delete(userId);
    });
  });

  wss.on("error", (err) => {
    console.error("[VoiceStreamRouter] WebSocketServer error:", err.message);
  });

  console.log(`[VoiceStreamRouter] Listening at ws://<host>${path}`);
  return wss;
}

// ---------------------------------------------------------------------------
// Default transcript handler (placeholder — Logic-AI service takes over)
// ---------------------------------------------------------------------------

/**
 * Default handler for final transcripts. In production this is replaced by
 * the Logic-AI service's intent parser. See onFinalTranscript opt above.
 *
 * @param {string} transcript
 * @param {string} userId
 */
function defaultTranscriptHandler(transcript, userId) {
  console.log(`[VoiceStreamRouter] Final transcript for user ${userId}: "${transcript}"`);
  // TODO: Forward to Logic-AI intent parsing service
  // logicAiService.parseIntent({ transcript, userId });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  attach,
  activeSessions,  // Exported for monitoring/admin endpoints
};
