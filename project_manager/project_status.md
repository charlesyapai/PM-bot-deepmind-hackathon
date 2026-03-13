# Project Status Dashboard

> **Last Updated:** 2026-03-13
> **Project:** SmoothStream — AI-powered personal assistant for project management + life tracking

---

## Current Phase: v2 Evolution (Post-Hackathon Restructure)

The hackathon MVP is complete and working. Now evolving the app across 6 phases:
1. Google Sheets as project board storage (replacing Supabase for tasks)
2. Advanced LLM pipeline with multi-step reasoning + monitoring
3. Life tracking (sleep, meals, exercise, social, work) via voice/buttons/auto
4. Enhanced mobile UI with local STT + Kanban + timeline views
5. Next.js web app with full parity
6. Polish (RAG, eval framework, enhanced board updates)

---

## Phase Status

| Phase | Status | Teams | Branch | Tests |
|-------|--------|-------|--------|-------|
| 1. Sheets Storage | 🟢 Ready to Start | Sheets, Backend, Test | `phase/1-sheets` | 0/12 |
| 2. LLM Pipeline | 🟢 Ready to Start | AI, Backend, Test | `phase/2-llm-pipeline` | 0/10 |
| 3. Life Tracking | ⚪ Not Started | Backend, AI, Test | — | — |
| 4. Mobile UI | 🟢 Ready to Start | Mobile, Test | `phase/4-mobile-ui` | 0/6 |
| 5. Web App | ⚪ Not Started | Web, Test | — | — |
| 6. Polish | ⚪ Not Started | All | — | — |

**Parallel tracks:**
- Track A: Phase 1 → Phase 5 (Sheets → Web)
- Track B: Phase 2 → Phase 3 (LLM → Life Tracking)
- Track C: Phase 4 (Mobile UI — independent)

---

## Team Status

| # | Team | Status | Current Task | Blockers |
|---|------|--------|-------------|----------|
| 1 | Project Manager | 🟢 Active | Kickoff coordination | None |
| 2 | Sheets Integration Engineer | ⚪ Not Started | Awaiting phase 1 kickoff | None |
| 3 | AI Pipeline Engineer | ⚪ Not Started | Awaiting phase 2 kickoff | None |
| 4 | Backend Engineer | ⚪ Not Started | Awaiting phases 1+2 contracts | None |
| 5 | Mobile Engineer | ⚪ Not Started | Awaiting phase 4 kickoff | None |
| 6 | Web Engineer | ⚪ Not Started | Blocked on Phase 1 + Phase 3 | Phase 1, Phase 3 |
| 7 | Test & QA Engineer | ⚪ Not Started | Awaiting first deliverables | None |

---

## Completed Setup (2026-03-13)

- [x] Archived 7 hackathon agent folders to `archive/hackathon-agents/`
- [x] Created 4 new team folders with inbox/progress/notes templates
- [x] Reset project_manager, backend_engineer, test_engineer folders
- [x] Created `contracts/` with API contracts (sheets-api, llm-pipeline-api, life-events-api)
- [x] Created git branches: `develop`, `phase/1-sheets`, `phase/2-llm-pipeline`, `phase/4-mobile-ui`
- [x] Updated `communication_protocol.md` for v2 team structure
- [ ] Write phase briefing docs (phase_1_brief.md, phase_2_brief.md, phase_4_brief.md)
- [ ] Enable Google Sheets API in Google Cloud Console
- [ ] Add Sheets scope to OAuth consent screen

---

## Key Architectural Decisions

| Date | Decision | Impact |
|------|----------|--------|
| 2026-03-13 | Google Sheets replaces Supabase for project/task storage | Phase 1 foundation |
| 2026-03-13 | Multi-step LLM pipeline (classify → scope → parse → execute) | Phase 2 |
| 2026-03-13 | Life tracking via voice memos + quick buttons + auto-detection | Phase 3 |
| 2026-03-13 | On-device STT (expo-speech-recognition) for fast commands | Phase 4 |
| 2026-03-13 | Next.js web app with full mobile parity | Phase 5 |
| 2026-03-13 | Gemini only for now, model abstraction layer for future swap | Phase 2 |
| 2026-03-13 | LLM monitoring with performance drift detection | Phase 2 |

---

## API Contracts

| Contract | Owner | Consumers | File |
|----------|-------|-----------|------|
| Sheets API | Sheets Engineer | Backend, AI Pipeline | `contracts/sheets-api.md` |
| LLM Pipeline API | AI Engineer | Backend | `contracts/llm-pipeline-api.md` |
| Life Events API | Backend Engineer | Mobile, Web, AI | `contracts/life-events-api.md` |

---

## Baseline from Hackathon (v1)

| Feature | Status |
|---------|--------|
| Projects CRUD | Done |
| Tasks CRUD | Done |
| Calendar Events | Done |
| Gmail Integration | Done |
| Google OAuth (Gmail + Calendar + Drive) | Done |
| Board Update Engine | Done |
| AI Intent System (22 intents) | Done |
| Voice Pipeline (Deepgram) | Done |
| Housekeeping | Done |
| File Attachments | Done |
| 78 integration tests | Done |

All v1 features remain working on `main` branch.
