"use strict";

/*
 * Gmail Integration API
 *
 * Required Supabase SQL (run in Supabase SQL editor):
 *
 * CREATE TABLE email_integrations (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
 *   google_access_token TEXT NOT NULL,
 *   google_refresh_token TEXT NOT NULL,
 *   token_expiry TIMESTAMPTZ,
 *   gmail_address TEXT,
 *   created_at TIMESTAMPTZ DEFAULT now(),
 *   updated_at TIMESTAMPTZ DEFAULT now()
 * );
 *
 * CREATE TABLE email_rules (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID NOT NULL REFERENCES auth.users(id),
 *   rule_name TEXT NOT NULL,
 *   sender_filter TEXT,
 *   label_filter TEXT,
 *   date_range_days INTEGER DEFAULT 7,
 *   auto_import BOOLEAN DEFAULT false,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 *
 * CREATE TABLE imported_emails (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID NOT NULL REFERENCES auth.users(id),
 *   gmail_message_id TEXT NOT NULL,
 *   subject TEXT,
 *   sender TEXT,
 *   sender_name TEXT,
 *   received_at TIMESTAMPTZ,
 *   snippet TEXT,
 *   labels TEXT[],
 *   is_read BOOLEAN DEFAULT false,
 *   created_at TIMESTAMPTZ DEFAULT now(),
 *   UNIQUE(user_id, gmail_message_id)
 * );
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const supabase = require("../lib/supabase");
const gmailClient = require("../services/gmail/gmailClient");

const router = express.Router();

function getUserId(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return jwt.decode(token)?.sub || null;
}

/**
 * Helper: get stored tokens for user, refresh if expired
 */
async function getValidTokens(userId) {
  // Use unified google_integrations table (v2)
  const { data: integration, error } = await supabase
    .from("google_integrations")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !integration) return null;

  // Check if token is expired (with 5-minute buffer)
  const expiry = new Date(integration.token_expiry);
  const now = new Date(Date.now() + 5 * 60 * 1000);

  if (expiry <= now) {
    try {
      const googleAuth = require("../services/google/googleAuthClient");
      const refreshed = await googleAuth.refreshAccessToken(
        integration.google_refresh_token
      );

      await supabase
        .from("google_integrations")
        .update({
          google_access_token: refreshed.access_token,
          token_expiry: new Date(refreshed.expiry_date).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return { ...integration, google_access_token: refreshed.access_token };
    } catch (err) {
      return null;
    }
  }

  return integration;
}

// GET /api/v1/gmail/auth-url — generate Google OAuth2 authorization URL
router.get("/auth-url", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const url = gmailClient.getAuthUrl();
    return res.json({ url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gmail/callback — handle OAuth callback, store tokens
router.get("/callback", async (req, res) => {
  try {
    const { code, error: oauthError } = req.query;

    if (oauthError) {
      return res.status(400).json({ error: `OAuth error: ${oauthError}` });
    }
    if (!code) {
      return res.status(400).json({ error: "Authorization code is required" });
    }

    // Exchange code for tokens
    const tokens = await gmailClient.exchangeCode(code);

    // Get user's email address
    const gmailAddress = await gmailClient.getGmailAddress(
      tokens.access_token
    );

    // For the callback flow, we need the user_id.
    // The caller should pass state=<jwt> or we extract from the token.
    // For simplicity, require auth header or state param.
    let userId = getUserId(req);

    if (!userId && req.query.state) {
      // state param contains the JWT
      userId = jwt.decode(req.query.state)?.sub || null;
    }

    if (!userId) {
      return res.status(401).json({
        error:
          "Unauthorized — pass Bearer token or state parameter with your JWT",
      });
    }

    // Upsert token record
    const { data, error } = await supabase
      .from("email_integrations")
      .upsert(
        {
          user_id: userId,
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          token_expiry: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          gmail_address: gmailAddress,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      message: "Gmail connected successfully",
      gmail_address: gmailAddress,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gmail/status — check if Gmail is connected
router.get("/status", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase
      .from("email_integrations")
      .select("gmail_address, created_at, updated_at")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return res.json({ connected: false });
    }

    return res.json({
      connected: true,
      gmail_address: data.gmail_address,
      connected_at: data.created_at,
      last_updated: data.updated_at,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gmail/emails — fetch emails using stored tokens
// Query params: ?sender=&label=&since=<ISO date>
router.get("/emails", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const integration = await getValidTokens(userId);
    if (!integration) {
      return res.status(400).json({
        error: "Gmail not connected. Visit /api/v1/gmail/auth-url to connect.",
      });
    }

    // If project_id is specified, return imported emails from DB instead of live Gmail fetch
    if (req.query.project_id) {
      let query = supabase
        .from("imported_emails")
        .select("*")
        .eq("user_id", userId)
        .eq("project_id", req.query.project_id)
        .order("received_at", { ascending: false })
        .limit(20);

      if (req.query.sender) {
        query = query.or(`sender_name.ilike.%${req.query.sender}%,sender.ilike.%${req.query.sender}%`);
      }

      const { data: emails, error: emailErr } = await query;
      if (emailErr) return res.status(500).json({ error: emailErr.message });
      return res.json(emails || []);
    }

    const filters = {};
    if (req.query.sender) filters.sender = req.query.sender;
    if (req.query.label) filters.label = req.query.label;
    if (req.query.since) filters.afterDate = req.query.since;

    const emails = await gmailClient.fetchEmails(
      integration.google_access_token,
      filters
    );

    return res.json(emails);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/gmail/rules — create an email rule
router.post("/rules", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { rule_name, sender_filter, label_filter, date_range_days, auto_import, project_id } =
      req.body;

    if (!rule_name) {
      return res.status(400).json({ error: "rule_name is required" });
    }

    const { data, error } = await supabase
      .from("email_rules")
      .insert({
        user_id: userId,
        rule_name,
        sender_filter: sender_filter || null,
        label_filter: label_filter || null,
        date_range_days: date_range_days || 7,
        auto_import: auto_import || false,
        project_id: project_id || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gmail/rules — list user's email rules
router.get("/rules", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase
      .from("email_rules")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/gmail/rules/:id — delete a rule
router.delete("/rules/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from("email_rules")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: "Email rule not found" });
    }

    const { error } = await supabase
      .from("email_rules")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", userId);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/gmail/sync — manually trigger email import based on user's rules
router.post("/sync", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const integration = await getValidTokens(userId);
    if (!integration) {
      return res.status(400).json({
        error: "Gmail not connected. Visit /api/v1/gmail/auth-url to connect.",
      });
    }

    // Fetch user's rules
    const { data: rules, error: rulesError } = await supabase
      .from("email_rules")
      .select("*")
      .eq("user_id", userId);

    if (rulesError) return res.status(500).json({ error: rulesError.message });

    if (!rules || rules.length === 0) {
      return res.json({ imported: 0, message: "No email rules defined" });
    }

    let totalImported = 0;

    for (const rule of rules) {
      const filters = {};
      if (rule.sender_filter) filters.sender = rule.sender_filter;
      if (rule.label_filter) filters.label = rule.label_filter;
      if (rule.date_range_days) {
        const since = new Date(
          Date.now() - rule.date_range_days * 24 * 60 * 60 * 1000
        );
        filters.afterDate = since.toISOString();
      }

      const emails = await gmailClient.fetchEmails(
        integration.google_access_token,
        filters
      );

      // Upsert emails into imported_emails (skip duplicates)
      for (const email of emails) {
        const row = {
          user_id: userId,
          gmail_message_id: email.gmail_message_id,
          subject: email.subject,
          sender: email.sender,
          sender_name: email.sender_name,
          received_at: email.received_at
            ? new Date(email.received_at).toISOString()
            : null,
          snippet: email.snippet,
          labels: email.labels,
          is_read: email.is_read,
        };
        // Store full body text if available
        if (email.body_text) row.body_text = email.body_text;
        // Link email to project via rule's project_id
        if (rule.project_id) row.project_id = rule.project_id;

        const { error: insertError } = await supabase
          .from("imported_emails")
          .upsert(row, { onConflict: "user_id,gmail_message_id" });

        if (!insertError) totalImported++;
      }
    }

    return res.json({
      imported: totalImported,
      rules_processed: rules.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
