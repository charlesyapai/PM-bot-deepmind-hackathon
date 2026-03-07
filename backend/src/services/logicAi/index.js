"use strict";

/**
 * backend/src/services/logicAi/index.js
 *
 * Barrel export for the Logic-AI service layer.
 *
 * Usage:
 *   const { parseIntent, summarizeMeeting } = require('./services/logicAi');
 */

const { parseIntent } = require("./geminiClient");
const { summarizeMeeting } = require("./meetingSummarizer");

module.exports = { parseIntent, summarizeMeeting };
