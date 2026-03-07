#!/usr/bin/env node

/**
 * Demo Seed Script
 *
 * Populates the database with realistic research analyst data for demo purposes.
 * Persona: Dr. Alex Chen — manages 3 research projects under different PIs.
 *
 * Usage:
 *   node backend/__tests__/demo-seed.js          # Seed data
 *   node backend/__tests__/demo-seed.js --clean   # Remove seeded data
 *
 * Data created:
 *   - 3 projects (Alzheimer's, Climate Modeling, Genomics Pipeline)
 *   - 17 tasks across all projects (mixed statuses, some overdue)
 *   - 4 calendar events (PI meetings, deadlines)
 *   - 5 imported emails (from 3 PIs)
 */

"use strict";

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Test user credentials
const TEST_EMAIL = "testuser2@gmail.com";
const TEST_PASSWORD = "TestPassword123";

// Date helpers
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function daysAgo(n) {
  return daysFromNow(-n);
}

function isoDateTime(dateStr, time) {
  return `${dateStr}T${time}:00Z`;
}

// Tag for finding seeded data during cleanup
const DEMO_TAG = "[DEMO]";

// -----------------------------------------------------------------------
// Seed data definitions
// -----------------------------------------------------------------------

const PROJECTS = [
  {
    key: "alzheimers",
    title: "NIH Grant - Alzheimer's Biomarkers",
    description: "Multi-site study on blood-based biomarkers for early Alzheimer's detection. PI: Dr. Sarah Mitchell. NIH R01 funded, Year 2 of 5.",
  },
  {
    key: "climate",
    title: "NSF Climate Modeling Study",
    description: "Regional climate model calibration for Pacific Northwest precipitation patterns. PI: Dr. James Park. NSF grant, Year 1.",
  },
  {
    key: "genomics",
    title: "Industry Collab - Genomics Pipeline",
    description: "Partnered with BioGenix Inc. to build a cloud-native variant calling pipeline. PI: Dr. Priya Sharma. 6-month engagement.",
  },
];

function getTasks(projectIds) {
  return [
    // Alzheimer's project tasks
    { project_id: projectIds.alzheimers, title: "Literature review - AD biomarker panel", status: "done", priority: "medium", due_date: daysAgo(14) },
    { project_id: projectIds.alzheimers, title: "IRB approval for amended protocol", status: "done", priority: "high", due_date: daysAgo(7) },
    { project_id: projectIds.alzheimers, title: "Patient recruitment - cohort B (n=50)", status: "in_progress", priority: "high", due_date: daysFromNow(14) },
    { project_id: projectIds.alzheimers, title: "Biomarker assay development (p-tau217)", status: "todo", priority: "high", due_date: daysFromNow(21) },
    { project_id: projectIds.alzheimers, title: "Build data analysis pipeline", status: "todo", priority: "medium", due_date: daysFromNow(30) },
    { project_id: projectIds.alzheimers, title: "Draft manuscript introduction", status: "todo", priority: "low", due_date: daysFromNow(60) },

    // Climate modeling tasks
    { project_id: projectIds.climate, title: "Download CMIP6 dataset (historical)", status: "done", priority: "medium", due_date: daysAgo(10) },
    { project_id: projectIds.climate, title: "Model calibration - WRF regional parameters", status: "in_progress", priority: "high", due_date: daysAgo(3) }, // OVERDUE
    { project_id: projectIds.climate, title: "Validation framework implementation", status: "todo", priority: "high", due_date: daysFromNow(3) }, // DUE SOON
    { project_id: projectIds.climate, title: "Peer review of methodology section", status: "todo", priority: "medium", due_date: daysFromNow(10) },
    { project_id: projectIds.climate, title: "Write conference abstract - AGU 2026", status: "todo", priority: "urgent", due_date: daysFromNow(2) }, // URGENT, DUE VERY SOON

    // Genomics pipeline tasks
    { project_id: projectIds.genomics, title: "Requirements gathering with BioGenix team", status: "in_progress", priority: "high", due_date: daysFromNow(1) },
    { project_id: projectIds.genomics, title: "Design pipeline architecture (Nextflow)", status: "todo", priority: "high", due_date: daysFromNow(7) },
    { project_id: projectIds.genomics, title: "Prepare test dataset (NA12878 reference)", status: "todo", priority: "medium", due_date: daysFromNow(10) },
    { project_id: projectIds.genomics, title: "Benchmarking against GATK Best Practices", status: "todo", priority: "medium", due_date: daysFromNow(21) },
    { project_id: projectIds.genomics, title: "Set up CI/CD for pipeline validation", status: "todo", priority: "low", due_date: daysFromNow(25) },
    { project_id: projectIds.genomics, title: "Draft technical report for BioGenix", status: "todo", priority: "low", due_date: daysFromNow(30) },
  ];
}

function getCalendarEvents(userId) {
  return [
    {
      user_id: userId,
      title: "PI Meeting - Dr. Priya Sharma (Genomics Kickoff)",
      description: "Discuss requirements gathering progress and pipeline architecture options.",
      start_time: isoDateTime(daysFromNow(1), "10:00"),
      end_time: isoDateTime(daysFromNow(1), "11:00"),
      status: "scheduled",
    },
    {
      user_id: userId,
      title: "Lab Group Seminar - Biomarker Advances",
      description: "Present preliminary results from cohort A to the Mitchell lab group.",
      start_time: isoDateTime(daysFromNow(3), "14:00"),
      end_time: isoDateTime(daysFromNow(3), "15:30"),
      status: "scheduled",
    },
    {
      user_id: userId,
      title: "AGU Abstract Submission Deadline",
      description: "Final deadline for conference abstract submission. Dr. Park needs to approve before submitting.",
      start_time: isoDateTime(daysFromNow(2), "17:00"),
      all_day: false,
      status: "scheduled",
    },
    {
      user_id: userId,
      title: "Sequencing Core - HiSeq Booking",
      description: "Reserved time on the HiSeq 4000 for validation samples.",
      start_time: isoDateTime(daysFromNow(5), "09:00"),
      end_time: isoDateTime(daysFromNow(5), "12:00"),
      status: "scheduled",
    },
  ];
}

function getImportedEmails(userId) {
  return [
    {
      user_id: userId,
      gmail_message_id: "demo_msg_001",
      subject: "Preliminary biomarker results - Cohort A",
      sender: "s.mitchell@university.edu",
      sender_name: "Dr. Sarah Mitchell",
      received_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      snippet: "Alex, the preliminary p-tau217 results from cohort A are in. The signal-to-noise ratio looks promising (AUC 0.89). I've uploaded the raw data to our shared drive. Can you start running the analysis pipeline on this batch? We should discuss next steps at the lab seminar on Thursday.",
      labels: ["INBOX", "IMPORTANT"],
      is_read: false,
    },
    {
      user_id: userId,
      gmail_message_id: "demo_msg_002",
      subject: "Protocol Amendment - Updated consent forms",
      sender: "s.mitchell@university.edu",
      sender_name: "Dr. Sarah Mitchell",
      received_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      snippet: "The IRB approved our protocol amendment v3.2. Updated consent forms are attached. Please distribute to all recruitment sites by end of week. Also, we need to update the patient recruitment SOP to reflect the new inclusion criteria for cohort B.",
      labels: ["INBOX"],
      is_read: false,
    },
    {
      user_id: userId,
      gmail_message_id: "demo_msg_003",
      subject: "RE: AGU Abstract - URGENT deadline reminder",
      sender: "j.park@university.edu",
      sender_name: "Dr. James Park",
      received_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      snippet: "Alex, just a reminder that the AGU abstract deadline is in 2 days. I've reviewed your draft and left comments on the shared doc. Main feedback: strengthen the validation metrics section and add the new precipitation bias correction results. Let's finalize tomorrow morning.",
      labels: ["INBOX", "IMPORTANT", "STARRED"],
      is_read: false,
    },
    {
      user_id: userId,
      gmail_message_id: "demo_msg_004",
      subject: "WRF Model Parameters - Updated Config",
      sender: "j.park@university.edu",
      sender_name: "Dr. James Park",
      received_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      snippet: "I've updated the WRF physics parameterization settings based on our latest sensitivity tests. The Thompson microphysics scheme with the YSU PBL is giving us better precipitation patterns. Please update the calibration run with these settings and compare against the PRISM observations.",
      labels: ["INBOX"],
      is_read: true,
    },
    {
      user_id: userId,
      gmail_message_id: "demo_msg_005",
      subject: "Welcome to the BioGenix Collaboration!",
      sender: "p.sharma@biogenix.com",
      sender_name: "Dr. Priya Sharma",
      received_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      snippet: "Welcome aboard, Alex! Attached is the project requirements document and our internal timeline. We're targeting a 6-month delivery for the MVP pipeline. Let's discuss during our kickoff meeting tomorrow. Key deliverables: Nextflow pipeline for WGS/WES variant calling, benchmarked against GATK and DeepVariant.",
      labels: ["INBOX"],
      is_read: true,
    },
  ];
}

// -----------------------------------------------------------------------
// Seed function
// -----------------------------------------------------------------------

async function seed() {
  console.log("Signing in as test user...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError) {
    console.error("Auth failed:", authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`Authenticated as ${TEST_EMAIL} (${userId})`);

  // --- Create projects ---
  console.log("\nCreating projects...");
  const projectIds = {};

  for (const proj of PROJECTS) {
    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        title: proj.title,
        description: proj.description,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error(`  Failed to create "${proj.title}":`, error.message);
      continue;
    }
    projectIds[proj.key] = data.id;
    console.log(`  Created: ${proj.title} (${data.id})`);
  }

  // --- Create tasks ---
  console.log("\nCreating tasks...");
  const tasks = getTasks(projectIds);
  for (const task of tasks) {
    const { error } = await supabase.from("tasks").insert(task);
    if (error) {
      console.error(`  Failed: "${task.title}":`, error.message);
    } else {
      const statusIcon = task.status === "done" ? "done" : task.status === "in_progress" ? "wip" : "todo";
      console.log(`  [${statusIcon}] ${task.title}`);
    }
  }

  // --- Create calendar events ---
  console.log("\nCreating calendar events...");
  const events = getCalendarEvents(userId);
  for (const event of events) {
    const { error } = await supabase.from("calendar_events").insert(event);
    if (error) {
      console.error(`  Failed: "${event.title}":`, error.message);
    } else {
      console.log(`  Scheduled: ${event.title}`);
    }
  }

  // --- Create imported emails ---
  console.log("\nCreating imported emails...");
  const emails = getImportedEmails(userId);
  for (const email of emails) {
    const { error } = await supabase
      .from("imported_emails")
      .upsert(email, { onConflict: "user_id,gmail_message_id" });
    if (error) {
      console.error(`  Failed: "${email.subject}":`, error.message);
    } else {
      console.log(`  Imported: ${email.subject} (from ${email.sender_name})`);
    }
  }

  console.log("\n--- Demo seed complete ---");
  console.log(`Projects: ${Object.keys(projectIds).length}`);
  console.log(`Tasks: ${tasks.length}`);
  console.log(`Calendar Events: ${events.length}`);
  console.log(`Imported Emails: ${emails.length}`);

  // Output project IDs for reference
  console.log("\nProject IDs:");
  for (const [key, id] of Object.entries(projectIds)) {
    console.log(`  ${key}: ${id}`);
  }
}

// -----------------------------------------------------------------------
// Clean function — removes demo data
// -----------------------------------------------------------------------

async function clean() {
  console.log("Signing in as test user...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError) {
    console.error("Auth failed:", authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`Authenticated as ${TEST_EMAIL} (${userId})`);

  // Find demo projects by title
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .eq("user_id", userId)
    .in("title", PROJECTS.map((p) => p.title));

  if (projects && projects.length > 0) {
    const projectIds = projects.map((p) => p.id);

    // Delete tasks for these projects
    console.log(`Deleting tasks for ${projects.length} demo projects...`);
    await supabase.from("tasks").delete().in("project_id", projectIds);

    // Delete calendar events linked to these projects
    await supabase.from("calendar_events").delete().in("project_id", projectIds);

    // Delete the projects
    console.log("Deleting demo projects...");
    await supabase.from("projects").delete().in("id", projectIds);

    for (const p of projects) {
      console.log(`  Deleted: ${p.title}`);
    }
  }

  // Delete demo calendar events by title
  const demoEventTitles = getCalendarEvents(userId).map((e) => e.title);
  console.log("Deleting demo calendar events...");
  await supabase
    .from("calendar_events")
    .delete()
    .eq("user_id", userId)
    .in("title", demoEventTitles);

  // Delete demo emails
  const demoEmailIds = getImportedEmails(userId).map((e) => e.gmail_message_id);
  console.log("Deleting demo imported emails...");
  await supabase
    .from("imported_emails")
    .delete()
    .eq("user_id", userId)
    .in("gmail_message_id", demoEmailIds);

  console.log("\n--- Demo data cleaned ---");
}

// -----------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes("--clean")) {
  clean().catch(console.error);
} else {
  seed().catch(console.error);
}
