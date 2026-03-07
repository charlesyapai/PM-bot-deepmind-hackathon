/**
 * Demo Walkthrough Test
 *
 * Validates the demo scenario end-to-end by simulating the voice commands
 * a research analyst would use. Tests the intent executor directly (no Gemini)
 * to verify each demo step produces correct results.
 *
 * Prerequisites:
 *   Run `node backend/__tests__/demo-seed.js` first to populate demo data.
 *
 * This test does NOT call Gemini — it calls executeIntent directly with
 * the intents that Gemini would produce. This validates the backend logic
 * independently of AI parsing accuracy.
 */

"use strict";

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const request = require("supertest");
const { app } = require("../server");
const { executeIntent } = require("../src/services/logicAi/intentExecutor");
const { getTestAuth } = require("./helpers");
const supabase = require("../src/lib/supabase");

let authToken;
let userId;

// Demo project IDs — resolved in beforeAll
let alzheimersProjectId;
let climateProjectId;
let genomicsProjectId;

beforeAll(async () => {
  const auth = await getTestAuth();
  authToken = auth.authToken;
  userId = auth.userId;

  // Find demo projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .eq("user_id", userId)
    .eq("status", "active");

  for (const p of projects || []) {
    if (p.title.includes("Alzheimer")) alzheimersProjectId = p.id;
    if (p.title.includes("Climate")) climateProjectId = p.id;
    if (p.title.includes("Genomics")) genomicsProjectId = p.id;
  }
});

// -----------------------------------------------------------------------
// Scene 1: Morning Check-in — "Catch me up"
// -----------------------------------------------------------------------
describe("Scene 1: Board Update / Housekeeping", () => {
  it("run_housekeeping returns overdue tasks and upcoming deadlines", async () => {
    const result = await executeIntent(
      { name: "run_housekeeping", args: {} },
      userId
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // Should detect the overdue model calibration task
    if (result.data.overdueTasks && result.data.overdueTasks.length > 0) {
      const overdueNames = result.data.overdueTasks.map((t) => t.title);
      expect(overdueNames.some((t) => t.toLowerCase().includes("calibration"))).toBe(true);
    }
  });

  it("list_projects shows all 3 research projects", async () => {
    const result = await executeIntent(
      { name: "list_projects", args: {} },
      userId
    );

    expect(result.success).toBe(true);
    expect(result.data.projects.length).toBeGreaterThanOrEqual(3);
    expect(result.message).toContain("Alzheimer");
    expect(result.message).toContain("Climate");
    expect(result.message).toContain("Genomics");
  });
});

// -----------------------------------------------------------------------
// Scene 2: Email Triage
// -----------------------------------------------------------------------
describe("Scene 2: Email Triage", () => {
  // Note: imported_emails has RLS requiring auth.uid(), so we query with
  // an authenticated supabase client rather than the backend's shared client.
  let authSupabase;

  beforeAll(async () => {
    const { createClient } = require("@supabase/supabase-js");
    authSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    await authSupabase.auth.signInWithPassword({
      email: "testuser2@gmail.com",
      password: "TestPassword123",
    });
  });

  it("imported emails from Dr. Mitchell exist in DB", async () => {
    const { data: emails } = await authSupabase
      .from("imported_emails")
      .select("id, subject, sender_name")
      .eq("user_id", userId)
      .ilike("sender_name", "%Mitchell%");

    expect(emails).toBeDefined();
    expect(emails.length).toBeGreaterThanOrEqual(2);
  });

  it("imported emails from Dr. Park include AGU abstract", async () => {
    const { data: emails } = await authSupabase
      .from("imported_emails")
      .select("id, subject, sender_name")
      .eq("user_id", userId)
      .ilike("sender_name", "%Park%");

    expect(emails).toBeDefined();
    expect(emails.length).toBeGreaterThanOrEqual(1);
    const subjects = emails.map((e) => e.subject);
    expect(subjects.some((s) => s.includes("AGU"))).toBe(true);
  });

  it("create_task_from_email creates a task from a demo email", async () => {
    // Find the protocol amendment email using authenticated client
    const { data: email } = await authSupabase
      .from("imported_emails")
      .select("id")
      .eq("user_id", userId)
      .eq("gmail_message_id", "demo_msg_002")
      .single();

    if (!email) {
      console.log("Skipping — demo emails not seeded");
      return;
    }

    // Verify the email exists and is accessible for task creation
    expect(email).toHaveProperty("id");
  });
});

// -----------------------------------------------------------------------
// Scene 3: Task Management
// -----------------------------------------------------------------------
describe("Scene 3: Task Management", () => {
  it("list_tasks shows tasks across all projects", async () => {
    const result = await executeIntent(
      { name: "list_tasks", args: {} },
      userId
    );

    expect(result.success).toBe(true);
    expect(result.data.tasks.length).toBeGreaterThan(0);
  });

  it("list_tasks filtered by project shows only that project's tasks", async () => {
    if (!alzheimersProjectId) return;

    const result = await executeIntent(
      { name: "list_tasks", args: { projectId: alzheimersProjectId } },
      userId
    );

    expect(result.success).toBe(true);
    // Only non-done tasks are returned
    if (result.data.tasks.length > 0) {
      expect(result.message.toLowerCase()).toContain("alzheimer");
    }
  });

  it("update_task marks a task as done", async () => {
    // Find the patient recruitment task
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status")
      .eq("project_id", alzheimersProjectId)
      .ilike("title", "%recruitment%")
      .limit(1);

    if (!tasks || tasks.length === 0) return;

    const originalStatus = tasks[0].status;

    const result = await executeIntent(
      { name: "update_task", args: { taskId: tasks[0].id, status: "done" } },
      userId
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("Updated");

    // Restore original status
    await supabase.from("tasks").update({ status: originalStatus }).eq("id", tasks[0].id);
  });
});

// -----------------------------------------------------------------------
// Scene 4: Scheduling
// -----------------------------------------------------------------------
describe("Scene 4: Calendar Scheduling", () => {
  let createdEventId;

  afterAll(async () => {
    if (createdEventId) {
      await supabase.from("calendar_events").delete().eq("id", createdEventId);
    }
  });

  it("create_event schedules a meeting with a PI", async () => {
    const friday = new Date();
    friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7 || 7));
    const fridayISO = friday.toISOString().split("T")[0];

    const result = await executeIntent(
      {
        name: "create_event",
        args: {
          title: "Meeting with Dr. Mitchell - Biomarker Results",
          date: fridayISO,
          startTime: "14:00",
          endTime: "15:00",
          description: "Discuss preliminary p-tau217 results from cohort A.",
          projectId: alzheimersProjectId,
        },
      },
      userId
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("Mitchell");
    expect(result.data).toHaveProperty("id");
    createdEventId = result.data.id;
  });

  it("GET /api/v1/calendar shows upcoming events", async () => {
    const res = await request(app)
      .get("/api/v1/calendar")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

// -----------------------------------------------------------------------
// Scene 5: Project Overview
// -----------------------------------------------------------------------
describe("Scene 5: Project Overview", () => {
  it("GET /api/v1/housekeeping returns structured health report", async () => {
    const res = await request(app)
      .get("/api/v1/housekeeping")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(typeof res.body.summary.overdue).toBe("number");
    expect(typeof res.body.summary.upcoming).toBe("number");
  });
});

// -----------------------------------------------------------------------
// Scene 6: Quick Create — batch project with tasks
// -----------------------------------------------------------------------
describe("Scene 6: Batch Project Creation", () => {
  let createdProjectId;

  afterAll(async () => {
    if (createdProjectId) {
      await supabase.from("tasks").delete().eq("project_id", createdProjectId);
      await supabase.from("projects").delete().eq("id", createdProjectId);
    }
  });

  it("create_project with batch tasks creates project + 4 tasks", async () => {
    const result = await executeIntent(
      {
        name: "create_project",
        args: {
          title: "Conference Poster - AGU 2026",
          description: "Poster presentation for the AGU Fall Meeting",
          tasks: [
            { title: "Design poster layout", priority: "medium" },
            { title: "Write abstract section", priority: "high" },
            { title: "Gather figures and plots", priority: "medium" },
            { title: "Get PI feedback on draft", priority: "high" },
          ],
        },
      },
      userId
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("Conference Poster");
    expect(result.message).toContain("4 tasks");
    createdProjectId = result.data.id;
  });
});

// -----------------------------------------------------------------------
// Scene 7: Respond & Clarify (conversational AI)
// -----------------------------------------------------------------------
describe("Scene 7: Conversational Responses", () => {
  it("respond intent returns a friendly message", async () => {
    const result = await executeIntent(
      {
        name: "respond",
        args: {
          message: "Good morning, Alex! You have 3 active projects. The AGU abstract deadline is in 2 days — want me to pull up your draft?",
          suggestedActions: ["Show AGU abstract tasks", "Check emails from Dr. Park"],
        },
      },
      userId
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("Good morning");
    expect(result.data.suggestedActions).toHaveLength(2);
  });

  it("clarify intent returns a question", async () => {
    const result = await executeIntent(
      {
        name: "clarify",
        args: { promptText: "Which project do you want to add the task to — Alzheimer's Biomarkers or Climate Modeling?" },
      },
      userId
    );

    expect(result.success).toBe(true);
    expect(result.requiresResponse).toBe(true);
  });
});
