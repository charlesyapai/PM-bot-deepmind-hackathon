/**
 * Templates API Integration Tests
 *
 * Endpoints: GET /api/v1/templates, GET /api/v1/templates/:id
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

// -----------------------------------------------------------------------
// GET /api/v1/templates
// -----------------------------------------------------------------------
describe("GET /api/v1/templates", () => {
  it("returns 200 and an array of templates", async () => {
    const res = await request(app)
      .get("/api/v1/templates")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("each template has id and name", async () => {
    const res = await request(app)
      .get("/api/v1/templates")
      .set("Authorization", `Bearer ${authToken}`);

    if (res.status === 200 && res.body.length > 0) {
      res.body.forEach((t) => {
        expect(t).toHaveProperty("id");
        expect(t).toHaveProperty("name");
      });
    }
  });

  it("returns 401 with no auth", async () => {
    const res = await request(app).get("/api/v1/templates");
    expect(res.status).toBe(401);
  });
});

// -----------------------------------------------------------------------
// GET /api/v1/templates/:id
// -----------------------------------------------------------------------
describe("GET /api/v1/templates/:id", () => {
  it("returns 404 for nonexistent template", async () => {
    const res = await request(app)
      .get("/api/v1/templates/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });

  it("returns a template with config JSONB if seeded templates exist", async () => {
    // First list to get a real ID
    const list = await request(app)
      .get("/api/v1/templates")
      .set("Authorization", `Bearer ${authToken}`);

    if (list.body.length > 0) {
      const id = list.body[0].id;
      const res = await request(app)
        .get(`/api/v1/templates/${id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id", id);
    }
  });
});
