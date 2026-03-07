/**
 * Projects API Integration Tests
 *
 * Endpoints tested:
 *   GET    /api/v1/projects
 *   POST   /api/v1/projects
 *   GET    /api/v1/projects/:id
 *   PUT    /api/v1/projects/:id
 *   DELETE /api/v1/projects/:id        (soft archive)
 *   DELETE /api/v1/projects/:id?hard=true (hard delete, cascades tasks)
 *   POST   /api/v1/projects/:id/restore
 */

"use strict";

const request = require("supertest");
const { app } = require("../server");
const { getTestAuth, makeBadToken } = require("./helpers");

let authToken;
let userId;

// IDs created during the test run — cleaned up in afterAll
const createdProjectIds = [];

beforeAll(async () => {
  const auth = await getTestAuth();
  authToken = auth.authToken;
  userId = auth.userId;
});

afterAll(async () => {
  // Hard-delete any projects we created during this run
  for (const id of createdProjectIds) {
    await request(app)
      .delete(`/api/v1/projects/${id}?hard=true`)
      .set("Authorization", `Bearer ${authToken}`);
  }
});

// --- Helper to create a project and track it for cleanup ---
async function createTestProject(title = "Test Project") {
  const res = await request(app)
    .post("/api/v1/projects")
    .set("Authorization", `Bearer ${authToken}`)
    .send({ title, description: "Created by test suite" });
  if (res.status === 201) {
    createdProjectIds.push(res.body.id);
  }
  return res;
}

// -----------------------------------------------------------------------
// GET /api/v1/projects
// -----------------------------------------------------------------------
describe("GET /api/v1/projects", () => {
  it("returns 200 and a list of projects", async () => {
    const res = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("filters by status=active", async () => {
    const res = await request(app)
      .get("/api/v1/projects?status=active")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("filters by status=archived", async () => {
    const res = await request(app)
      .get("/api/v1/projects?status=archived")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("supports updated_after sync param", async () => {
    const res = await request(app)
      .get("/api/v1/projects?updated_after=2026-01-01T00:00:00Z")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
  });

  it("returns 401 with no auth token", async () => {
    const res = await request(app).get("/api/v1/projects");
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid token (no sub)", async () => {
    const res = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${makeBadToken()}`);

    expect(res.status).toBe(401);
  });
});

// -----------------------------------------------------------------------
// POST /api/v1/projects
// -----------------------------------------------------------------------
describe("POST /api/v1/projects", () => {
  it("creates a project and returns 201", async () => {
    const res = await createTestProject("POST Test Project");

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("title", "POST Test Project");
    expect(res.body).toHaveProperty("status", "active");
  });

  it("returns 400 when title is missing", async () => {
    const res = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ description: "Missing title" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when body is empty", async () => {
    const res = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// -----------------------------------------------------------------------
// GET /api/v1/projects/:id
// -----------------------------------------------------------------------
describe("GET /api/v1/projects/:id", () => {
  it("returns 200 for a valid project", async () => {
    const created = await createTestProject("GET By ID Test");
    const id = created.body.id;

    const res = await request(app)
      .get(`/api/v1/projects/${id}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", id);
    expect(res.body).toHaveProperty("title", "GET By ID Test");
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app)
      .get("/api/v1/projects/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});

// -----------------------------------------------------------------------
// PUT /api/v1/projects/:id
// -----------------------------------------------------------------------
describe("PUT /api/v1/projects/:id", () => {
  it("updates title and returns the updated project", async () => {
    const created = await createTestProject("Before Update");
    const id = created.body.id;

    const res = await request(app)
      .put(`/api/v1/projects/${id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "After Update" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("title", "After Update");
  });

  it("returns 404 for nonexistent project", async () => {
    const res = await request(app)
      .put("/api/v1/projects/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Ghost" });

    expect(res.status).toBe(404);
  });
});

// -----------------------------------------------------------------------
// DELETE /api/v1/projects/:id  (soft archive)
// -----------------------------------------------------------------------
describe("DELETE /api/v1/projects/:id (archive)", () => {
  it("soft-deletes (archives) the project and returns 204", async () => {
    const created = await createTestProject("To Archive");
    const id = created.body.id;

    const res = await request(app)
      .delete(`/api/v1/projects/${id}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(204);

    // Verify it's now archived
    const check = await request(app)
      .get(`/api/v1/projects/${id}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(check.body.status).toBe("archived");
  });

  it("returns 404 for nonexistent project", async () => {
    const res = await request(app)
      .delete("/api/v1/projects/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});

// -----------------------------------------------------------------------
// DELETE /api/v1/projects/:id?hard=true  (hard delete)
// -----------------------------------------------------------------------
describe("DELETE /api/v1/projects/:id?hard=true", () => {
  it("permanently deletes the project and returns 204", async () => {
    const created = await createTestProject("To Hard Delete");
    const id = created.body.id;
    // Remove from cleanup list since we're deleting it here
    const idx = createdProjectIds.indexOf(id);
    if (idx !== -1) createdProjectIds.splice(idx, 1);

    const res = await request(app)
      .delete(`/api/v1/projects/${id}?hard=true`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(204);

    // Verify it's gone
    const check = await request(app)
      .get(`/api/v1/projects/${id}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(check.status).toBe(404);
  });
});

// -----------------------------------------------------------------------
// POST /api/v1/projects/:id/restore
// -----------------------------------------------------------------------
describe("POST /api/v1/projects/:id/restore", () => {
  it("restores an archived project to active", async () => {
    const created = await createTestProject("To Restore");
    const id = created.body.id;

    // Archive it first
    await request(app)
      .delete(`/api/v1/projects/${id}`)
      .set("Authorization", `Bearer ${authToken}`);

    // Restore it
    const res = await request(app)
      .post(`/api/v1/projects/${id}/restore`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "active");
  });

  it("returns 404 for nonexistent project", async () => {
    const res = await request(app)
      .post("/api/v1/projects/00000000-0000-0000-0000-000000000000/restore")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});
