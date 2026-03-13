"use strict";

/**
 * Reset demo state so board update can re-process emails and suggest actions fresh.
 *
 * Usage: node scripts/reset-demo.js
 *
 * What it clears:
 * 1. imported_emails — so emails get re-imported
 * 2. board_updates — so old suggestions are gone
 * 3. last_email_sync — so email scan fetches from the beginning again
 * 4. (Optional) projects + tasks — uncomment if you want a fully clean slate
 */

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const USER_ID = "ba8eab5c-51ef-4911-b5d0-177910965a5b";

async function resetDemo() {
  console.log("Resetting demo state for user:", USER_ID);

  // 1. Delete imported emails
  const { error: e1, count: c1 } = await supabase
    .from("imported_emails")
    .delete({ count: "exact" })
    .eq("user_id", USER_ID);
  console.log(`  imported_emails: deleted ${c1 ?? "?"} rows`, e1 ? `(error: ${e1.message})` : "OK");

  // 2. Delete board updates
  const { error: e2, count: c2 } = await supabase
    .from("board_updates")
    .delete({ count: "exact" })
    .eq("user_id", USER_ID);
  console.log(`  board_updates: deleted ${c2 ?? "?"} rows`, e2 ? `(error: ${e2.message})` : "OK");

  // 3. Reset last_email_sync so next scan fetches from the beginning
  const { error: e3 } = await supabase
    .from("google_integrations")
    .update({ last_email_sync: null, updated_at: new Date().toISOString() })
    .eq("user_id", USER_ID);
  console.log(`  google_integrations.last_email_sync: reset to null`, e3 ? `(error: ${e3.message})` : "OK");

  // 4. Delete all projects + tasks for a fully clean slate
  const { data: projectIds } = await supabase.from("projects").select("id").eq("user_id", USER_ID);
  const ids = (projectIds || []).map(p => p.id);
  if (ids.length > 0) {
    const { error: e4, count: c4 } = await supabase.from("tasks").delete({ count: "exact" }).in("project_id", ids);
    console.log(`  tasks: deleted ${c4 ?? "?"} rows`, e4 ? `(error: ${e4.message})` : "OK");
  }
  const { error: e5, count: c5 } = await supabase.from("projects").delete({ count: "exact" }).eq("user_id", USER_ID);
  console.log(`  projects: deleted ${c5 ?? "?"} rows`, e5 ? `(error: ${e5.message})` : "OK");

  console.log("\nDemo reset complete! Run a board update to re-import emails and get fresh suggestions.");
}

resetDemo().catch((err) => {
  console.error("Reset failed:", err.message);
  process.exit(1);
});
