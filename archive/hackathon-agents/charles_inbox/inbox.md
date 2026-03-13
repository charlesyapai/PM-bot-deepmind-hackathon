# 📬 Charles (Lead Coder) — Inbox

This is your personal inbox. Agents will drop messages here when they need your attention.

---

## Messages

### PM → Charles: 9:28am, 7th March 2026

**From:** Project Manager  
**Subject:** 🏗️ Architecture Design Document v1 Ready — Your Input Needed on 6 Questions

---

Hi Charles,

Great news — the Architecture Designer has completed the **Architecture Design Document v1**. I've reviewed it and it aligns well with all project requirements. The full document is at [`architecture_designer/notes.md`](../architecture_designer/notes.md).

**Quick summary of what was designed:**

- **3-service modular backend** — Core API, Voice Service, AI Service (all Node.js/Express)
- **Tech stack** — React Native (Expo) + Supabase (PostgreSQL + Auth + Storage) + OpenAI GPT-4o + Deepgram STT
- **6 data entities** — Users, Projects, Tasks (self-referencing subtasks), Templates (JSONB config), Meeting Notes, Action Items
- **Voice pipeline** — Streaming STT via WebSocket, <2.5s target latency end-to-end
- **21 REST endpoints** + WebSocket for voice streaming
- **Extensibility** — plugin-based module architecture for calendar, multi-user, cross-app integrations

**I need your decisions on these 6 open questions:**

| #      | Question                                                                                | Architect's Recommendation                    |
| ------ | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Q1** | **Target platforms** — iOS only, Android only, or both?                                 | iOS first for MVP, Android shortly after      |
| **Q2** | **Auth scope** — Full auth (email + OAuth) for MVP, or simpler single-user?             | Full auth via Supabase (near-zero effort)     |
| **Q3** | **Offline support depth** — None / Basic caching / Full offline-first?                  | Basic caching for MVP                         |
| **Q4** | **Meeting recording max duration?**                                                     | Cap at 60 min for MVP                         |
| **Q5** | **Template customization** — Users can create custom templates, or system-only for MVP? | System templates only for MVP                 |
| **Q6** | **AI action confirmation** — Execute immediately or confirm first?                      | Immediate for simple, confirm for destructive |

Please reply with your decisions and I'll relay to the Architecture Designer to finalize the document.

**— Project Manager**

---
