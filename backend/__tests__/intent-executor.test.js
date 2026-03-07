/**
 * Intent Executor Unit Tests
 *
 * Tests the executeIntent function directly with real Supabase
 * but without Gemini — we pass intent objects as if Gemini parsed them.
 */

"use strict";

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { executeIntent } = require("../src/services/logicAi/intentExecutor");
const { getTestAuth } = require("./helpers");
const supabase = require("../src/lib/supabase");

let userId;

// Track IDs for cleanup
const cleanupProjectIds = [];
const cleanupEventIds = [];

beforeAll(async () => {
  const auth = await getTestAuth();
  userId = auth.userId;
});

afterAll(async () => {
  // Clean up test projects (hard delete)
  for (const id of cleanupProjectIds) {
    await supabase.from("tasks").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
  }
  for (const id of cleanupEventIds) {
    await supabase.from("calendar_events").delete().eq("id", id);
  }
});

// -----------------------------------------------------------------------
// respond & clarify (no DB needed)
// -----------------------------------------------------------------------
describe("respond intent", () => {
  it("returns the message directly", async () => {
    const result = await executeIntent(
      { name: "respond", args: { message: "Hello there!" } },
      userId
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Hello there!");
  });
});

describe("clarify intent", () => {
  it("returns promptText and requiresResponse", async () => {
    const result = await executeIntent(
      { name: "clarify", args: { promptText: "Which project?" } },
      userId
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Which project?");
    expect(result.requiresResponse).toBe(true);
  });
});

// -----------------------------------------------------------------------
// create_project
// -----------------------------------------------------------------------
describe("create_project intent", () => {
  it("creates a project with just a title", async () => {
    const result = await executeIntent(
      { name: "create_project", args: { title: "Intent Test Project" } },
      userId
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("Intent Test Project");
    expect(result.data).toHaveProperty("id");
    cleanupProjectIds.push(result.data.id);
  });

  it("creates a project with batch tasks", async () => {
    const result = await executeIntent(
      {
        name: "create_project",
        args: {
          title: "Project With Tasks",
          tasks: [
            { title: "Task A", priority: "high" },
            { title: "Task B", priority: "low" },
          ],
        },
      },
      userId
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("2 tasks");
    cleanupProjectIds.push(result.data.id);
  });
});

// -----------------------------------------------------------------------
// list_projects
// -----------------------------------------------------------------------
describe("list_projects intent", () => {
  it("lists user projects", async () => {
    const result = await executeIntent(
      { name: "list_projects", args: {} },
      userId
    );
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("projects");
    expect(Array.isArray(result.data.projects)).toBe(true);
  });
});

// -----------------------------------------------------------------------
// create_task
// -----------------------------------------------------------------------
describe("create_task intent", () => {
  it("creates a task in the most recent project", async () => {
    const result = await executeIntent(
      {
        name: "create_task",
        args: { title: "Intent Test Task", priority: "high" },
      },
      userId
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("Intent Test Task");
    // Task cleanup happens via project hard delete
  });
});

// -----------------------------------------------------------------------
// list_tasks
// -----------------------------------------------------------------------
describe("list_tasks intent", () => {
  it("lists tasks across all projects", async () => {
    const result = await executeIntent(
      { name: "list_tasks", args: {} },
      userId
    );
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("tasks");
  });
});

// -----------------------------------------------------------------------
// create_event
// -----------------------------------------------------------------------
describe("create_event intent", () => {
  it("creates a calendar event", async () => {
    const result = await executeIntent(
      {
        name: "create_event",
        args: {
          title: "Intent Test Meeting",
          date: "2026-04-20",
          startTime: "14:00",
          endTime: "15:00",
        },
      },
      userId
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("Intent Test Meeting");
    expect(result.data).toHaveProperty("id");
    cleanupEventIds.push(result.data.id);
  });

  it("creates an all-day event when no time provided", async () => {
    const result = await executeIntent(
      {
        name: "create_event",
        args: { title: "All Day Intent Event", date: "2026-04-21" },
      },
      userId
    );
    expect(result.success).toBe(true);
    expect(result.data.all_day).toBe(true);
    cleanupEventIds.push(result.data.id);
  });
});

// -----------------------------------------------------------------------
// run_housekeeping
// -----------------------------------------------------------------------
describe("run_housekeeping intent", () => {
  it("returns a health check report", async () => {
    const result = await executeIntent(
      { name: "run_housekeeping", args: {} },
      userId
    );
    expect(result.success).toBe(true);
    expect(typeof result.message).toBe("string");
    expect(result.data).toBeDefined();
  });
});

// -----------------------------------------------------------------------
// delete_project (soft archive)
// -----------------------------------------------------------------------
describe("delete_project intent", () => {
  it("archives a project by ID", async () => {
    // Create a project to archive
    const createResult = await executeIntent(
      { name: "create_project", args: { title: "To Archive Via Intent" } },
      userId
    );
    const projectId = createResult.data.id;
    cleanupProjectIds.push(projectId);

    const result = await executeIntent(
      { name: "delete_project", args: { projectId } },
      userId
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("Archived");
  });

  it("returns error when no projectId provided", async () => {
    const result = await executeIntent(
      { name: "delete_project", args: {} },
      userId
    );
    expect(result.success).toBe(false);
  });
});

// -----------------------------------------------------------------------
// Unknown intent
// -----------------------------------------------------------------------
describe("unknown intent", () => {
  it("returns an error for unknown action names", async () => {
    const result = await executeIntent(
      { name: "do_magic", args: {} },
      userId
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Unknown action");
  });
});
