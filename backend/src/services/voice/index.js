/**
 * Voice service barrel — re-exports the public interface of the voice pipeline.
 *
 * The two integration points for the rest of the application are:
 *
 *   1. voiceStreamRouter.attach(httpServer, opts)
 *      — Attaches the WebSocket streaming endpoint to the HTTP server.
 *        Must be called once during server startup (after the Express server
 *        has been bound to an http.Server instance).
 *
 *   2. voiceRestRouter
 *      — Express Router for REST fallback endpoints.
 *        Mount via: app.use('/api/v1/voice', voiceRestRouter);
 *
 *   3. MeetingTranscriber
 *      — Used by the meeting notes service to batch-transcribe recordings.
 */

"use strict";

const voiceStreamRouter = require("./voiceStreamRouter");
const voiceRestRouter = require("./voiceRestRouter");
const MeetingTranscriber = require("./meetingTranscriber");
const DeepgramClient = require("./deepgramClient");
const VoiceSession = require("./voiceSession");
const audioProcessor = require("./audioProcessor");

module.exports = {
  voiceStreamRouter,
  voiceRestRouter,
  MeetingTranscriber,
  DeepgramClient,
  VoiceSession,
  audioProcessor,
};
