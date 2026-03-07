/**
 * Tasks API Integration Tests
 *
 * Endpoints tested:
 *   GET    /api/v1/tasks (?project_id=&status=&priority=)
 *   POST   /api/v1/tasks
 *   PUT    /api/v1/tasks/:id
 *   DELETE /api/v1/tasks/:id
 *   POST   /api/v1/tasks/:id/subtasks
 */

"use strict";

const request = require("supertest");
const { app } = require("../server");
const { getTestAuth } = require("./helpers");

let authToken;
let testProjectId;

// IDs for cleanup
const createdTaskIds = [];
const createdProjectIds = [];

beforeAll(async () => {
  const auth = await getTestAuth();
  authToken = auth.authToken;

  // Create a test project to hold tasks
  const res = await request(app)
    .post("/api/v1/projects")
    .set("Authorization", `Bearer ${authToken}`)
    .send({ title: "Tasks Test Project" });

  testProjectId = res.body.id;
  createdProjectIds.push(testProjectId);
});

afterAll(async () => {
  // Delete test tasks then projects
  for (const id of createdTaskIds) {
    await request(app)
      .delete(`/api/v1/tasks/${id}`)
      .set("Authorization", `Bearer ${authToken}`);
  }
  for (const id of createdProjectIds) {
    await request(app)
      .delete(`/api/v1/projects/${id}?hard=true`)
      .set("Authorization", `Bearer ${authToken}`);
  }
});

async function createTestTask(overrides = {}) {
  const body = {
    title: "Test Task",
    project_id: testProjectId,
    priority: "medium",
    ...overrides,
  };
  const res = await request(app)
    .post("/api/v1/tasks")
    .set("Authorization", `Bearer ${authToken}`)
    .send(body);
  if (res.status === 201) {
    createdTaskIds.push(res.body.id);
  }
  return res;
}

// -----------------------------------------------------------------------
// GET /api/v1/tasks
// -----------------------------------------------------------------------
describe("GET /api/v1/tasks", () => {
  it("returns 200 and a list of tasks", async () => {
    const res = await request(app)
      .get("/api/v1/tasks")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("filters by project_id", async () => {
    const res = await request(app)
      .get(`/api/v1/tasks?project_id=${testProjectId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("filters by status", async () => {
    const res = await request(app)
      .get("/api/v1/tasks?status=todo")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
  });

  it("returns 401 with no auth", async () => {
    const res = await request(app).get("/api/v1/tasks");
    expect(res.status).toBe(401);
  });
});

// -----------------------------------------------------------------------
// POST /api/v1/tasks
// -----------------------------------------------------------------------
describe("POST /api/v1/tasks", () => {
  it("creates a task and returns 201", async () => {
    const res = await createTestTask({ title: "New Test Task", priority: "high" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("title", "New Test Task");
    expect(res.body).toHaveProperty("priority", "high");
  });

  it("returns 400 when title is missing", async () => {
    const res = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ project_id: testProjectId, priority: "high" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("accepts optional fields: description, due_date, parent_task_id", async () => {
    const res = await createTestTask({
      title: "Full Fields Task",
      description: "Detailed",
      priority: "low",
      due_date: "2026-05-01",
    });

    expect(res.status).toBe(201);
    expect(res.body.description).toBe("Detailed");
  });
});

// -----------------------------------------------------------------------
// PUT /api/v1/tasks/:id
// -----------------------------------------------------------------------
describe("PUT /api/v1/tasks/:id", () => {
  it("updates task title and returns the updated task", async () => {
    const created = await createTestTask({ title: "Before Update" });
    const id = created.body.id;

    const res = await request(app)
      .put(`/api/v1/tasks/${id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "After Update" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("After Update");
  });

  it("updates task status to done", async () => {
    const created = await createTestTask({ title: "To Complete" });
    const id = created.body.id;

    const res = await request(app)
      .put(`/api/v1/tasks/${id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ status: "done" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("done");
  });

  it("returns 404 for nonexistent task", async () => {
    const res = await request(app)
      .put("/api/v1/tasks/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Ghost" });

    expect(res.status).toBe(404);
  });
});

// -----------------------------------------------------------------------
// DELETE /api/v1/tasks/:id
// -----------------------------------------------------------------------
describe("DELETE /api/v1/tasks/:id", () => {
  it("deletes a task and returns 204", async () => {
    const created = await createTestTask({ title: "To Delete" });
    const id = created.body.id;
    // Remove from cleanup
    const idx = createdTaskIds.indexOf(id);
    if (idx !== -1) createdTaskIds.splice(idx, 1);

    const res = await request(app)
      .delete(`/api/v1/tasks/${id}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(204);
  });

  it("returns 404 for nonexistent task", async () => {
    const res = await request(app)
      .delete("/api/v1/tasks/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});

// -----------------------------------------------------------------------
// POST /api/v1/tasks/:id/subtasks
// -----------------------------------------------------------------------
describe("POST /api/v1/tasks/:id/subtasks", () => {
  it("creates a subtask linked to the parent", async () => {
    const parent = await createTestTask({ title: "Parent Task" });
    const parentId = parent.body.id;

    const res = await request(app)
      .post(`/api/v1/tasks/${parentId}/subtasks`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Sub Task", priority: "low" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("parent_task_id", parentId);
    expect(res.body).toHaveProperty("title", "Sub Task");
    createdTaskIds.push(res.body.id);
  });

  it("returns 400 when title is missing", async () => {
    const parent = await createTestTask({ title: "Parent 2" });

    const res = await request(app)
      .post(`/api/v1/tasks/${parent.body.id}/subtasks`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 404 when parent task does not exist", async () => {
    const res = await request(app)
      .post("/api/v1/tasks/00000000-0000-0000-0000-000000000000/subtasks")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Orphan" });

    expect(res.status).toBe(404);
  });
});
