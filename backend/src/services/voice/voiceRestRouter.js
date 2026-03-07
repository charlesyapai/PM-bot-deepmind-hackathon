/**
 * voiceRestRouter.js
 *
 * Express router for the REST voice endpoints:
 *
 *   POST /voice/transcribe   — Batch transcription of an uploaded audio file
 *                              (triggers Deepgram pre-recorded API via MeetingTranscriber)
 *   POST /voice/command      — Accept a plain-text command (bypass STT). Useful
 *                              for testing, accessibility, and offline text fallback.
 *
 * Both endpoints are authenticated via the standard JWT middleware.
 *
 * Integration point for meeting notes:
 *   The /voice/transcribe endpoint is called by the meeting notes pipeline
 *   after audio has been uploaded to Supabase Storage. It takes the storage
 *   URL, kicks off Deepgram batch transcription, and returns the full
 *   transcript. The caller is then responsible for triggering AI summarization
 *   (POST /meeting-notes/:id/summarize).
 */

"use strict";

const express = require("express");
const MeetingTranscriber = require("./meetingTranscriber");
const { validateBatchAudio } = require("./audioProcessor");
const { requireAuth } = require("../../middleware/auth");

const router = express.Router();

// Lazily initialise the transcriber so we don't crash at import time if the
// env var is missing in development contexts that don't use voice.
let _transcriber = null;
function getTranscriber() {
  if (!_transcriber) {
    _transcriber = new MeetingTranscriber(process.env.DEEPGRAM_API_KEY);
  }
  return _transcriber;
}

// ---------------------------------------------------------------------------
// POST /voice/transcribe
// ---------------------------------------------------------------------------

/**
 * Trigger batch transcription of a meeting recording.
 *
 * Request body:
 * {
 *   "audioUrl":       "https://...",   // Supabase Storage signed URL (required)
 *   "meetingNoteId":  "uuid",          // For tracking (optional)
 *   "fileSizeBytes":  52428800,        // For validation (optional)
 *   "durationSecs":   3600             // Declared duration for validation (optional)
 * }
 *
 * Response 200:
 * {
 *   "rawTranscript":       "Full meeting transcript...",
 *   "formattedTranscript": "[Speaker 0]\nHello...\n[Speaker 1]\nHi...",
 *   "durationSeconds":     3600,
 *   "wordCount":           8942,
 *   "confidence":          0.97
 * }
 *
 * Response 400: Validation error
 * Response 500: Transcription failure
 */
router.post("/transcribe", requireAuth, async (req, res) => {
  const { audioUrl, meetingNoteId, fileSizeBytes, durationSecs } = req.body;

  // --- Input validation ---
  if (!audioUrl || typeof audioUrl !== "string") {
    return res.status(400).json({
      error: {
        code: "MISSING_AUDIO_URL",
        message: "audioUrl is required and must be a string.",
        details: {},
      },
    });
  }

  // Validate file size / duration limits if the client provides them
  if (fileSizeBytes || durationSecs) {
    const validation = validateBatchAudio({
      fileSizeBytes: fileSizeBytes || 0,
      durationSecs: durationSecs || 0,
    });
    if (!validation.valid) {
      return res.status(400).json({
        error: {
          code: "AUDIO_VALIDATION_FAILED",
          message: "Audio file rejected: " + validation.errors.join("; "),
          details: { errors: validation.errors },
        },
      });
    }
  }

  // --- Transcription ---
  try {
    const transcriber = getTranscriber();
    const result = await transcriber.transcribe({ audioUrl, meetingNoteId });

    return res.status(200).json({
      rawTranscript: result.rawTranscript,
      formattedTranscript: result.formattedTranscript,
      durationSeconds: result.durationSeconds,
      wordCount: result.wordCount,
      confidence: result.confidence,
    });
  } catch (err) {
    console.error("[voiceRestRouter] Transcription error:", err.message);
    return res.status(500).json({
      error: {
        code: "TRANSCRIPTION_FAILED",
        message: "Failed to transcribe audio. Please try again.",
        details: { reason: err.message },
      },
    });
  }
});

// ---------------------------------------------------------------------------
// POST /voice/command
// ---------------------------------------------------------------------------

/**
 * Accept a plain-text voice command, bypassing STT entirely.
 * Useful for:
 *   - Integration tests (no audio needed)
 *   - Accessibility / text-mode fallback
 *   - Manual command entry when voice isn't available
 *
 * Request body:
 * {
 *   "transcript": "Create a task called write unit tests with high priority",
 *   "context":    { "activeProjectId": "uuid", "activeView": "kanban" }  // optional
 * }
 *
 * Response 200:
 * {
 *   "received": true,
 *   "transcript": "...",
 *   "status": "queued_for_intent_parsing"
 * }
 *
 * Note: Intent parsing is async — the Logic-AI service processes the
 * transcript and delivers the result via the client's WebSocket channel.
 */
router.post("/command", requireAuth, async (req, res) => {
  const { transcript, context } = req.body;
  const userId = req.user.id;

  if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
    return res.status(400).json({
      error: {
        code: "MISSING_TRANSCRIPT",
        message: "transcript is required and must be a non-empty string.",
        details: {},
      },
    });
  }

  if (transcript.length > 2000) {
    return res.status(400).json({
      error: {
        code: "TRANSCRIPT_TOO_LONG",
        message: "transcript must be 2000 characters or fewer.",
        details: { maxLength: 2000, receivedLength: transcript.length },
      },
    });
  }

  // TODO: Forward transcript + context to the Logic-AI intent parsing service.
  // logicAiService.parseIntent({ transcript: transcript.trim(), userId, context });
  console.log(
    `[voiceRestRouter] Text command from user ${userId}: "${transcript.trim().substring(0, 80)}..."`
  );

  return res.status(200).json({
    received: true,
    transcript: transcript.trim(),
    status: "queued_for_intent_parsing",
  });
});

module.exports = router;
