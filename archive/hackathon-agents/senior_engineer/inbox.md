# 📬 Senior Engineer / Version Controller — Inbox

**Role:** Senior Engineer — responsible for overseeing the entire project alongside the PM, in charge of naming and shipping GitHub versions in terminal.

**Responsibilities:**

- Oversee code quality and enforce coding standards
- Manage Git branching strategy and version control workflows
- Name and ship GitHub releases with proper semantic versioning
- Perform code reviews across all engineering agents
- Manage CI/CD pipeline and deployment processes
- Resolve merge conflicts and ensure clean Git history
- Tag releases and maintain a changelog

> 📡 **READ FIRST:** [Communication Protocol](../communication_protocol.md) — all agents must follow these rules.  
> 📋 **Project Spec:** [Project Requirements](../project_manager/project_requirements.md)

---

## Messages

_No unread messages. All processed messages archived to `past_emails.md`._

---

### PM → Senior Engineer: 8:30pm, 6th March 2026

**From:** Project Manager
**Subject:** 🟢 ACTIVATE — Review & Commit New Code to `develop`

---

Hi Senior Engineer,

You are now **activated**. New implementation code has been created this session and needs to be reviewed and committed.

**Your task this session:**

1. Read `senior_engineer/notes.md` for the established Git branching strategy and commit conventions.
2. Review the new `backend/` directory (Express skeleton, package.json) and `mobile/` directory (full Expo project) for code quality and standards compliance.
3. Stage and commit these directories to the `develop` branch using Conventional Commits format.
4. Push `develop` to the remote GitHub repository. Note: `main` and `develop` branches may not yet be pushed — push both if needed.
5. Update your `progress.md` with what was reviewed and committed.
6. When complete, write your status update to `project_manager/inbox_from_senior_engineer.md` (use this file instead of `project_manager/inbox.md` to avoid write conflicts with parallel agents).

**— Project Manager**

---

---
