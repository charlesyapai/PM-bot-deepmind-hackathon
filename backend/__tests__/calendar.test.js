/**
 * Calendar Events API Integration Tests
 *
 * Endpoints: GET/POST/PUT/DELETE /api/v1/calendar
 */

"use strict";

const request = require("supertest");
const { app } = require("../server");
const { getTestAuth } = require("./helpers");

let authToken;
const createdEventIds = [];

beforeAll(async () => {
  const auth = await getTestAuth();
  authToken = auth.authToken;
});

afterAll(async () => {
  for (const id of createdEventIds) {
    await request(app)
      .delete(`/api/v1/calendar/${id}`)
      .set("Authorization", `Bearer ${authToken}`);
  }
});

async function createTestEvent(overrides = {}) {
  const body = {
    title: "Test Event",
    start_time: "2026-04-15T10:00:00Z",
    end_time: "2026-04-15T11:00:00Z",
    ...overrides,
  };
  const res = await request(app)
    .post("/api/v1/calendar")
    .set("Authorization", `Bearer ${authToken}`)
    .send(body);
  if (res.status === 201) {
    createdEventIds.push(res.body.id);
  }
  return res;
}

// -----------------------------------------------------------------------
// POST /api/v1/calendar
// -----------------------------------------------------------------------
describe("POST /api/v1/calendar", () => {
  it("creates a calendar event and returns 201", async () => {
    const res = await createTestEvent({ title: "Team Standup" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("title", "Team Standup");
    expect(res.body).toHaveProperty("start_time");
  });

  it("returns 400 when title is missing", async () => {
    const res = await request(app)
      .post("/api/v1/calendar")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ start_time: "2026-04-15T10:00:00Z" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when start_time is missing", async () => {
    const res = await request(app)
      .post("/api/v1/calendar")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "No Start Time" });

    expect(res.status).toBe(400);
  });

  it("creates an all-day event", async () => {
    const res = await createTestEvent({
      title: "All Day Workshop",
      all_day: true,
      start_time: "2026-04-20T00:00:00Z",
      end_time: null,
    });

    expect(res.status).toBe(201);
    expect(res.body.all_day).toBe(true);
  });

  it("returns 401 with no auth", async () => {
    const res = await request(app)
      .post("/api/v1/calendar")
      .send({ title: "Unauth", start_time: "2026-04-15T10:00:00Z" });

    expect(res.status).toBe(401);
  });
});

// -----------------------------------------------------------------------
// GET /api/v1/calendar
// -----------------------------------------------------------------------
describe("GET /api/v1/calendar", () => {
  it("returns 200 and an array of events", async () => {
    const res = await request(app)
      .get("/api/v1/calendar")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("filters by date range (from/to)", async () => {
    const res = await request(app)
      .get("/api/v1/calendar?from=2026-04-01T00:00:00Z&to=2026-04-30T23:59:59Z")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns 401 with no auth", async () => {
    const res = await request(app).get("/api/v1/calendar");
    expect(res.status).toBe(401);
  });
});

// -----------------------------------------------------------------------
// GET /api/v1/calendar/:id
// -----------------------------------------------------------------------
describe("GET /api/v1/calendar/:id", () => {
  it("returns a single event by id", async () => {
    const created = await createTestEvent({ title: "Single Fetch" });
    const id = created.body.id;

    const res = await request(app)
      .get(`/api/v1/calendar/${id}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", id);
    expect(res.body).toHaveProperty("title", "Single Fetch");
  });

  it("returns 404 for nonexistent event", async () => {
    const res = await request(app)
      .get("/api/v1/calendar/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});

// -----------------------------------------------------------------------
// PUT /api/v1/calendar/:id
// -----------------------------------------------------------------------
describe("PUT /api/v1/calendar/:id", () => {
  it("updates event title", async () => {
    const created = await createTestEvent({ title: "Before Update" });
    const id = created.body.id;

    const res = await request(app)
      .put(`/api/v1/calendar/${id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "After Update" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("After Update");
  });

  it("updates event status to cancelled", async () => {
    const created = await createTestEvent({ title: "To Cancel" });
    const id = created.body.id;

    const res = await request(app)
      .put(`/api/v1/calendar/${id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ status: "cancelled" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });

  it("returns 404 for nonexistent event", async () => {
    const res = await request(app)
      .put("/api/v1/calendar/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Ghost" });

    expect(res.status).toBe(404);
  });
});

// -----------------------------------------------------------------------
// DELETE /api/v1/calendar/:id
// -----------------------------------------------------------------------
describe("DELETE /api/v1/calendar/:id", () => {
  it("deletes event and returns 204", async () => {
    const created = await createTestEvent({ title: "To Delete" });
    const id = created.body.id;
    // Remove from cleanup since we're deleting here
    const idx = createdEventIds.indexOf(id);
    if (idx !== -1) createdEventIds.splice(idx, 1);

    const res = await request(app)
      .delete(`/api/v1/calendar/${id}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(204);

    // Verify it's gone
    const check = await request(app)
      .get(`/api/v1/calendar/${id}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(check.status).toBe(404);
  });

  it("returns 404 for nonexistent event", async () => {
    const res = await request(app)
      .delete("/api/v1/calendar/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});
