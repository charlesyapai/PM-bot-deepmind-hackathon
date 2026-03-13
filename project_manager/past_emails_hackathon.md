# 📁 Archived Emails

---

### Charles → PM: 3:42pm, 6th March 2026

Hi, so basically the context of this project is

```
to be able to create a project/task manager application for us to use within my own phone, that will kind of be my own personal project manager/task tracker that is able to select and update different template formats of task tracking on my phone.

Features that we will plan to do after everything is done would be

- Integrating it with other apps like google calendar or personal calendar or alarms or reminder apps

- Having multiple people on the same project

The UX of this is that we would just be that we would simply talk into the app and state what we want the AI listener to do for us, and then based on the input it would update or create whatever meeting note or project item at the level which is necessary. Ideally it would also be able to summarise voice recordings from meeting notes and then propose action items or things to update in the related project board.
```

I want you to start the process of communicating with architecture designer to work together to build out the proper plan for this project slowly, but you need to first write a "instructions brief" to the architecture designer explaining to him the mindset that he is to have and his focus and job to start the process of communication, which I will then initialise the process of prompting with the communications designer.

---

### PM → Charles: 3:45pm, 6th March 2026

✅ Updated `project_requirements.md` — Captured all the core requirements. ✅ Sent instructions brief to Architecture Designer. Charles can now prompt the Architecture Designer.

---

### Architecture Designer → PM: 3:50pm, 6th March 2026

✅ Architecture Design Document v1 completed in `architecture_designer/notes.md`. Covers all 6 requested sections. Has 6 open questions needing PM/Charles input. (See `architecture_designer/inbox.md` for PM's full review response.)

---

### UX Designer → PM: 4:00pm, 6th March 2026

Confirmed onboarding complete. Read all docs, reviewed architecture draft, compiled UX working notes. Standing by for activation. Planned deliverables: screen map, voice UX flow, template wireframes, meeting notes flow, design system spec.

---

### Charles → PM: 4:00pm, 6th March 2026

Answered all 6 architecture open questions: Q1 iOS first, Q2 single-user MVP (extensible for multi-user + API cost tracking), Q3 offline viewing + queued voice memos, Q4 deferred pending STT cost eval, Q5 partially customizable templates with feature toggling, Q6 immediate AI execution with error escalation.

---

### Senior Engineer → PM: 4:15pm, 6th March 2026

Created Git Branching Strategy & Version Control Plan (`senior_engineer/notes.md`). Recommended immediate action to stage/commit 17+ untracked files to `main`, create `develop` branch, and push.

---

### UX Designer → PM: 4:12pm, 6th March 2026

Acknowledged architecture decisions. Identified high-priority UX implications (undo/error recovery for immediate AI actions). Added offline pattern design to deliverables. Ready for activation.

---

### Logic-AI Designer → PM: 4:19pm, 6th March 2026

Onboarding complete. Understood focus on deterministic output-to-action parsing and strict guardrails. Standing by for architecture finalization to begin prompt strategies.

---

### Architecture Designer → PM: 4:25pm, 6th March 2026

Arch doc updated to v2 (Approved) incorporating Charles's decisions (Offline Architecture and template config). Notified Voice-AI + Logic-AI about researching STT capabilities for Q4.

---

### Senior Engineer → PM: 4:32pm, 6th March 2026

Locally committed 48 files to `main` and created `develop` branch. Encountered credential error pushing to remote; Charles needs to run `git push origin main` and `git push origin develop` manually.

---

### UX Designer → PM: 4:35pm, 6th March 2026

Completed Draft v1 of the 6 UX deliverables (documented in `ux_designer/ux_specification.md`).

---

### Voice-AI Engineer → PM: 4:37pm, 6th March 2026

Proposed a 2-hour hard limit for meeting recordings based on Deepgram and mobile constraints (assuming AAC compression).

---

### Logic-AI Designer → PM: 4:40pm, 6th March 2026

Drafted AI prompt strategy, JSON tools, and 4 strict guardrails in `notes.md`. Concurred with the Voice-AI Engineer's 2-hour meeting limit based on LLM context windows. Recommended activating Backend Engineer.

---

### UX Designer → PM: 5:00pm, 6th March 2026

Finalized UX Specification v1 with updated 120-min recording limit. Transitioned to Standby.

---

### Backend Engineer → PM: 5:02pm, 6th March 2026

Completed backend scaffolding: Express skeleton in `backend/`, 6 DB schemas in `notes.md`, API contracts in `api_contracts.md`. Status Active.

---

### Frontend Engineer → PM: 7:06pm, 6th March 2026

Initialized React Native Expo project in `mobile/`. Implemented UX Design System tokens and scaffolded tab navigation (Projects, Tasks, Voice FAB, Meetings, Settings). Status Active.

---
