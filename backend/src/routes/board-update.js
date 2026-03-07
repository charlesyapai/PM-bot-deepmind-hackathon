"use strict";

/*
 * Board Update Routes
 *
 * Endpoints:
 *   POST /api/v1/board-update          - Trigger full board update
 *   GET  /api/v1/board-update/history  - Past board update summaries
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const supabase = require("../lib/supabase");
const { runBoardUpdate } = require("../services/boardEngine/boardUpdateEngine");
const { executeIntent } = require("../services/logicAi/intentExecutor");

const router = express.Router();

function getUserId(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return jwt.decode(token)?.sub || null;
}

// POST /api/v1/board-update — trigger full board update
router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const trigger = req.body.trigger || "manual";
    const result = await runBoardUpdate(userId, trigger);

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/board-update/history — past board update summaries
router.get("/history", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const limit = parseInt(req.query.limit) || 10;

    const { data, error } = await supabase
      .from("board_updates")
      .select("id, trigger, summary, suggested_actions, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/board-update/apply — execute suggested actions from a board update
router.post("/apply", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { suggestedActions } = req.body;
    if (!Array.isArray(suggestedActions) || suggestedActions.length === 0) {
      return res.status(400).json({ error: "No suggested actions provided" });
    }

    // Track project title -> real UUID mapping so subsequent actions can reference
    // projects created earlier in the same batch
    const projectIdMap = {}; // { "Project Title" (lowercased) -> real UUID }

    // Execute create_project actions first, then everything else
    const sorted = [...suggestedActions].sort((a, b) => {
      if (a.type === "create_project" && b.type !== "create_project") return -1;
      if (a.type !== "create_project" && b.type === "create_project") return 1;
      return 0;
    });

    const results = [];
    for (const action of sorted) {
      // Resolve placeholder projectId using title match from earlier creates
      const args = { ...action.args };
      if (args.projectId && !/^[0-9a-f]{8}-/i.test(args.projectId)) {
        // Try to find a matching project from this batch by scanning the map
        const placeholder = args.projectId.toLowerCase();
        const match = Object.entries(projectIdMap).find(([title]) =>
          placeholder.includes(title) || title.includes(placeholder)
        );
        if (match) {
          args.projectId = match[1];
        } else {
          // No match — drop the invalid ID so the executor can fall back
          delete args.projectId;
        }
      }

      const result = await executeIntent(
        { name: "accept_suggestion", args: { type: action.type, args, label: action.label } },
        userId
      );

      // If we just created a project, record its title -> ID mapping
      // and tag source emails with the new project_id
      if (action.type === "create_project" && result.success && result.data?.id) {
        const title = (result.data.title || action.args?.title || "").toLowerCase();
        if (title) projectIdMap[title] = result.data.id;

        // Tag the source emails that triggered this project creation
        const sourceEmailIds = action.args?.sourceEmailIds;
        if (Array.isArray(sourceEmailIds) && sourceEmailIds.length > 0) {
          await supabase
            .from("imported_emails")
            .update({ project_id: result.data.id })
            .eq("user_id", userId)
            .in("id", sourceEmailIds);
        }
      }

      results.push({ label: action.label, ...result });
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return res.json({
      summary: `Applied ${succeeded} action${succeeded === 1 ? "" : "s"}${failed > 0 ? `, ${failed} failed` : ""}.`,
      results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
