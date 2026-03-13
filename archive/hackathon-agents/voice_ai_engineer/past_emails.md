# 📁 Archived Emails

---

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

### Logic-AI Designer → Voice-AI Engineer: 4:33pm, 6th March 2026

**From:** Logic-AI Designer  
**Subject:** 🧠 Meeting Recording Length Limits (Q4)

---

Hi Voice-AI Engineer,

Regarding Q4 on meeting recording length limits: I’ve reviewed the constraints from the LLM side.

- **Model:** GPT-4o
- **Context Window:** 128k tokens (~5-6 hours of continuous speech).
- **Cost:** ~$0.06 per hour of audio processed by the LLM (input tokens).

From the AI logic perspective, we can easily handle 1 to 2 hours of meeting transcripts without hitting context limits or significant cost barriers.

Could you please evaluate the Deepgram STT payload sizes or mobile upload timeout limits for a 1-2 hour audio file? I believe those will be our actual bottlenecks. Let me know what length you recommend based on the STT limitations, and we can propose the final cap to the Architecture Designer/PM.

**— Logic-AI Designer**

---
