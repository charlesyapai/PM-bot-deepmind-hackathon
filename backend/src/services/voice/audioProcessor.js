/**
 * audioProcessor.js
 *
 * Handles audio format validation and preprocessing before audio is forwarded
 * to Deepgram. Responsibilities:
 *   - Validate incoming audio chunk metadata from the mobile client
 *   - Strip WAV headers if present (Deepgram streaming expects raw PCM)
 *   - Enforce maximum audio chunk size to stay within WS frame limits
 *   - Provide codec info for the batch (meeting note) pipeline
 *
 * Audio format contract with the mobile client (React Native / expo-av):
 *   Streaming mode : Linear PCM, 16-bit little-endian, 16 kHz, mono
 *   Batch mode     : AAC/m4a encoded, max 2 hours (~50-60 MB)
 */

"use strict";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// WAV file signature bytes
const WAV_RIFF_MAGIC = Buffer.from("RIFF");
const WAV_WAVE_MAGIC = Buffer.from("WAVE");

// Maximum single WebSocket audio frame (64 KB). Larger chunks are split.
const MAX_CHUNK_BYTES = 65536;

// Expected streaming audio parameters (must match mobile client config)
const EXPECTED_SAMPLE_RATE = 16000;
const EXPECTED_BIT_DEPTH = 16;
const EXPECTED_CHANNELS = 1;

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Strips the 44-byte WAV/RIFF header from a buffer if one is present.
 * expo-av can emit a WAV header on the first chunk — Deepgram streaming
 * expects raw PCM bytes only.
 *
 * @param {Buffer} chunk
 * @returns {Buffer} Raw PCM buffer (header removed if needed)
 */
function stripWavHeader(chunk) {
  if (chunk.length < 44) return chunk;

  const isRiff = chunk.slice(0, 4).equals(WAV_RIFF_MAGIC);
  const isWave = chunk.slice(8, 12).equals(WAV_WAVE_MAGIC);

  if (isRiff && isWave) {
    // Standard 44-byte PCM WAV header. "data" sub-chunk starts at byte 44.
    // Some encoders add extra metadata chunks — scan for the "data" marker.
    const dataMarker = Buffer.from("data");
    const dataOffset = chunk.indexOf(dataMarker);
    if (dataOffset !== -1 && dataOffset + 8 <= chunk.length) {
      // Skip "data" (4 bytes) + chunk size (4 bytes) = +8
      return chunk.slice(dataOffset + 8);
    }
    // Fallback: skip the canonical 44-byte header
    return chunk.slice(44);
  }

  return chunk;
}

/**
 * Split an oversized buffer into frames no larger than MAX_CHUNK_BYTES.
 *
 * @param {Buffer} chunk
 * @returns {Buffer[]}
 */
function splitIntoFrames(chunk) {
  if (chunk.length <= MAX_CHUNK_BYTES) return [chunk];

  const frames = [];
  let offset = 0;
  while (offset < chunk.length) {
    frames.push(chunk.slice(offset, offset + MAX_CHUNK_BYTES));
    offset += MAX_CHUNK_BYTES;
  }
  return frames;
}

/**
 * Validate audio metadata sent by the mobile client at session start.
 * Returns a validation result so the voice session handler can reject bad
 * configs before wasting a Deepgram connection.
 *
 * @param {object} meta  - Metadata object from the client's first WS message
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateStreamingMeta(meta) {
  const errors = [];

  if (!meta || typeof meta !== "object") {
    return { valid: false, errors: ["Missing audio metadata"] };
  }

  const { sampleRate, bitDepth, channels, encoding } = meta;

  if (sampleRate && sampleRate !== EXPECTED_SAMPLE_RATE) {
    errors.push(
      `Expected sample_rate=${EXPECTED_SAMPLE_RATE}, got ${sampleRate}. ` +
      "Configure expo-av to record at 16 kHz."
    );
  }

  if (bitDepth && bitDepth !== EXPECTED_BIT_DEPTH) {
    errors.push(
      `Expected bit_depth=${EXPECTED_BIT_DEPTH}, got ${bitDepth}.`
    );
  }

  if (channels && channels !== EXPECTED_CHANNELS) {
    errors.push(
      `Expected channels=${EXPECTED_CHANNELS} (mono), got ${channels}.`
    );
  }

  // We accept 'linear16' or 'pcm' as valid streaming encodings
  const validStreamingEncodings = ["linear16", "pcm", "wav"];
  if (encoding && !validStreamingEncodings.includes(encoding.toLowerCase())) {
    errors.push(
      `Encoding '${encoding}' is not valid for streaming. Use 'linear16'.`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a batch audio file before submitting to Deepgram pre-recorded API.
 * Checks file size against the 2-hour / ~120 MB limit.
 *
 * @param {object} params
 * @param {number} params.fileSizeBytes  - File size in bytes
 * @param {number} [params.durationSecs] - Optional declared duration in seconds
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateBatchAudio({ fileSizeBytes, durationSecs }) {
  const errors = [];

  // Max file size: 120 MB (generous headroom above the expected 50-60 MB for 2h AAC)
  const MAX_FILE_BYTES = 120 * 1024 * 1024;
  if (fileSizeBytes > MAX_FILE_BYTES) {
    errors.push(
      `Audio file too large: ${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB. ` +
      "Maximum is 120 MB (approx. 2 hours AAC)."
    );
  }

  // Max duration: 7200 seconds (2 hours)
  const MAX_DURATION_SECS = 7200;
  if (durationSecs && durationSecs > MAX_DURATION_SECS) {
    errors.push(
      `Recording duration ${Math.ceil(durationSecs / 60)} minutes exceeds the 120-minute limit.`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Process a raw audio chunk arriving over the streaming WebSocket:
 *   1. Strip WAV header if present
 *   2. Split into frames within MAX_CHUNK_BYTES
 *
 * @param {Buffer} rawChunk
 * @returns {Buffer[]}  Array of frames ready to forward to Deepgram
 */
function processStreamingChunk(rawChunk) {
  const pcm = stripWavHeader(rawChunk);
  return splitIntoFrames(pcm);
}

module.exports = {
  processStreamingChunk,
  validateStreamingMeta,
  validateBatchAudio,
  stripWavHeader,
  splitIntoFrames,
  MAX_CHUNK_BYTES,
  EXPECTED_SAMPLE_RATE,
  EXPECTED_BIT_DEPTH,
  EXPECTED_CHANNELS,
};
