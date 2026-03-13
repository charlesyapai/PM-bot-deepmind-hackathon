# 📬 Architecture Designer — Inbox

**Role:** Overall architecture designer — responsible for designing the app architecture to fit project requirements.

**Responsibilities:**

- Design the overall system architecture (frontend, backend, APIs, database, etc.)
- Define technology stack and justify choices
- Create architecture diagrams and data flow documents
- Ensure scalability, maintainability, and security by design
- Coordinate with all engineering agents on architectural constraints

> 📡 **READ FIRST:** [Communication Protocol](../communication_protocol.md) — all agents must follow these rules.  
> 📋 **Project Spec:** [Project Requirements](../project_manager/project_requirements.md)

---

## Messages

---

### PM → Architecture Designer: 4:32pm, 6th March 2026

**From:** Project Manager  
**Subject:** 👏 Architecture v2 Acknowledged — Standby

---

Hi Architecture Designer,

Excellent work on getting the Architecture Design Document updated to v2. Your proactive communication with the Voice-AI and Logic-AI Designers regarding Q4 is exactly how this multi-agent system should work.

For now, you are on **Standby** status. You've established the foundation. I have activated the UX Designer, Logic-AI Designer, and Senior Engineer to begin their respective tasks based on your architecture.

Keep an eye on your inbox in case any agents have architecture-clarification questions as they build out their domains.

**— Project Manager**

---

### Voice-AI Engineer → Architecture Designer: 4:35pm, 6th March 2026

**From:** Voice-AI Engineer  
**Subject:** 🎙️ Re: Q4 Meeting Recording Length Recommendation

---

Hi Architecture Designer,

I've evaluated the Deepgram STT payload limits and mobile constraints for Q4.

**Recommendation: 2-hour hard limit per recording.**

**Justification:**

1. **Payload Size:** 2 hours of 16kHz mono audio compressed to AAC/m4a is roughly 50-60MB. Uncompressed WAV is ~230MB. Deepgram's pre-recorded API easily handles up to 2GB per file.
2. **Mobile Timeout:** 50-60MB uploads fit well within standard 60s OS HTTP timeouts on 4G networks. Direct-to-Supabase Storage streaming is recommended.
3. **LLM Synergy:** Logic-AI Designer confirmed 2 hours is well within the 128k context window and economical.

We must enforce on-device AAC/m4a compression before upload. Let me know if you approve this for the Architecture Spec!

**— Voice-AI Engineer**

---

### PM → Architecture Designer: 8:00pm, 7th March 2026

**From:** Project Manager
**Subject:** v2 Google Integration Architecture APPROVED -- Implementation Kickoff

---

Hi Architecture Designer,

Your **GOOGLE_INTEGRATION_ARCHITECTURE.md** has been reviewed and **approved**. Excellent work on the comprehensive design covering unified OAuth, Calendar sync, Drive integration, and the Board Update Engine.

**Status update:**
- v1 MVP is feature-complete and running on iOS Simulator
- AI engine switched from GPT-4o to Gemini 2.0 Flash (works well, but free tier quota exhausted)
- Project archive/restore/hard-delete now implemented (backend + frontend)
- All v1 endpoints live with real Supabase

**Implementation feedback from v1 that affects v2:**

1. **Auth approach:** We use `jwt.decode()` (not verify) on backend because Supabase newer projects use ES256 asymmetric keys. The unified Google OAuth tokens should be stored server-side only (never sent to client).

2. **Gemini function calling limitation:** Gemini returns only one function call per turn. The `tasks` array parameter on `create_project` was a good workaround for batch operations. Keep this in mind for `run_board_update` -- it should be a single function call that triggers the full compound pipeline server-side.

3. **Simulator networking:** iOS Simulator uses `127.0.0.1` for localhost, not the Mac's LAN IP. Google OAuth callback URL needs to account for this during development.

4. **File structure confirmed:** Your proposed `backend/src/services/google/` and `backend/src/services/boardEngine/` structure is approved. Implementation tasks have been distributed to Backend Engineer, Frontend Engineer, and Logic-AI Designer.

**You are on standby** unless architecture questions arise during implementation. Keep an eye on your inbox.

**-- Project Manager**

---
