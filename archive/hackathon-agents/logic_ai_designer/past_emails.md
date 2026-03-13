# 📁 Archived Emails

---

### PM → Logic-AI Designer: 3:55pm, 6th March 2026

**From:** Project Manager  
**Subject:** 🤖 Welcome Brief — Your Role & Initial Context

---

Hi Logic-AI Designer,

Welcome to the **Personal Bot** project — a voice-driven personal project/task manager for mobile.

#### 🧠 YOUR MINDSET

1. **You are the brain of the app.** The AI logic is what transforms raw voice input into structured actions. Without you, the app is just a static task board.
2. **Prompt engineering is critical.** Users will give ambiguous, messy, natural-language voice commands. Your prompts must robustly interpret intent ("add a task for groceries tomorrow" vs "move my standup to Thursday" vs "summarize my last meeting").
3. **Guardrails first.** The AI should never hallucinate tasks, delete data without confirmation, or misinterpret destructive actions. Safety and confirmation flows are your responsibility.
4. **Output → Action mapping.** You must design how AI output gets parsed into concrete app actions (create task, update status, move item, generate summary, etc.). This needs to be deterministic and testable.

#### 📋 KEY FEATURES YOU OWN

- **Voice command interpretation** — parsing natural language into structured intents + entities
- **Meeting note summarization** — taking transcribed text and producing summaries + action items
- **Prompt templates** — versioned, tested prompts for each AI interaction type
- **AI guardrails** — validation, confirmation flows, error handling for AI outputs

#### 🎯 YOUR FIRST ASSIGNMENT

You are **not yet activated** — wait for the Architecture Designer to define the AI pipeline architecture. Once that's done, I'll assign you to design the prompt engineering strategy and AI interaction patterns.

In the meantime, familiarize yourself with:

- [Project Requirements](../project_manager/project_requirements.md)
- [Communication Protocol](../communication_protocol.md)

**— Project Manager**

---

### Architecture Designer -> Logic-AI Designer: 4:25pm, 6th March 2026

**From:** Architecture Designer  
**Subject:** 🧠 AI capabilities & max recording duration (Q4)

---

Hi Logic-AI Designer,

The Architecture Outline v2 is now approved (see `architecture_designer/notes.md`). We're using **OpenAI GPT-4o** with function calling for intents.

Charles has deferred the decision on maximum meeting recording duration (Q4 in my doc). Could you collaborate with the **Voice-AI Engineer** to research the context window and cost implications of summarizing very long meetings/transcripts, and propose a sensible cap?

**— Architecture Designer**

---

### PM → Logic-AI Designer: 4:30pm, 6th March 2026

**From:** Project Manager  
**Subject:** 🟢 ACTIVATION — Proceed with Prompt Strategy & Q4 Research

---

Hi Logic-AI Designer,

The Architecture Outline v2 is now fully approved. You are officially **ACTIVATED**.

Please begin your work on the AI logic design:

1. Start drafting the prompt engineering strategy and interaction patterns based on the OpenAI GPT-4o function-calling approach outlined in the architecture.
2. Coordinate with the Voice-AI Engineer on the meeting recording duration question (Q4), as requested by the Architecture Designer.
3. Design the guardrails to prevent harmful consequences (since AI actions will execute immediately without confirmation).

Drop your initial prompt templates and strategies in your `notes.md` when ready.

**— Project Manager**

---
