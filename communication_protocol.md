# 📡 Multi-Agent Communication Protocol

> **Version:** 1.0 | **Last Updated:** 2026-03-06  
> **All agents MUST read and follow this document.**

---

## 1. Folder Structure Per Agent

Every agent has a dedicated folder at the project root acting as their **mailbox**:

```
agent_folder/
├── inbox.md          # Where you RECEIVE messages
├── progress.md       # Where you POST status updates
├── notes.md          # Your private working space
└── past_emails.md    # Archived/processed emails
```

**Special folders:**

- `project_manager/` — Also contains `project_requirements.md`, `project_status.md`, `contextual_conversation.md`, and `agent_roles_and_breakdowns.md`
- `charles_inbox/` — The **lead coder's** personal inbox. Use this to communicate directly with Charles (the human).

---

## 2. How to Send a Message

To send a message to another agent, **append** to their `inbox.md` file using this format:

```markdown
---

### [Your Role] → [Recipient Role]: [Time], [Date]

**From:** [Your Role]  
**Subject:** [Brief subject line]

[Your message content here]

---
```

**Rules:**

- Always include a timestamp and date
- Always include a clear subject line
- Keep messages focused — one topic per message when possible
- If referencing a file, use relative paths (e.g., `../project_manager/project_requirements.md`)

---

## 3. How to Read & Process Your Inbox

When you check your inbox:

1. **Read all new messages** in `inbox.md`
2. **Act on them** as needed (respond, do work, escalate)
3. **Archive processed messages** — move them from `inbox.md` to `past_emails.md` by:
   - Cut the message block from `inbox.md`
   - Paste it into `past_emails.md` (append at the bottom)
   - This keeps `inbox.md` clean and focused on unread/active messages
4. **Keep `inbox.md` header intact** — only move the message blocks, never remove the role/responsibilities header at the top

---

## 4. End-of-Task Inbox Check Protocol

**At the end of every task, BEFORE concluding your work, you MUST follow this protocol:**

1. ✅ **First check** — Read your `inbox.md` for any new messages
2. ⏳ **Wait 1 minute** — Pause for 60 seconds to allow other agents to deliver messages
3. ✅ **Second check** — Read your `inbox.md` again for any messages that arrived during the wait
4. 🔀 **Decision point:**
   - If **new messages arrived** → process them and repeat the protocol after handling
   - If **no new messages** → you may safely end your task

> [!IMPORTANT]
> This protocol ensures no messages are missed during inter-agent coordination. Do NOT skip it.

---

## 5. Progress Updates

Update your `progress.md` at meaningful checkpoints — not after every tiny action, but at key milestones. Use the table format:

```markdown
| Date             | Update                  |
| ---------------- | ----------------------- |
| YYYY-MM-DD HH:MM | [What you accomplished] |
```

Update your status emoji:

- 🟢 Active — currently working
- 🟡 Waiting — briefed but awaiting input/dependency
- 🔴 Blocked — cannot proceed, needs help
- ⚪ Not Started — no work begun yet
- ✅ Complete — task finished

---

## 6. Communicating with Charles (Lead Coder)

To reach Charles directly, **write to `charles_inbox/`**.

- Create a file named `from_[your_role].md` (e.g., `from_project_manager.md`)
- Or append to an existing file if one already exists for your role
- Use the same message format as inter-agent emails
- **Only contact Charles for:** critical decisions, approvals needed, blockers, or deliverable reviews
- For routine coordination, use agent-to-agent communication

---

## 7. Communicating with the Project Manager

The PM is the coordination hub. **Always CC the PM** (by posting to `project_manager/inbox.md`) when:

- You make a major design/architecture decision
- You encounter a blocker
- You complete a milestone
- You disagree with another agent's approach

---

## 8. File Reference Conventions

- Use **relative paths** when referencing files in messages (e.g., `../project_manager/project_requirements.md`)
- When referencing your own working docs, link to `notes.md`
- When producing a deliverable, note it in your `progress.md` and notify the relevant agents

---

## 9. Conflict Resolution

If two agents disagree:

1. Both state their positions in the PM's inbox
2. PM arbitrates and posts the decision
3. All agents follow the PM's decision

---

## 10. Quick Reference — Agent Folders

| Agent                  | Folder                    | Primary Contacts                             |
| ---------------------- | ------------------------- | -------------------------------------------- |
| Project Manager        | `project_manager/`        | All agents, Charles                          |
| Architecture Designer  | `architecture_designer/`  | PM, all engineers                            |
| UX Designer            | `ux_designer/`            | PM, Frontend Engineer                        |
| Logic-AI Designer      | `logic_ai_designer/`      | PM, Backend Engineer, Voice-AI Engineer      |
| Backend Engineer       | `backend_engineer/`       | PM, Architecture Designer, Logic-AI Designer |
| Frontend Engineer      | `frontend_engineer/`      | PM, UX Designer, Backend Engineer            |
| Test Engineer          | `test_engineer/`          | PM, all engineers                            |
| Voice-AI Engineer      | `voice_ai_engineer/`      | PM, Logic-AI Designer, Backend Engineer      |
| Documentation Engineer | `documentation_engineer/` | PM, all agents                               |
| Senior Engineer        | `senior_engineer/`        | PM, all engineers                            |
| Charles (Lead Coder)   | `charles_inbox/`          | PM (primary), all agents (when needed)       |
