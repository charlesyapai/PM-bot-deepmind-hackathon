# 📬 Voice-AI Engineer — Inbox

**Role:** Voice-AI Engineer — responsible for implementing voice AI and its integration with the app.

**Responsibilities:**

- Implement voice input (speech-to-text) capabilities
- Implement voice output (text-to-speech) capabilities
- Integrate voice AI with the application's core logic
- Handle audio processing, noise reduction, and voice quality
- Define voice interaction patterns and conversational flows
- Test voice features across devices and environments

> 📡 **READ FIRST:** [Communication Protocol](../communication_protocol.md) — all agents must follow these rules.  
> 📋 **Project Spec:** [Project Requirements](../project_manager/project_requirements.md)

---

## Messages

### PM → Voice-AI Engineer: 3:55pm, 6th March 2026

**From:** Project Manager  
**Subject:** 🎙️ Welcome Brief — Your Role & Initial Context

---

Hi Voice-AI Engineer,

Welcome to the **Personal Bot** project — a voice-driven personal project/task manager for mobile.

#### 🧠 YOUR MINDSET

1. **You own the most critical input method.** Voice is how users primarily interact with this app. If the voice experience is bad, the entire app fails — no matter how good everything else is.
2. **Latency is your enemy.** The user speaks, and they expect near-instant response. STT processing must be fast. Any loading/processing must have clear visual/audio feedback.
3. **Robustness matters.** Background noise, accents, mumbling, interruptions — real-world voice input is messy. Your implementation must handle it gracefully.
4. **Work closely with the Logic-AI Designer.** You handle the audio → text conversion; they handle the text → intent interpretation. The handoff between you two must be seamless.

#### 📋 KEY FEATURES YOU OWN

- **Speech-to-text (STT)** — capturing voice, converting to text, handling edge cases
- **Audio recording for meetings** — longer-form recording for meeting note summarization
- **Voice feedback/TTS (if applicable)** — audio confirmations, read-back of actions
- **Microphone permissions and device integration** — mobile audio APIs
- **Streaming vs. batch processing** — deciding whether to process audio in chunks or as a whole

#### 🎯 YOUR FIRST ASSIGNMENT

You are **not yet activated** — wait for the Architecture Designer to define the voice pipeline architecture and STT service choice. Your implementation depends on those decisions.

In the meantime, familiarize yourself with:

- [Project Requirements](../project_manager/project_requirements.md)
- [Communication Protocol](../communication_protocol.md)

**— Project Manager**

---

### Architecture Designer -> Voice-AI Engineer: 4:25pm, 6th March 2026

**From:** Architecture Designer
**Subject:** 🎙️ STT capabilities & max recording duration (Q4)

---

Hi Voice-AI Engineer,

The Architecture Outline v2 is now approved (see `architecture_designer/notes.md`). We've chosen **Deepgram** for streaming STT.

However, Charles has a question regarding the maximum meeting recording duration limits (Question 4 in my doc). Charles deferred the decision pending an evaluation of STT model capabilities and costs.

Could you partner with the **Logic-AI Designer** to research how long a recording we can process efficiently (Deepgram streaming/batch STT limits, cost implications, etc.) and propose a limit? Please refer to Q4 in `architecture_designer/notes.md`.

**— Architecture Designer**

---

### PM → Voice-AI Engineer: 8:30pm, 6th March 2026

**From:** Project Manager
**Subject:** 🟢 ACTIVATE — Deepgram WebSocket Streaming Implementation

---

Hi Voice-AI Engineer,

You are now **activated**. Q4 (recording duration) has been resolved — the limit is **2 hours (120 minutes)**. Begin implementation.

**Your task this session:**

1. Read `architecture_designer/notes.md` for the full voice pipeline architecture and Deepgram integration specs.
2. Read `logic_ai_designer/notes.md` for the AI handoff contract (audio → text → intent).
3. Read `backend_engineer/api_contracts.md` for the relevant voice/meeting-note endpoints.
4. Implement the Deepgram WebSocket streaming integration and audio compression pipeline. Create your implementation files under a `voice/` or `backend/src/services/voice/` directory as appropriate.
5. Update your `progress.md` at each milestone.
6. When complete, write your status update to `project_manager/inbox_from_voice_ai_engineer.md` (use this file instead of `project_manager/inbox.md` to avoid write conflicts with parallel agents).

**— Project Manager**

---
