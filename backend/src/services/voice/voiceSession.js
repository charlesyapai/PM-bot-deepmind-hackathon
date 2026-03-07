/**
 * voiceSession.js
 *
 * Orchestrates a single real-time voice streaming session between a mobile
 * client WebSocket and the Deepgram streaming API. One VoiceSession instance
 * exists per connected client.
 *
 * Lifecycle:
 *   1. Client connects to WSS /voice/stream with a valid JWT
 *   2. VoiceSession is created, opens a DeepgramClient connection
 *   3. Client sends audio chunks as binary frames
 *   4. VoiceSession forwards processed audio to Deepgram
 *   5. Deepgram returns partial/final transcripts → sent back to client
 *   6. Final transcript → forwarded to the Logic-AI service for intent parsing
 *   7. Client sends a "stop" control message → stream flushed and session ends
 *
 * Message protocol (client → server):
 *   Binary frame          : raw audio chunk (PCM 16-bit, 16 kHz, mono)
 *   JSON { type: "start", meta: { sampleRate, channels, bitDepth } }
 *   JSON { type: "stop" }
 *
 * Message protocol (server → client):
 *   JSON { type: "partial",  transcript: "..." }
 *   JSON { type: "final",    transcript: "...", confidence: 0.98 }
 *   JSON { type: "action",   intent: { ... } }   — from Logic-AI service
 *   JSON { type: "error",    message: "..." }
 *   JSON { type: "status",   state: "connected"|"reconnecting"|"closed" }
 */

"use strict";

const EventEmitter = require("events");
const DeepgramClient = require("./deepgramClient");
const { processStreamingChunk, validateStreamingMeta } = require("./audioProcessor");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// If no audio arrives within this window, consider the session stale and close.
const SESSION_IDLE_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// VoiceSession
// ---------------------------------------------------------------------------

class VoiceSession extends EventEmitter {
  /**
   * @param {object} params
   * @param {import("ws").WebSocket} params.clientWs  - The mobile client's WS connection
   * @param {string}  params.userId                   - Authenticated user ID
   * @param {string}  params.apiKey                   - Deepgram API key
   * @param {Function} params.onFinalTranscript        - Callback: (transcript, userId) => void
   *                                                    Called when Deepgram emits a speech-final result
   */
  constructor({ clientWs, userId, apiKey, onFinalTranscript }) {
    super();

    this._clientWs = clientWs;
    this._userId = userId;
    this._onFinalTranscript = onFinalTranscript || (() => {});
    this._deepgram = new DeepgramClient(apiKey);
    this._started = false;
    this._closed = false;
    this._idleTimer = null;

    this._bindDeepgramEvents();
    this._bindClientEvents();
  }

  // -------------------------------------------------------------------------
  // Deepgram event wiring
  // -------------------------------------------------------------------------

  _bindDeepgramEvents() {
    const dg = this._deepgram;

    dg.on("connected", () => {
      this._send({ type: "status", state: "connected" });
      this._resetIdleTimer();
    });

    dg.on("reconnecting", ({ attempt, delayMs }) => {
      this._send({
        type: "status",
        state: "reconnecting",
        attempt,
        retryInMs: delayMs,
      });
    });

    dg.on("disconnected", ({ code, reason }) => {
      console.warn(
        `[VoiceSession][${this._userId}] Deepgram disconnected: code=${code} reason=${reason}`
      );
    });

    dg.on("transcript", (result) => {
      this._resetIdleTimer();

      if (result.isFinal && result.speechFinal) {
        // Final, utterance-complete transcript — forward to Logic-AI
        this._send({
          type: "final",
          transcript: result.transcript,
          confidence: result.confidence,
          words: result.words,
        });

        if (result.transcript.trim().length > 0) {
          this._onFinalTranscript(result.transcript, this._userId, this._send.bind(this));
        }
      } else if (!result.isFinal) {
        // Streaming partial — show live text on the client UI
        this._send({
          type: "partial",
          transcript: result.transcript,
        });
      }
    });

    dg.on("utteranceEnd", () => {
      // Deepgram signals that the user has stopped speaking — useful for
      // triggering UI state transitions even before a final result arrives.
      this._send({ type: "utteranceEnd" });
    });

    dg.on("speechStarted", () => {
      this._send({ type: "speechStarted" });
    });

    dg.on("error", (err) => {
      console.error(`[VoiceSession][${this._userId}] Deepgram error:`, err.message);
      this._send({ type: "error", message: "STT service error. Please try again." });
    });

    dg.on("fatal", () => {
      this._send({
        type: "error",
        message: "Could not connect to speech recognition service. Please check your connection.",
      });
      this.close();
    });

    dg.on("closed", () => {
      if (!this._closed) this.close();
    });
  }

  // -------------------------------------------------------------------------
  // Client WebSocket event wiring
  // -------------------------------------------------------------------------

  _bindClientEvents() {
    const ws = this._clientWs;

    ws.on("message", (data, isBinary) => {
      if (this._closed) return;

      if (isBinary) {
        // Raw audio chunk
        this._handleAudioChunk(data);
      } else {
        // JSON control message
        try {
          const msg = JSON.parse(data.toString());
          this._handleControlMessage(msg);
        } catch {
          this._send({ type: "error", message: "Invalid control message format." });
        }
      }
    });

    ws.on("close", () => {
      this.close();
    });

    ws.on("error", (err) => {
      console.error(`[VoiceSession][${this._userId}] Client WS error:`, err.message);
      this.close();
    });
  }

  // -------------------------------------------------------------------------
  // Control message handling
  // -------------------------------------------------------------------------

  _handleControlMessage(msg) {
    switch (msg.type) {
      case "start": {
        if (this._started) {
          this._send({ type: "error", message: "Session already started." });
          return;
        }
        const validation = validateStreamingMeta(msg.meta || {});
        if (!validation.valid) {
          this._send({
            type: "error",
            message: "Audio configuration rejected: " + validation.errors.join("; "),
          });
          return;
        }
        this._started = true;
        this._deepgram.connect();
        break;
      }

      case "stop": {
        this._deepgram.finishStream();
        // Give Deepgram 2s to flush its buffer before closing
        setTimeout(() => this.close(), 2000);
        break;
      }

      case "text_command": {
        // Text-based command input (fallback for Expo Go / no-mic scenarios).
        // Bypass Deepgram entirely — treat the text as a final transcript.
        const transcript = (msg.transcript || "").trim();
        if (!transcript) {
          this._send({ type: "error", message: "Empty text command." });
          return;
        }
        console.log(`[VoiceSession][${this._userId}] Text command: "${transcript}"`);
        this._send({ type: "final", transcript, confidence: 1.0 });
        this._onFinalTranscript(transcript, this._userId, this._send.bind(this));
        break;
      }

      default:
        this._send({ type: "error", message: `Unknown control message type: ${msg.type}` });
    }
  }

  // -------------------------------------------------------------------------
  // Audio chunk handling
  // -------------------------------------------------------------------------

  _handleAudioChunk(rawData) {
    if (!this._started) {
      // Auto-start if the client sends audio without an explicit "start" message
      this._started = true;
      this._deepgram.connect();
    }

    const frames = processStreamingChunk(Buffer.from(rawData));
    for (const frame of frames) {
      this._deepgram.sendAudio(frame);
    }
  }

  // -------------------------------------------------------------------------
  // Idle timer
  // -------------------------------------------------------------------------

  _resetIdleTimer() {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      console.warn(`[VoiceSession][${this._userId}] Session idle timeout. Closing.`);
      this._send({ type: "status", state: "closed", reason: "idle_timeout" });
      this.close();
    }, SESSION_IDLE_TIMEOUT_MS);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  _send(payload) {
    const ws = this._clientWs;
    if (ws && ws.readyState === 1 /* OPEN */) {
      try {
        ws.send(JSON.stringify(payload));
      } catch (err) {
        console.error(`[VoiceSession][${this._userId}] Failed to send to client:`, err.message);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Cleanly shut down the session — closes both Deepgram and client WS. */
  close() {
    if (this._closed) return;
    this._closed = true;

    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }

    this._deepgram.close();

    if (this._clientWs && this._clientWs.readyState <= 1 /* CONNECTING | OPEN */) {
      this._clientWs.close(1000, "Session ended");
    }

    this.emit("ended", { userId: this._userId });
    console.log(`[VoiceSession][${this._userId}] Session closed.`);
  }
}

module.exports = VoiceSession;
