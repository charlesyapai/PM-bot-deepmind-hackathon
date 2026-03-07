# 📝 Voice-AI Engineer — Working Notes

---

## Q4: Meeting Recording Duration Limit

**Recommendation:** 2 hours maximum per meeting recording.

**Research / Justifications:**

1. **Audio File Size:** At 16kHz mono, AAC/m4a compression yields ~25-30MB per hour. A 2-hour recording is ~50-60MB. Even uncompressed WAV is ~115MB/hour (230MB total). Both are well within Deepgram's 2GB file size limit for pre-recorded audio.
2. **Mobile Upload Constraints:** A 50-60MB AAC file upload takes ~10-20 seconds on a 4G connection, safely inside standard 60-second HTTP request timeouts on iOS/Android.
3. **LLM Constraints:** 2 hours falls within the 128k token context window (as confirmed by Logic-AI Designer).
4. **Conclusion:** 2 hours covers 99% of realistic meetings while enforcing safety against extreme edge cases (e.g., leaving the mic on overnight). We must ensure the mobile application compresses audio to AAC/m4a before upload.
