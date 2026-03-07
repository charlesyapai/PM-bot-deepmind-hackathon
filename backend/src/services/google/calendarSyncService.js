"use strict";

/*
 * Google Calendar Bidirectional Sync Service
 *
 * Required Supabase SQL (ALTER existing calendar_events table):
 *
 * ALTER TABLE calendar_events ADD COLUMN google_event_id TEXT;
 * ALTER TABLE calendar_events ADD COLUMN google_calendar_id TEXT DEFAULT 'primary';
 * ALTER TABLE calendar_events ADD COLUMN sync_status TEXT DEFAULT 'local'
 *   CHECK (sync_status IN ('local', 'synced', 'conflict'));
 * ALTER TABLE calendar_events ADD COLUMN last_synced_at TIMESTAMPTZ;
 */

const { google } = require("googleapis");
const googleAuth = require("./googleAuthClient");
const supabase = require("../../lib/supabase");

/**
 * Get a Google Calendar API client for the user
 */
async function getCalendarClient(userId) {
  const { data: integration, error } = await supabase
    .from("google_integrations")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !integration) return null;

  const { oauth2Client } = await googleAuth.getAuthenticatedClient(integration, supabase);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  return { calendar, integration };
}

/**
 * Push a local event to Google Calendar
 * @param {string} userId
 * @param {object} event - calendar_events row
 * @returns {Promise<object>} Updated event with google_event_id
 */
async function pushEvent(userId, event) {
  const client = await getCalendarClient(userId);
  if (!client) return null;

  const { calendar } = client;

  const gcalEvent = {
    summary: event.title,
    description: event.description || "",
    start: event.all_day
      ? { date: event.start_time.split("T")[0] }
      : { dateTime: event.start_time, timeZone: "UTC" },
    end: event.end_time
      ? event.all_day
        ? { date: event.end_time.split("T")[0] }
        : { dateTime: event.end_time, timeZone: "UTC" }
      : event.all_day
        ? { date: event.start_time.split("T")[0] }
        : { dateTime: event.start_time, timeZone: "UTC" },
  };

  if (event.recurrence) {
    const ruleMap = {
      daily: "RRULE:FREQ=DAILY",
      weekly: "RRULE:FREQ=WEEKLY",
      monthly: "RRULE:FREQ=MONTHLY",
    };
    if (ruleMap[event.recurrence]) {
      gcalEvent.recurrence = [ruleMap[event.recurrence]];
    }
  }

  let googleEventId = event.google_event_id;

  if (googleEventId) {
    // Update existing
    await calendar.events.update({
      calendarId: event.google_calendar_id || "primary",
      eventId: googleEventId,
      requestBody: gcalEvent,
    });
  } else {
    // Insert new
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: gcalEvent,
    });
    googleEventId = res.data.id;
  }

  // Update local record
  await supabase
    .from("calendar_events")
    .update({
      google_event_id: googleEventId,
      google_calendar_id: "primary",
      sync_status: "synced",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", event.id);

  return googleEventId;
}

/**
 * Delete a Google Calendar event
 */
async function deleteGoogleEvent(userId, googleEventId, calendarId = "primary") {
  const client = await getCalendarClient(userId);
  if (!client || !googleEventId) return;

  try {
    await client.calendar.events.delete({
      calendarId,
      eventId: googleEventId,
    });
  } catch (err) {
    // 404 = already deleted on Google side, that's fine
    if (err.code !== 404) throw err;
  }
}

/**
 * Pull events from Google Calendar using incremental sync
 * @param {string} userId
 * @returns {Promise<object>} { synced, created, updated, nextSyncToken }
 */
async function pullEvents(userId) {
  const client = await getCalendarClient(userId);
  if (!client) return { synced: 0, created: 0, updated: 0 };

  const { calendar, integration } = client;
  const syncToken = integration.calendar_sync_token;

  let params = { calendarId: "primary", singleEvents: true, maxResults: 250 };

  if (syncToken) {
    params.syncToken = syncToken;
  } else {
    // First sync: pull events from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    params.timeMin = thirtyDaysAgo.toISOString();
  }

  let allEvents = [];
  let nextPageToken;
  let nextSyncToken;

  try {
    do {
      if (nextPageToken) params.pageToken = nextPageToken;
      const res = await calendar.events.list(params);
      allEvents = allEvents.concat(res.data.items || []);
      nextPageToken = res.data.nextPageToken;
      nextSyncToken = res.data.nextSyncToken;
    } while (nextPageToken);
  } catch (err) {
    if (err.code === 410) {
      // Sync token expired, do full re-sync
      delete params.syncToken;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      params.timeMin = thirtyDaysAgo.toISOString();
      const res = await calendar.events.list(params);
      allEvents = res.data.items || [];
      nextSyncToken = res.data.nextSyncToken;
    } else {
      throw err;
    }
  }

  let created = 0;
  let updated = 0;

  for (const gEvent of allEvents) {
    if (gEvent.status === "cancelled") {
      // Delete locally if exists
      await supabase
        .from("calendar_events")
        .delete()
        .eq("user_id", userId)
        .eq("google_event_id", gEvent.id);
      continue;
    }

    const startTime = gEvent.start?.dateTime || gEvent.start?.date;
    const endTime = gEvent.end?.dateTime || gEvent.end?.date;
    const isAllDay = !!gEvent.start?.date;

    // Check if event exists locally
    const { data: existing } = await supabase
      .from("calendar_events")
      .select("id, updated_at")
      .eq("user_id", userId)
      .eq("google_event_id", gEvent.id)
      .single();

    const eventData = {
      title: gEvent.summary || "(No title)",
      description: gEvent.description || null,
      start_time: startTime,
      end_time: endTime || null,
      all_day: isAllDay,
      google_event_id: gEvent.id,
      google_calendar_id: "primary",
      sync_status: "synced",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase
        .from("calendar_events")
        .update(eventData)
        .eq("id", existing.id);
      updated++;
    } else {
      await supabase
        .from("calendar_events")
        .insert({ ...eventData, user_id: userId });
      created++;
    }
  }

  // Store new sync token
  if (nextSyncToken) {
    await supabase
      .from("google_integrations")
      .update({
        calendar_sync_token: nextSyncToken,
        last_calendar_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  return {
    synced: allEvents.length,
    created,
    updated,
    nextSyncToken: nextSyncToken || null,
  };
}

/**
 * Full bidirectional sync
 * 1. Push all unsynced local events to Google
 * 2. Pull all changes from Google
 */
async function syncBidirectional(userId) {
  // Push unsynced local events
  const { data: unsyncedEvents } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .eq("sync_status", "local");

  let pushed = 0;
  for (const event of unsyncedEvents || []) {
    try {
      await pushEvent(userId, event);
      pushed++;
    } catch (err) {
      console.error(`Failed to push event ${event.id}:`, err.message);
    }
  }

  // Pull from Google
  const pullResult = await pullEvents(userId);

  return {
    pushed,
    pulled: pullResult.synced,
    created: pullResult.created,
    updated: pullResult.updated,
  };
}

module.exports = {
  pushEvent,
  deleteGoogleEvent,
  pullEvents,
  syncBidirectional,
};
