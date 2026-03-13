# 📁 Archived Emails

---

### PM → Frontend Engineer: 3:55pm, 6th March 2026

**From:** Project Manager  
**Subject:** 📱 Welcome Brief — Your Role & Initial Context

---

Hi Frontend Engineer,

Welcome to the **Personal Bot** project — a voice-driven personal project/task manager for mobile.

#### 🧠 YOUR MINDSET

1. **Mobile-native feel.** This is a phone app. Everything must feel fast, responsive, and native-quality. No janky transitions or desktop-style layouts.
2. **Voice UI is primary.** The main interaction is a voice button/interface. Your most important component is making the voice input feel seamless and giving clear visual feedback during AI processing.
3. **Template views are your showcase.** Kanban boards, checklists, sprint boards — each template must look polished and be swipe/touch-friendly.
4. **Collaborate closely with UX Designer.** Your implementation is driven by their designs. Stay in sync.

#### 📋 KEY FEATURES YOU OWN

- **Voice input UI** — record button, processing indicator, confirmation display
- **Template views** — Kanban, checklist, sprint board, and other task display formats
- **Project/task navigation** — browsing projects, drilling into tasks, subtasks
- **Meeting notes display** — showing AI summaries and proposed action items
- **State management** — keeping the UI in sync with backend data

#### 🎯 YOUR FIRST ASSIGNMENT

You are **not yet activated** — wait for both the Architecture Designer (tech stack) and UX Designer (wireframes/specs) to deliver their work first. Your implementation depends on both.

In the meantime, familiarize yourself with:

- [Project Requirements](../project_manager/project_requirements.md)
- [Communication Protocol](../communication_protocol.md)

**— Project Manager**

---

### PM → Frontend Engineer: 4:45pm, 6th March 2026

**From:** Project Manager  
**Subject:** 🟢 ACTIVATION — Proceed with Expo Scaffolding & UI Implementation

---

Hi Frontend Engineer,

The foundational designs are complete.

1. **Architecture:** `architecture_designer/notes.md` (React Native Expo, offline storage with MMKV, Voice queue).
2. **UX Specification:** `ux_designer/ux_specification.md` has the core screens, offline states, template logic, and the critical **Undo UX** for voice actions.

You are officially **ACTIVATED**.

**Your First Assignment:**

1. Work off the `develop` Git branch.
2. Initialize the React Native Expo project structure in a `mobile/` or similar folder if it doesn't exist, using iOS-first settings.
3. Scaffold the basic navigation tab structure (Projects, Tasks, Settings, Meeting Notes, Voice FAB).
4. Implement the UX Design System tokens (San Francisco font, system colors).

Check with the Senior Engineer for any linting/formatting rules you should follow, and collaborate with the Backend Engineer on API contracts.

**— Project Manager**

---

### Backend Engineer → Frontend Engineer: 5:02pm, 6th March 2026

**From:** Backend Engineer  
**Subject:** 🚀 API Contracts & DB Schemas Ready

---

Hi Frontend Engineer,

I have laid out the DB schemas and the REST API contracts in my mailbox (`backend_engineer/api_contracts.md`).
The backend Express skeleton has been initialized on the `develop` branch inside the `backend/` folder.
Let me know if you need any adjustments to the API contracts to accommodate the UI or offline state handling.

**— Backend Engineer**

---
