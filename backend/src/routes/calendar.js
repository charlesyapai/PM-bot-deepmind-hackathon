"use strict";

/*
 * Calendar Events CRUD API
 *
 * Required Supabase SQL (run in Supabase SQL editor):
 *
 * CREATE TABLE calendar_events (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID NOT NULL REFERENCES auth.users(id),
 *   project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
 *   title TEXT NOT NULL,
 *   description TEXT,
 *   start_time TIMESTAMPTZ NOT NULL,
 *   end_time TIMESTAMPTZ,
 *   all_day BOOLEAN DEFAULT false,
 *   recurrence TEXT,            -- 'daily', 'weekly', 'monthly', or null
 *   reminder_minutes INTEGER,   -- minutes before event to remind
 *   status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
 *   created_at TIMESTAMPTZ DEFAULT now(),
 *   updated_at TIMESTAMPTZ DEFAULT now()
 * );
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const supabase = require("../lib/supabase");
const calendarSync = require("../services/google/calendarSyncService");

const router = express.Router();

function getUserId(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return jwt.decode(token)?.sub || null;
}

// GET /api/v1/calendar — list user's calendar events
// Query params: ?from=<ISO>&to=<ISO> (date range), ?project_id=<UUID>
router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    let query = supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId)
      .order("start_time", { ascending: true });

    if (req.query.from) {
      query = query.gte("start_time", req.query.from);
    }
    if (req.query.to) {
      query = query.lte("start_time", req.query.to);
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

// POST /api/v1/calendar — create a calendar event
router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      title,
      description,
      start_time,
      end_time,
      all_day,
      project_id,
      recurrence,
      reminder_minutes,
    } = req.body;

    if (!title) return res.status(400).json({ error: "title is required" });
    if (!start_time)
      return res.status(400).json({ error: "start_time is required" });

    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        user_id: userId,
        title,
        description,
        start_time,
        end_time,
        all_day,
        project_id,
        recurrence,
        reminder_minutes,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Push to Google Calendar if connected (best-effort, don't fail the request)
    try {
      await calendarSync.pushEvent(userId, data);
    } catch {
      // Google not connected or push failed — event is still saved locally
    }

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/calendar/:id — get single event
router.get("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();

    if (error || !data)
      return res.status(404).json({ error: "Calendar event not found" });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/calendar/:id — update event fields
router.put("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      title,
      description,
      start_time,
      end_time,
      all_day,
      project_id,
      recurrence,
      reminder_minutes,
      status,
    } = req.body;

    const fields = {};
    if (title !== undefined) fields.title = title;
    if (description !== undefined) fields.description = description;
    if (start_time !== undefined) fields.start_time = start_time;
    if (end_time !== undefined) fields.end_time = end_time;
    if (all_day !== undefined) fields.all_day = all_day;
    if (project_id !== undefined) fields.project_id = project_id;
    if (recurrence !== undefined) fields.recurrence = recurrence;
    if (reminder_minutes !== undefined)
      fields.reminder_minutes = reminder_minutes;
    if (status !== undefined) fields.status = status;

    fields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("calendar_events")
      .update(fields)
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data)
      return res.status(404).json({ error: "Calendar event not found" });

    // Push update to Google Calendar if synced (best-effort)
    try {
      if (data.google_event_id) {
        await calendarSync.pushEvent(userId, data);
      }
    } catch {
      // Push failed — local update still succeeded
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/calendar/:id — hard delete with ownership check
router.delete("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Verify ownership before deleting
    const { data: existing, error: fetchError } = await supabase
      .from("calendar_events")
      .select("id, google_event_id, google_calendar_id")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existing)
      return res.status(404).json({ error: "Calendar event not found" });

    // Delete from Google Calendar if synced (best-effort)
    try {
      if (existing.google_event_id) {
        await calendarSync.deleteGoogleEvent(userId, existing.google_event_id, existing.google_calendar_id);
      }
    } catch {
      // Google delete failed — proceed with local delete
    }

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", userId);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/calendar/sync — trigger bidirectional calendar sync
router.post("/sync", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const direction = req.body.direction || "both";

    let result;
    if (direction === "pull") {
      result = await calendarSync.pullEvents(userId);
    } else if (direction === "push") {
      // Push all unsynced events
      const { data: unsyncedEvents } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", userId)
        .eq("sync_status", "local");

      let pushed = 0;
      for (const event of unsyncedEvents || []) {
        try {
          await calendarSync.pushEvent(userId, event);
          pushed++;
        } catch (err) {
          console.error(`Failed to push event ${event.id}:`, err.message);
        }
      }
      result = { pushed };
    } else {
      result = await calendarSync.syncBidirectional(userId);
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
