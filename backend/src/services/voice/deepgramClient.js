/**
 * deepgramClient.js
 *
 * Manages a persistent WebSocket connection to the Deepgram streaming STT API.
 * One DeepgramClient instance is created per voice session (one per connected
 * mobile client). It:
 *   - Opens a WebSocket to Deepgram with the correct query parameters
 *   - Forwards raw audio chunks from the mobile client to Deepgram
 *   - Emits 'transcript' events (partial + final) back to the caller
 *   - Handles reconnection with exponential back-off on unexpected disconnects
 *   - Gracefully closes when the session ends
 */

"use strict";

const WebSocket = require("ws");
const EventEmitter = require("events");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEEPGRAM_WSS_URL = "wss://api.deepgram.com/v1/listen";

// Deepgram streaming parameters — tuned for mobile voice commands.
// PCM/WAV 16-bit, 16 kHz mono is captured by expo-av on the mobile client.
const DEEPGRAM_QUERY_PARAMS = {
  model: "nova-2",            // Best accuracy/latency balance
  language: "en-US",
  encoding: "linear16",       // 16-bit PCM (raw audio, no header)
  sample_rate: 16000,
  channels: 1,
  punctuate: true,
  smart_format: true,
  interim_results: true,      // Enables partial (live) transcripts
  endpointing: 300,           // ms of silence to trigger utterance end
  vad_events: true,           // Voice activity detection events
  utterance_end_ms: 1000,     // Emit UtteranceEnd after 1s of silence
};

// Reconnection config
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 500;  // doubles each attempt (500, 1000, 2000…)

// ---------------------------------------------------------------------------
// DeepgramClient
// ---------------------------------------------------------------------------

class DeepgramClient extends EventEmitter {
  /**
   * @param {string} apiKey  - Deepgram API key (from env)
   * @param {object} [opts]  - Optional overrides for Deepgram query params
   */
  constructor(apiKey, opts = {}) {
    super();

    if (!apiKey) {
      throw new Error("DeepgramClient: DEEPGRAM_API_KEY is required");
    }

    this._apiKey = apiKey;
    this._queryParams = { ...DEEPGRAM_QUERY_PARAMS, ...opts };
    this._ws = null;
    this._reconnectAttempts = 0;
    this._closed = false;       // True once the caller explicitly calls close()
    this._audioQueue = [];      // Buffer audio chunks arriving before WS is open
    this._connecting = false;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Open the connection to Deepgram. Call once per session. */
  connect() {
    if (this._closed) {
      throw new Error("DeepgramClient: cannot reuse a closed client");
    }
    this._openWebSocket();
  }

  /**
   * Send a raw audio chunk to Deepgram.
   * @param {Buffer|Uint8Array} chunk  - Raw PCM audio bytes
   */
  sendAudio(chunk) {
    if (this._closed) return;

    if (!Buffer.isBuffer(chunk)) {
      chunk = Buffer.from(chunk);
    }

    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(chunk);
    } else {
      // Queue until connection is ready
      this._audioQueue.push(chunk);
    }
  }

  /**
   * Signal to Deepgram that the audio stream has ended.
   * Deepgram will flush its buffer and send a final transcript.
   */
  finishStream() {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      // Deepgram expects a zero-byte message to signal end of stream
      this._ws.send(Buffer.alloc(0));
    }
  }

  /**
   * Permanently close this client. No reconnection will be attempted.
   */
  close() {
    this._closed = true;
    this._audioQueue = [];
    if (this._ws) {
      this._ws.terminate();
      this._ws = null;
    }
    this.emit("closed");
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  _buildUrl() {
    const params = new URLSearchParams(this._queryParams);
    return `${DEEPGRAM_WSS_URL}?${params.toString()}`;
  }

  _openWebSocket() {
    if (this._connecting || this._closed) return;
    this._connecting = true;

    const url = this._buildUrl();

    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Token ${this._apiKey}`,
      },
    });

    ws.on("open", () => {
      this._connecting = false;
      this._reconnectAttempts = 0;
      this._ws = ws;
      this.emit("connected");

      // Flush any audio that arrived while we were connecting
      if (this._audioQueue.length > 0) {
        for (const chunk of this._audioQueue) {
          ws.send(chunk);
        }
        this._audioQueue = [];
      }
    });

    ws.on("message", (data) => {
      this._handleDeepgramMessage(data);
    });

    ws.on("error", (err) => {
      this.emit("error", err);
    });

    ws.on("close", (code, reason) => {
      this._connecting = false;
      this._ws = null;

      if (this._closed) {
        // Intentional close — do nothing
        return;
      }

      this.emit("disconnected", { code, reason: reason.toString() });
      this._scheduleReconnect();
    });
  }

  _scheduleReconnect() {
    if (this._closed) return;

    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      const err = new Error(
        `DeepgramClient: max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached`
      );
      this.emit("error", err);
      this.emit("fatal", err);
      return;
    }

    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, this._reconnectAttempts);
    this._reconnectAttempts++;

    this.emit("reconnecting", {
      attempt: this._reconnectAttempts,
      delayMs: delay,
    });

    setTimeout(() => {
      if (!this._closed) {
        this._openWebSocket();
      }
    }, delay);
  }

  _handleDeepgramMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      // Non-JSON frame — ignore
      return;
    }

    const type = msg.type;

    if (type === "Results") {
      const channel = msg.channel;
      const alternatives = channel && channel.alternatives;
      if (!alternatives || alternatives.length === 0) return;

      const transcript = alternatives[0].transcript || "";
      const isFinal = msg.is_final === true;
      const speechFinal = msg.speech_final === true;
      const confidence = alternatives[0].confidence || 0;

      this.emit("transcript", {
        transcript,
        isFinal,
        speechFinal,
        confidence,
        words: alternatives[0].words || [],
        raw: msg,
      });

    } else if (type === "UtteranceEnd") {
      this.emit("utteranceEnd", { raw: msg });

    } else if (type === "SpeechStarted") {
      this.emit("speechStarted", { raw: msg });

    } else if (type === "Metadata") {
      this.emit("metadata", { raw: msg });

    } else if (type === "Error") {
      this.emit("error", new Error(`Deepgram error: ${msg.message || JSON.stringify(msg)}`));
    }
  }
}

module.exports = DeepgramClient;
