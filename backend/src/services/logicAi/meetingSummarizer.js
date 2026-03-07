"use strict";

/**
 * meetingSummarizer.js
 *
 * Gemini 2.0 Flash wrapper for the meeting note summarization pipeline.
 *
 * Responsibilities:
 *   - Accept a full meeting transcript (string) from the batch STT pipeline
 *   - Call Gemini with a summarization-focused system prompt
 *   - Extract a structured summary and action items via function calling
 *   - Return { summary, action_items } for persistence in the meeting_notes table
 *
 * This module is intentionally separate from geminiClient.js because it uses
 * a different system instruction and function schema — the two pipelines have
 * different goals and latency characteristics (real-time intent vs. batch
 * summarization).
 *
 * Duration cap: transcripts are accepted up to 120 minutes (enforced upstream
 * by the Voice pipeline). The Gemini 2.0 Flash 1M-token context window can
 * handle far longer transcripts if the cap is ever raised.
 *
 * Environment variables required:
 *   GEMINI_API_KEY  — Google AI Studio / Vertex AI API key
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ---------------------------------------------------------------------------
// SDK initialisation
// ---------------------------------------------------------------------------

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------------------------------------------------------------------
// System instruction
// ---------------------------------------------------------------------------

const MEETING_SYSTEM_INSTRUCTION = `
You are an expert meeting summarizer for PersonalBot. Your job is to process a raw meeting
transcript and extract two things:

1. summary: A concise 2-3 paragraph summary of the key discussion points, decisions made,
   and overall outcomes of the meeting. Write in clear, professional language. Do not use
   bullet points — use flowing prose paragraphs.

2. action_items: A list of clear, specific, actionable tasks that were either explicitly
   assigned or strongly implied during the meeting. Each item should be a single sentence
   starting with a verb (e.g. "Send the updated proposal to the client by Friday.").
   Only include high-confidence action items — omit vague or speculative tasks.

RULES:
- Only call the extract_meeting_data function — never return plain text.
- Do not invent or extrapolate action items not supported by the transcript.
- If the transcript is too unclear or too short to summarize meaningfully, still call
  extract_meeting_data but set summary to a brief note about the quality issue and
  action_items to an empty array.
`.trim();

// ---------------------------------------------------------------------------
// Function declarations
// ---------------------------------------------------------------------------

const meetingFunctionDeclarations = [
  {
    name: "extract_meeting_data",
    description:
      "Extract a structured summary and list of action items from a meeting transcript.",
    parameters: {
      type: "OBJECT",
      properties: {
        summary: {
          type: "STRING",
          description:
            "2-3 paragraph concise prose summary of what was discussed, decided, and achieved.",
        },
        action_items: {
          type: "ARRAY",
          items: { type: "STRING" },
          description:
            "List of clear, actionable tasks extracted from the meeting. Each item is a single sentence starting with a verb.",
        },
      },
      required: ["summary", "action_items"],
    },
  },
];

// ---------------------------------------------------------------------------
// Model initialisation
// ---------------------------------------------------------------------------

const meetingModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  systemInstruction: MEETING_SYSTEM_INSTRUCTION,
  tools: [{ functionDeclarations: meetingFunctionDeclarations }],
  generationConfig: { temperature: 0.2 },  // Slightly higher than intent parser — summaries allow more fluency
});

// ---------------------------------------------------------------------------
// summarizeMeeting
// ---------------------------------------------------------------------------

/**
 * Summarize a meeting transcript and extract action items.
 *
 * @param {string} transcript - Full raw transcript text from the STT pipeline.
 * @param {object} [meta]     - Optional metadata for context.
 * @param {string} [meta.projectName] - Name of the associated project (helps grounding).
 * @param {number} [meta.durationSeconds] - Recording duration in seconds.
 *
 * @returns {Promise<{ summary: string, action_items: string[] }>}
 *   Always resolves. Falls back to empty/error values on failure.
 */
async function summarizeMeeting(transcript, meta = {}) {
  const metaBlock = Object.keys(meta).length
    ? `Meeting metadata: ${JSON.stringify(meta)}\n\n`
    : "";

  const prompt = `
${metaBlock}Full meeting transcript:
---
${transcript}
---

Please extract the summary and action items using the extract_meeting_data function.
`.trim();

  try {
    const result = await meetingModel.generateContent(prompt);
    const response = result.response;
    const calls = response.functionCalls();

    if (calls && calls.length > 0) {
      const { args } = calls[0];
      return {
        summary: args.summary || "",
        action_items: Array.isArray(args.action_items) ? args.action_items : [],
      };
    }

    // Model did not return a function call
    console.warn("[meetingSummarizer] No function call returned for transcript of length:", transcript.length);
    return {
      summary: "Summarization failed — the model did not return structured output.",
      action_items: [],
    };
  } catch (err) {
    console.error("[meetingSummarizer] Error calling Gemini API:", err.message);
    return {
      summary: "Summarization failed due to an API error. Please retry.",
      action_items: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { summarizeMeeting };
