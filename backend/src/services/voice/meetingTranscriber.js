/**
 * meetingTranscriber.js
 *
 * Handles batch transcription of meeting recordings using Deepgram's
 * pre-recorded (non-streaming) API. Used for the meeting notes pipeline
 * where audio is up to 120 minutes long.
 *
 * Flow:
 *   1. Receive a Supabase Storage URL for the uploaded audio file
 *   2. POST to Deepgram pre-recorded API with the audio URL (Deepgram fetches
 *      it directly — avoids re-uploading through our server)
 *   3. Poll / await the transcript result
 *   4. Return the full transcript text + per-word timestamps + speaker labels
 *   5. Caller (meeting notes service) passes the transcript to Logic-AI for
 *      summarization and action item extraction
 *
 * Deepgram pre-recorded API endpoint:
 *   POST https://api.deepgram.com/v1/listen
 *   Body: { "url": "https://..." }
 *   Query params: model, punctuate, diarize, smart_format, etc.
 */

"use strict";

const https = require("https");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEEPGRAM_LISTEN_URL = "https://api.deepgram.com/v1/listen";

// Pre-recorded API parameters
// Diarization is enabled here (not in streaming) because meeting recordings
// often have multiple speakers — diarize=true produces speaker labels.
const BATCH_QUERY_PARAMS = {
  model: "nova-2",
  language: "en-US",
  punctuate: true,
  smart_format: true,
  diarize: true,           // Speaker labels (Speaker 0, Speaker 1…)
  paragraphs: true,        // Group words into paragraphs for readability
  summarize: false,        // We use GPT-4o for summarization — not Deepgram's
  utterances: true,        // Include utterance-level timestamps
};

// Maximum wait time for a Deepgram batch job (10 minutes)
const BATCH_TIMEOUT_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// MeetingTranscriber
// ---------------------------------------------------------------------------

class MeetingTranscriber {
  /**
   * @param {string} apiKey  - Deepgram API key
   */
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error("MeetingTranscriber: DEEPGRAM_API_KEY is required");
    }
    this._apiKey = apiKey;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Transcribe a meeting recording from a URL (e.g. Supabase Storage signed URL).
   *
   * @param {object} params
   * @param {string} params.audioUrl        - Publicly accessible audio URL
   * @param {string} [params.meetingNoteId] - For logging/tracking
   * @returns {Promise<TranscriptResult>}
   */
  async transcribe({ audioUrl, meetingNoteId }) {
    if (!audioUrl) {
      throw new Error("MeetingTranscriber.transcribe: audioUrl is required");
    }

    const logPrefix = `[MeetingTranscriber]${meetingNoteId ? `[${meetingNoteId}]` : ""}`;
    console.log(`${logPrefix} Starting batch transcription for: ${audioUrl}`);

    const url = this._buildUrl();
    const body = JSON.stringify({ url: audioUrl });

    const rawResponse = await this._postWithTimeout(url, body, BATCH_TIMEOUT_MS);
    const result = this._parseResponse(rawResponse);

    console.log(
      `${logPrefix} Transcription complete. ` +
      `Duration: ${result.durationSeconds}s, Words: ${result.wordCount}`
    );

    return result;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  _buildUrl() {
    const params = new URLSearchParams(BATCH_QUERY_PARAMS);
    return `${DEEPGRAM_LISTEN_URL}?${params.toString()}`;
  }

  /**
   * POST to Deepgram and return the raw JSON response.
   * Uses the built-in `https` module to avoid adding an http client dependency.
   */
  _postWithTimeout(url, body, timeoutMs) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);

      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          Authorization: `Token ${this._apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      };

      let responseData = "";

      const req = https.request(options, (res) => {
        res.setEncoding("utf8");
        res.on("data", (chunk) => { responseData += chunk; });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              new Error(
                `Deepgram pre-recorded API returned HTTP ${res.statusCode}: ${responseData}`
              )
            );
          }
          try {
            resolve(JSON.parse(responseData));
          } catch {
            reject(new Error("Deepgram pre-recorded API returned invalid JSON"));
          }
        });
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Deepgram pre-recorded API timed out after ${timeoutMs / 1000}s`));
      });

      req.on("error", (err) => {
        reject(new Error(`Deepgram pre-recorded API request failed: ${err.message}`));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Parse Deepgram's pre-recorded response into our internal TranscriptResult.
   *
   * @param {object} raw  - Raw Deepgram API response
   * @returns {TranscriptResult}
   */
  _parseResponse(raw) {
    const results = raw.results;
    if (!results) {
      throw new Error("Deepgram response missing 'results' field");
    }

    const channels = results.channels || [];
    if (channels.length === 0) {
      throw new Error("Deepgram response has no channel data");
    }

    const channel = channels[0];
    const alternatives = channel.alternatives || [];
    if (alternatives.length === 0) {
      throw new Error("Deepgram response has no transcript alternatives");
    }

    const alt = alternatives[0];

    // Build a formatted transcript with speaker labels (if diarization ran)
    const paragraphs = results.utterances || [];
    let formattedTranscript = "";

    if (paragraphs.length > 0) {
      // Group utterances by speaker
      let currentSpeaker = null;
      const lines = [];
      for (const utterance of paragraphs) {
        const speaker = utterance.speaker !== undefined
          ? `Speaker ${utterance.speaker}`
          : "Speaker";
        if (speaker !== currentSpeaker) {
          currentSpeaker = speaker;
          lines.push(`\n[${speaker}]`);
        }
        lines.push(utterance.transcript.trim());
      }
      formattedTranscript = lines.join("\n").trim();
    } else {
      formattedTranscript = alt.transcript || "";
    }

    const durationSeconds = raw.metadata && raw.metadata.duration
      ? Math.round(raw.metadata.duration)
      : null;

    const words = alt.words || [];

    return {
      /** Full plain-text transcript (no speaker labels) */
      rawTranscript: alt.transcript || "",
      /** Transcript formatted with [Speaker N] labels */
      formattedTranscript,
      /** Total duration in seconds */
      durationSeconds,
      /** Word count */
      wordCount: words.length,
      /** Per-word detail: { word, start, end, confidence, speaker } */
      words,
      /** Utterances with timestamps and speaker attribution */
      utterances: paragraphs,
      /** Overall confidence score (0–1) */
      confidence: alt.confidence || 0,
    };
  }
}

/**
 * @typedef {object} TranscriptResult
 * @property {string}   rawTranscript       - Plain text transcript
 * @property {string}   formattedTranscript - Transcript with [Speaker N] labels
 * @property {number|null} durationSeconds  - Audio duration in seconds
 * @property {number}   wordCount           - Total word count
 * @property {object[]} words               - Per-word timing and speaker data
 * @property {object[]} utterances          - Utterance-level segments
 * @property {number}   confidence          - Overall confidence (0–1)
 */

module.exports = MeetingTranscriber;
