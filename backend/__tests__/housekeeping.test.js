/**
 * Housekeeping API Integration Tests
 *
 * Endpoint: GET /api/v1/housekeeping
 *
 * Tests the health report shape — overdue tasks, stale projects,
 * unset tasks, past events, upcoming deadlines.
 */

"use strict";

const request = require("supertest");
const { app } = require("../server");
const { getTestAuth } = require("./helpers");

let authToken;

beforeAll(async () => {
  const auth = await getTestAuth();
  authToken = auth.authToken;
});

describe("GET /api/v1/housekeeping", () => {
  it("returns 200 with the health report shape", async () => {
    const res = await request(app)
      .get("/api/v1/housekeeping")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);

    // Verify top-level shape
    expect(res.body).toHaveProperty("overdueTasks");
    expect(res.body).toHaveProperty("staleProjects");
    expect(res.body).toHaveProperty("unsetTasks");
    expect(res.body).toHaveProperty("pastEvents");
    expect(res.body).toHaveProperty("upcomingDeadlines");
    expect(res.body).toHaveProperty("summary");

    // All sections should be arrays
    expect(Array.isArray(res.body.overdueTasks)).toBe(true);
    expect(Array.isArray(res.body.staleProjects)).toBe(true);
    expect(Array.isArray(res.body.unsetTasks)).toBe(true);
    expect(Array.isArray(res.body.pastEvents)).toBe(true);
    expect(Array.isArray(res.body.upcomingDeadlines)).toBe(true);
  });

  it("summary contains numeric counts", async () => {
    const res = await request(app)
      .get("/api/v1/housekeeping")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const { summary } = res.body;
    expect(typeof summary.overdue).toBe("number");
    expect(typeof summary.stale).toBe("number");
    expect(typeof summary.unset).toBe("number");
    expect(typeof summary.pastEvents).toBe("number");
    expect(typeof summary.upcoming).toBe("number");
  });

  it("overdue task items have expected fields", async () => {
    const res = await request(app)
      .get("/api/v1/housekeeping")
      .set("Authorization", `Bearer ${authToken}`);

    if (res.body.overdueTasks.length > 0) {
      const item = res.body.overdueTasks[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("due_date");
    }
  });

  it("stale project items have expected fields", async () => {
    const res = await request(app)
      .get("/api/v1/housekeeping")
      .set("Authorization", `Bearer ${authToken}`);

    if (res.body.staleProjects.length > 0) {
      const item = res.body.staleProjects[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("last_activity");
    }
  });

  it("returns 401 with no auth", async () => {
    const res = await request(app).get("/api/v1/housekeeping");
    expect(res.status).toBe(401);
  });
});
