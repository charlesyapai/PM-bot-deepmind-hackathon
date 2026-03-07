"use strict";

/*
 * Unified Google OAuth Routes
 *
 * Replaces gmail-only OAuth (GET /gmail/auth-url, /gmail/callback, /gmail/status)
 * with a single flow covering Gmail + Calendar + Drive.
 *
 * Endpoints:
 *   GET    /api/v1/google/auth-url    - Generate unified OAuth URL
 *   GET    /api/v1/google/callback    - Handle OAuth callback, store tokens
 *   GET    /api/v1/google/status      - Connection status + granted scopes + sync info
 *   DELETE /api/v1/google/disconnect  - Revoke tokens, delete integration row
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const supabase = require("../lib/supabase");
const googleAuth = require("../services/google/googleAuthClient");

const router = express.Router();

function getUserId(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return jwt.decode(token)?.sub || null;
}

// GET /api/v1/google/auth-url
router.get("/auth-url", (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Pass user's JWT as state so we can identify them in the callback
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const url = googleAuth.getAuthUrl(token);

    return res.json({ url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/google/callback
router.get("/callback", async (req, res) => {
  try {
    const { code, error: oauthError, state } = req.query;

    if (oauthError) {
      return res.status(400).json({ error: `OAuth error: ${oauthError}` });
    }
    if (!code) {
      return res.status(400).json({ error: "Authorization code is required" });
    }

    // Identify user from Bearer header or state param
    let userId = getUserId(req);
    if (!userId && state) {
      userId = jwt.decode(state)?.sub || null;
    }
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized - pass Bearer token or state parameter with your JWT",
      });
    }

    // Exchange code for tokens
    const tokens = await googleAuth.exchangeCode(code);

    // Get user's email
    const email = await googleAuth.getUserEmail(tokens.access_token);

    // Parse granted scopes
    const grantedScopes = tokens.scope ? tokens.scope.split(" ") : googleAuth.SCOPES;

    // Upsert into google_integrations
    const { data, error } = await supabase
      .from("google_integrations")
      .upsert(
        {
          user_id: userId,
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          token_expiry: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          gmail_address: email,
          scopes: grantedScopes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Return a user-friendly HTML page (OAuth redirects open in browser)
    return res.send(`
      <html>
        <head><title>Google Connected</title><style>
          body { font-family: -apple-system, sans-serif; display: flex; justify-content: center;
                 align-items: center; min-height: 100vh; background: #0f0f0f; color: #e0e0e0; }
          .card { text-align: center; padding: 2rem; }
          h1 { color: #7c3aed; } p { color: #a0a0a0; }
        </style></head>
        <body>
          <div class="card">
            <h1>Google Connected</h1>
            <p>Connected as <strong>${email}</strong></p>
            <p>You can close this window and return to the app.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/google/status
router.get("/status", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data: integration, error } = await supabase
      .from("google_integrations")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !integration) {
      return res.json({
        connected: false,
        email: null,
        scopes: [],
        services: { gmail: false, calendar: false, drive: false },
        last_email_sync: null,
        last_calendar_sync: null,
        drive_root_folder_id: null,
        drive_root_folder_name: null,
        drive_project_folder_count: 0,
      });
    }

    const services = googleAuth.parseServiceScopes(integration.scopes);

    // Count project folders with drive_folder_id set
    let driveProjectCount = 0;
    if (integration.drive_root_folder_id) {
      const { count } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("drive_folder_id", "is", null);
      driveProjectCount = count || 0;
    }

    return res.json({
      connected: true,
      email: integration.gmail_address,
      scopes: integration.scopes || [],
      services,
      last_email_sync: integration.last_email_sync,
      last_calendar_sync: integration.last_calendar_sync,
      drive_root_folder_id: integration.drive_root_folder_id,
      drive_root_folder_name: integration.drive_root_folder_id ? "Personal Bot" : null,
      drive_project_folder_count: driveProjectCount,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/google/disconnect
router.delete("/disconnect", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data: integration, error: fetchError } = await supabase
      .from("google_integrations")
      .select("google_access_token, google_refresh_token")
      .eq("user_id", userId)
      .single();

    if (fetchError || !integration) {
      return res.status(404).json({ error: "No Google integration found" });
    }

    // Try to revoke the token (best-effort, don't fail if revocation fails)
    try {
      await googleAuth.revokeToken(integration.google_access_token);
    } catch {
      // Token may already be invalid — that's fine
    }

    // Delete the integration row
    const { error } = await supabase
      .from("google_integrations")
      .delete()
      .eq("user_id", userId);

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ message: "Google account disconnected" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
