#!/usr/bin/env node

/**
 * Check and Migrate Script
 *
 * Checks if required v2 schema columns/tables exist in Supabase,
 * and creates any that are missing.
 *
 * Usage: node backend/scripts/check-and-migrate.js
 */

"use strict";

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// We use the Supabase REST API to probe for columns/tables.
// If a select on a column returns a PostgrestError with code "42703" (undefined column)
// or "42P01" (undefined table), the column/table doesn't exist.

async function columnExists(table, column) {
  const { error } = await supabase.from(table).select(column).limit(0);
  if (!error) return true;
  // 42703 = undefined_column, PGRST204 = column not found
  if (error.code === "42703" || error.message?.includes(column)) return false;
  // If the table itself doesn't exist
  if (error.code === "42P01") return false;
  // Other error — assume it exists to be safe
  console.warn(`  Warning checking ${table}.${column}:`, error.message);
  return true;
}

async function tableExists(table) {
  const { error } = await supabase.from(table).select("id").limit(0);
  if (!error) return true;
  if (error.code === "42P01" || error.message?.includes("does not exist")) return false;
  // PGRST116 means "not found" which for tables means it doesn't exist in PostgREST schema cache
  if (error.code === "PGRST116" || error.message?.includes("relation")) return false;
  console.warn(`  Warning checking table ${table}:`, error.message);
  return true;
}

async function main() {
  console.log("=== Schema Migration Check ===\n");

  const results = { ok: [], missing: [] };

  // --- 1. Check google_integrations table ---
  console.log("1. Checking google_integrations table...");
  if (await tableExists("google_integrations")) {
    results.ok.push("google_integrations table");
    console.log("   EXISTS");
  } else {
    results.missing.push("google_integrations table");
    console.log("   MISSING — Run this SQL in Supabase SQL Editor:");
    console.log(`
CREATE TABLE google_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  google_access_token TEXT NOT NULL,
  google_refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  gmail_address TEXT,
  scopes TEXT[],
  calendar_sync_token TEXT,
  drive_root_folder_id TEXT,
  last_calendar_sync TIMESTAMPTZ,
  last_email_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own integration" ON google_integrations FOR ALL USING (auth.uid() = user_id);
`);
  }

  // --- 2. Check board_updates table ---
  console.log("2. Checking board_updates table...");
  if (await tableExists("board_updates")) {
    results.ok.push("board_updates table");
    console.log("   EXISTS");
  } else {
    results.missing.push("board_updates table");
    console.log("   MISSING — Run this SQL in Supabase SQL Editor:");
    console.log(`
CREATE TABLE board_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  trigger TEXT NOT NULL CHECK (trigger IN ('voice', 'manual', 'scheduled')),
  summary TEXT,
  suggested_actions JSONB,
  email_data JSONB,
  drive_data JSONB,
  calendar_data JSONB,
  housekeeping_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE board_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own updates" ON board_updates FOR ALL USING (auth.uid() = user_id);
`);
  }

  // --- 3. Check email_rules table ---
  console.log("3. Checking email_rules table...");
  if (await tableExists("email_rules")) {
    results.ok.push("email_rules table");
    console.log("   EXISTS");

    // Check for project_id column
    console.log("   3a. Checking email_rules.project_id...");
    if (await columnExists("email_rules", "project_id")) {
      results.ok.push("email_rules.project_id");
      console.log("       EXISTS");
    } else {
      results.missing.push("email_rules.project_id");
      console.log("       MISSING — Run: ALTER TABLE email_rules ADD COLUMN project_id UUID REFERENCES projects(id);");
    }
  } else {
    results.missing.push("email_rules table");
    console.log("   MISSING — Run this SQL in Supabase SQL Editor:");
    console.log(`
CREATE TABLE email_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rule_name TEXT NOT NULL,
  sender_filter TEXT,
  label_filter TEXT,
  date_range_days INTEGER DEFAULT 7,
  auto_import BOOLEAN DEFAULT false,
  project_id UUID REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE email_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own rules" ON email_rules FOR ALL USING (auth.uid() = user_id);
`);
  }

  // --- 4. Check imported_emails table ---
  console.log("4. Checking imported_emails table...");
  if (await tableExists("imported_emails")) {
    results.ok.push("imported_emails table");
    console.log("   EXISTS");

    // Check for project_id column
    console.log("   4a. Checking imported_emails.project_id...");
    if (await columnExists("imported_emails", "project_id")) {
      results.ok.push("imported_emails.project_id");
      console.log("       EXISTS");
    } else {
      results.missing.push("imported_emails.project_id");
      console.log("       MISSING — Run: ALTER TABLE imported_emails ADD COLUMN project_id UUID REFERENCES projects(id);");
    }

    // Check for body_text column
    console.log("   4b. Checking imported_emails.body_text...");
    if (await columnExists("imported_emails", "body_text")) {
      results.ok.push("imported_emails.body_text");
      console.log("       EXISTS");
    } else {
      results.missing.push("imported_emails.body_text");
      console.log("       MISSING — Run: ALTER TABLE imported_emails ADD COLUMN body_text TEXT;");
    }
  } else {
    results.missing.push("imported_emails table");
    console.log("   MISSING — Run this SQL in Supabase SQL Editor:");
    console.log(`
CREATE TABLE imported_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  gmail_message_id TEXT NOT NULL,
  subject TEXT,
  sender TEXT,
  sender_name TEXT,
  received_at TIMESTAMPTZ,
  snippet TEXT,
  body_text TEXT,
  labels TEXT[],
  is_read BOOLEAN DEFAULT false,
  project_id UUID REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, gmail_message_id)
);
ALTER TABLE imported_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own emails" ON imported_emails FOR ALL USING (auth.uid() = user_id);
`);
  }

  // --- 5. Check calendar_events sync columns ---
  console.log("5. Checking calendar_events sync columns...");
  for (const col of ["google_event_id", "google_calendar_id", "sync_status", "last_synced_at"]) {
    console.log(`   5. Checking calendar_events.${col}...`);
    if (await columnExists("calendar_events", col)) {
      results.ok.push(`calendar_events.${col}`);
      console.log("       EXISTS");
    } else {
      results.missing.push(`calendar_events.${col}`);
      const defs = {
        google_event_id: "ALTER TABLE calendar_events ADD COLUMN google_event_id TEXT;",
        google_calendar_id: "ALTER TABLE calendar_events ADD COLUMN google_calendar_id TEXT DEFAULT 'primary';",
        sync_status: "ALTER TABLE calendar_events ADD COLUMN sync_status TEXT DEFAULT 'local' CHECK (sync_status IN ('local', 'synced', 'conflict'));",
        last_synced_at: "ALTER TABLE calendar_events ADD COLUMN last_synced_at TIMESTAMPTZ;",
      };
      console.log(`       MISSING — Run: ${defs[col]}`);
    }
  }

  // --- 6. Check projects Drive columns ---
  console.log("6. Checking projects Drive columns...");
  for (const col of ["drive_folder_id", "drive_folder_url"]) {
    console.log(`   6. Checking projects.${col}...`);
    if (await columnExists("projects", col)) {
      results.ok.push(`projects.${col}`);
      console.log("       EXISTS");
    } else {
      results.missing.push(`projects.${col}`);
      console.log(`       MISSING — Run: ALTER TABLE projects ADD COLUMN ${col} TEXT;`);
    }
  }

  // --- 7. Check attachments table + columns ---
  console.log("7. Checking attachments table...");
  if (await tableExists("attachments")) {
    results.ok.push("attachments table");
    console.log("   EXISTS");

    for (const col of ["drive_file_id", "drive_url", "source"]) {
      console.log(`   7. Checking attachments.${col}...`);
      if (await columnExists("attachments", col)) {
        results.ok.push(`attachments.${col}`);
        console.log("       EXISTS");
      } else {
        results.missing.push(`attachments.${col}`);
        const defs = {
          drive_file_id: "ALTER TABLE attachments ADD COLUMN drive_file_id TEXT;",
          drive_url: "ALTER TABLE attachments ADD COLUMN drive_url TEXT;",
          source: "ALTER TABLE attachments ADD COLUMN source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'drive', 'email'));",
        };
        console.log(`       MISSING — Run: ${defs[col]}`);
      }
    }
  } else {
    results.missing.push("attachments table");
    console.log("   MISSING — Run this SQL in Supabase SQL Editor:");
    console.log(`
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  task_id UUID REFERENCES tasks(id),
  project_id UUID REFERENCES projects(id),
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'drive', 'email')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own attachments" ON attachments FOR ALL USING (auth.uid() = user_id);
`);
  }

  // --- Summary ---
  console.log("\n=== SUMMARY ===");
  console.log(`OK: ${results.ok.length} items`);
  console.log(`MISSING: ${results.missing.length} items`);

  if (results.missing.length > 0) {
    console.log("\nMissing items:");
    results.missing.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));

    // Generate a combined SQL block for all missing items
    console.log("\n=== COMBINED SQL (paste into Supabase SQL Editor) ===\n");
    const sqlParts = [];

    for (const item of results.missing) {
      if (item === "google_integrations table") {
        sqlParts.push(`CREATE TABLE IF NOT EXISTS google_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  google_access_token TEXT NOT NULL,
  google_refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  gmail_address TEXT,
  scopes TEXT[],
  calendar_sync_token TEXT,
  drive_root_folder_id TEXT,
  last_calendar_sync TIMESTAMPTZ,
  last_email_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own integration" ON google_integrations FOR ALL USING (auth.uid() = user_id);`);
      }
      if (item === "board_updates table") {
        sqlParts.push(`CREATE TABLE IF NOT EXISTS board_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  trigger TEXT NOT NULL CHECK (trigger IN ('voice', 'manual', 'scheduled')),
  summary TEXT,
  suggested_actions JSONB,
  email_data JSONB,
  drive_data JSONB,
  calendar_data JSONB,
  housekeeping_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE board_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own updates" ON board_updates FOR ALL USING (auth.uid() = user_id);`);
      }
      if (item === "email_rules table") {
        sqlParts.push(`CREATE TABLE IF NOT EXISTS email_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rule_name TEXT NOT NULL,
  sender_filter TEXT,
  label_filter TEXT,
  date_range_days INTEGER DEFAULT 7,
  auto_import BOOLEAN DEFAULT false,
  project_id UUID REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE email_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own rules" ON email_rules FOR ALL USING (auth.uid() = user_id);`);
      }
      if (item === "imported_emails table") {
        sqlParts.push(`CREATE TABLE IF NOT EXISTS imported_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  gmail_message_id TEXT NOT NULL,
  subject TEXT,
  sender TEXT,
  sender_name TEXT,
  received_at TIMESTAMPTZ,
  snippet TEXT,
  body_text TEXT,
  labels TEXT[],
  is_read BOOLEAN DEFAULT false,
  project_id UUID REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, gmail_message_id)
);
ALTER TABLE imported_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own emails" ON imported_emails FOR ALL USING (auth.uid() = user_id);`);
      }
      if (item === "attachments table") {
        sqlParts.push(`CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  task_id UUID REFERENCES tasks(id),
  project_id UUID REFERENCES projects(id),
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'drive', 'email')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own attachments" ON attachments FOR ALL USING (auth.uid() = user_id);`);
      }
      if (item === "email_rules.project_id") {
        sqlParts.push(`ALTER TABLE email_rules ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);`);
      }
      if (item === "imported_emails.project_id") {
        sqlParts.push(`ALTER TABLE imported_emails ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);`);
      }
      if (item === "imported_emails.body_text") {
        sqlParts.push(`ALTER TABLE imported_emails ADD COLUMN IF NOT EXISTS body_text TEXT;`);
      }
      if (item === "calendar_events.google_event_id") {
        sqlParts.push(`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS google_event_id TEXT;`);
      }
      if (item === "calendar_events.google_calendar_id") {
        sqlParts.push(`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS google_calendar_id TEXT DEFAULT 'primary';`);
      }
      if (item === "calendar_events.sync_status") {
        sqlParts.push(`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'local';`);
      }
      if (item === "calendar_events.last_synced_at") {
        sqlParts.push(`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;`);
      }
      if (item === "projects.drive_folder_id") {
        sqlParts.push(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;`);
      }
      if (item === "projects.drive_folder_url") {
        sqlParts.push(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS drive_folder_url TEXT;`);
      }
      if (item === "attachments.drive_file_id") {
        sqlParts.push(`ALTER TABLE attachments ADD COLUMN IF NOT EXISTS drive_file_id TEXT;`);
      }
      if (item === "attachments.drive_url") {
        sqlParts.push(`ALTER TABLE attachments ADD COLUMN IF NOT EXISTS drive_url TEXT;`);
      }
      if (item === "attachments.source") {
        sqlParts.push(`ALTER TABLE attachments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload';`);
      }
    }

    console.log(sqlParts.join("\n\n"));
  } else {
    console.log("\nAll schema items are present! No migration needed.");
  }
}

main().catch(console.error);
