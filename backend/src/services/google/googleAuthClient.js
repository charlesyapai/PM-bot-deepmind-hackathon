"use strict";

/*
 * Unified Google OAuth2 Client
 *
 * Replaces the gmail-only OAuth with a single OAuth2 flow covering:
 * - Gmail (read + send drafts)
 * - Google Calendar (read + write)
 * - Google Drive (app-created files only)
 * - User info (email)
 *
 * Required Supabase SQL (replaces email_integrations):
 *
 * CREATE TABLE google_integrations (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
 *   google_access_token TEXT NOT NULL,
 *   google_refresh_token TEXT NOT NULL,
 *   token_expiry TIMESTAMPTZ,
 *   gmail_address TEXT,
 *   scopes TEXT[],
 *   calendar_sync_token TEXT,
 *   drive_root_folder_id TEXT,
 *   last_calendar_sync TIMESTAMPTZ,
 *   last_email_sync TIMESTAMPTZ,
 *   created_at TIMESTAMPTZ DEFAULT now(),
 *   updated_at TIMESTAMPTZ DEFAULT now()
 * );
 */

const { google } = require("googleapis");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * Create a configured OAuth2 client
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate the unified Google OAuth2 authorization URL
 * @param {string} [state] - Optional state parameter (e.g. JWT for identifying user)
 * @returns {string} Authorization URL
 */
function getAuthUrl(state) {
  const oauth2Client = createOAuth2Client();
  const params = {
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  };
  if (state) params.state = state;
  return oauth2Client.generateAuthUrl(params);
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from OAuth callback
 * @returns {Promise<object>} Token response { access_token, refresh_token, expiry_date, scope }
 */
async function exchangeCode(code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Refresh an expired access token
 * @param {string} refreshToken
 * @returns {Promise<object>} { access_token, expiry_date }
 */
async function refreshAccessToken(refreshToken) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return {
    access_token: credentials.access_token,
    expiry_date: credentials.expiry_date,
  };
}

/**
 * Get an authenticated OAuth2 client with valid credentials.
 * Automatically refreshes token if expired.
 * @param {object} integration - Row from google_integrations table
 * @param {object} supabase - Supabase client (for updating refreshed tokens)
 * @returns {Promise<object>} { oauth2Client, accessToken, refreshed }
 */
async function getAuthenticatedClient(integration, supabase) {
  const oauth2Client = createOAuth2Client();
  let accessToken = integration.google_access_token;
  let refreshed = false;

  const expiry = new Date(integration.token_expiry);
  const bufferMs = 5 * 60 * 1000;

  if (expiry.getTime() <= Date.now() + bufferMs) {
    const newTokens = await refreshAccessToken(integration.google_refresh_token);
    accessToken = newTokens.access_token;
    refreshed = true;

    await supabase
      .from("google_integrations")
      .update({
        google_access_token: accessToken,
        token_expiry: new Date(newTokens.expiry_date).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", integration.user_id);
  }

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: integration.google_refresh_token,
  });

  return { oauth2Client, accessToken, refreshed };
}

/**
 * Get the authenticated user's email address
 * @param {string} accessToken
 * @returns {Promise<string>}
 */
async function getUserEmail(accessToken) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return data.email;
}

/**
 * Parse granted scopes string into service availability flags
 * @param {string[]|string} scopes - Scopes array or space-separated string
 * @returns {{ gmail: boolean, calendar: boolean, drive: boolean }}
 */
function parseServiceScopes(scopes) {
  const scopeList = Array.isArray(scopes) ? scopes : (scopes || "").split(" ");
  return {
    gmail: scopeList.some((s) => s.includes("gmail")),
    calendar: scopeList.some((s) => s.includes("calendar")),
    drive: scopeList.some((s) => s.includes("drive")),
  };
}

/**
 * Revoke a token (access or refresh)
 * @param {string} token
 */
async function revokeToken(token) {
  const oauth2Client = createOAuth2Client();
  await oauth2Client.revokeToken(token);
}

module.exports = {
  SCOPES,
  createOAuth2Client,
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getAuthenticatedClient,
  getUserEmail,
  parseServiceScopes,
  revokeToken,
};
