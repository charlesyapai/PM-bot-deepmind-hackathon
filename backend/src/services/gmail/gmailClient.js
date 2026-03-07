"use strict";

/*
 * Gmail API wrapper using googleapis
 *
 * Provides helper functions for:
 * - OAuth2 token management
 * - Fetching emails with filters
 * - Getting full email detail
 */

const { google } = require("googleapis");

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
 * Generate the Google OAuth2 authorization URL
 * @returns {string} Authorization URL
 */
function getAuthUrl() {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from OAuth callback
 * @returns {Promise<object>} Token response { access_token, refresh_token, expiry_date }
 */
async function exchangeCode(code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Refresh an expired access token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<object>} New token data { access_token, expiry_date }
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
 * Get the authenticated user's Gmail address
 * @param {string} accessToken
 * @returns {Promise<string>} Email address
 */
async function getGmailAddress(accessToken) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data.emailAddress;
}

/**
 * Fetch emails matching filters
 * @param {string} accessToken
 * @param {object} filters - { sender, label, afterDate (ISO string) }
 * @param {number} [maxResults=20]
 * @returns {Promise<Array>} Array of email summaries
 */
async function fetchEmails(accessToken, filters = {}, maxResults = 20) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Build Gmail search query
  const queryParts = [];
  if (filters.sender) queryParts.push(`from:${filters.sender}`);
  if (filters.label) queryParts.push(`label:${filters.label}`);
  if (filters.afterDate) {
    const d = new Date(filters.afterDate);
    const formatted = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    queryParts.push(`after:${formatted}`);
  }

  const q = queryParts.join(" ") || undefined;

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults,
  });

  if (!listRes.data.messages || listRes.data.messages.length === 0) {
    return [];
  }

  // Fetch full content for each message (includes body text for AI analysis)
  const emails = await Promise.all(
    listRes.data.messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      const headers = detail.data.payload?.headers || [];
      const getHeader = (name) =>
        headers.find((h) => h.name === name)?.value || null;

      const fromHeader = getHeader("From") || "";
      // Parse "Name <email>" format
      const nameMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
      const senderName = nameMatch ? nameMatch[1].trim() : fromHeader;
      const senderEmail = nameMatch ? nameMatch[2] : fromHeader;

      // Extract plain text body
      let bodyText = "";
      const parts = detail.data.payload?.parts || [];
      if (parts.length > 0) {
        const textPart = parts.find((p) => p.mimeType === "text/plain");
        if (textPart?.body?.data) {
          bodyText = Buffer.from(textPart.body.data, "base64").toString("utf-8");
        }
      } else if (detail.data.payload?.body?.data) {
        bodyText = Buffer.from(detail.data.payload.body.data, "base64").toString("utf-8");
      }

      return {
        gmail_message_id: msg.id,
        subject: getHeader("Subject"),
        sender: senderEmail,
        sender_name: senderName,
        received_at: getHeader("Date"),
        snippet: detail.data.snippet || "",
        body_text: bodyText || null,
        labels: detail.data.labelIds || [],
        is_read: !(detail.data.labelIds || []).includes("UNREAD"),
      };
    })
  );

  return emails;
}

/**
 * Get full email content by message ID
 * @param {string} accessToken
 * @param {string} messageId - Gmail message ID
 * @returns {Promise<object>} Full email data
 */
async function getEmailDetail(accessToken, messageId) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const detail = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = detail.data.payload?.headers || [];
  const getHeader = (name) =>
    headers.find((h) => h.name === name)?.value || null;

  // Extract body text
  let body = "";
  const parts = detail.data.payload?.parts || [];
  if (parts.length > 0) {
    const textPart = parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
    }
  } else if (detail.data.payload?.body?.data) {
    body = Buffer.from(detail.data.payload.body.data, "base64").toString(
      "utf-8"
    );
  }

  return {
    id: detail.data.id,
    subject: getHeader("Subject"),
    from: getHeader("From"),
    to: getHeader("To"),
    date: getHeader("Date"),
    snippet: detail.data.snippet,
    body,
    labels: detail.data.labelIds || [],
  };
}

module.exports = {
  createOAuth2Client,
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getGmailAddress,
  fetchEmails,
  getEmailDetail,
};
