# Multi-Agent Communication Protocol

> **Version:** 2.0 | **Last Updated:** 2026-03-13
> **All agents MUST read and follow this document.**

---

## 1. Team Structure (v2)

| # | Team | Folder | Primary Scope |
|---|------|--------|---------------|
| 1 | Project Manager | `project_manager/` | Coordination, status tracking, phase sign-off |
| 2 | Sheets Integration Engineer | `sheets_engineer/` | Google Sheets API, Drive sync, caching, JSON export |
| 3 | AI Pipeline Engineer | `ai_engineer/` | LLM pipeline, prompts, model abstraction, monitoring |
| 4 | Backend Engineer | `backend_engineer/` | Routes, intent executor, board engine, life tracking, DB |
| 5 | Mobile Engineer | `mobile_engineer/` | React Native screens, components, navigation, local STT |
| 6 | Web Engineer | `web_engineer/` | Next.js web app (full parity with mobile) |
| 7 | Test & QA Engineer | `test_engineer/` | Test suites, eval datasets, demo scenarios |

**Charles (Lead Coder)** — contact via PM for critical decisions only.

---

## 2. Folder Structure Per Agent

Every agent has a dedicated folder at the project root:

```
agent_folder/
├── inbox.md          # Where you RECEIVE messages
├── progress.md       # Where you POST status updates
├── notes.md          # Your private working space
└── past_emails.md    # Archived/processed emails (created as needed)
```

**Special folders:**
- `project_manager/` — Also contains `project_requirements.md`, `project_status.md`, phase briefing docs
- `contracts/` — API contracts (read before implementation, see Section 10)
- `archive/hackathon-agents/` — Archived v1 agent folders (reference only)

---

## 3. How to Send a Message

Append to the recipient's `inbox.md`:

```markdown
---

### [Your Role] → [Recipient Role]: [Time], [Date]

**From:** [Your Role]
**Subject:** [Phase N] [Brief subject line]
**Branch:** phase/<N>-<name>
**Commit:** <hash> (if applicable)

[Your message content here]

---
```

**Rules:**
- Always include timestamp, date, and phase number
- Include branch and commit hash when reporting completed work
- Keep messages focused — one topic per message
- Use relative paths for file references

---

## 4. How to Read & Process Your Inbox

1. Read all new messages in `inbox.md`
2. Act on them (respond, do work, escalate)
3. Archive processed messages — move from `inbox.md` to `past_emails.md`
4. Keep `inbox.md` header intact

---

## 5. End-of-Task Inbox Check Protocol

At the end of every task, BEFORE concluding:

1. Read your `inbox.md` for new messages
2. Wait 1 minute
3. Read `inbox.md` again
4. If new messages arrived → process and repeat
5. If no new messages → safe to end

---

## 6. Progress Updates

Update `progress.md` at meaningful checkpoints:

```markdown
| Date | Update | Status |
|------|--------|--------|
| 2026-03-13 14:00 | [Phase 1] Created sheetsService with 3-tab structure | 🟢 Active |
```

Status indicators:
- 🟢 Active — currently working
- 🟡 Waiting — awaiting input/dependency
- 🔴 Blocked — cannot proceed
- ⚪ Not Started
- ✅ Complete

---

## 7. Communicating with the Project Manager

The PM is the coordination hub. Post to `project_manager/inbox.md` when:

- You complete a milestone
- You encounter a blocker
- You make a major decision
- You disagree with another agent's approach
- You need to change an API contract

---

## 8. Version Control Rules

### Branch Model
```
main ── stable, deployable (merge from develop only)
  └── develop ── integration branch
        └── phase/<N>-<name> ── one branch per phase
```

### Conventional Commits
All commits must follow this format:
```
feat(scope): description
fix(scope): description
test(scope): description
refactor(scope): description
docs(scope): description
```

Scopes: `sheets`, `llm`, `intent`, `life`, `mobile`, `web`, `board`, `api`, `auth`

### Merge Protocol
1. Agent completes feature → commits to phase branch
2. Agent posts to PM inbox: feature complete, commit hash, test results
3. Test Engineer runs test suite on phase branch → posts results
4. PM reviews → approves merge to `develop`
5. After full phase passes on `develop` → merge to `main`, tag release

### Rules
- No force pushes to `main` or `develop`
- Phase branches may rebase on `develop` to stay current
- Tag releases on `main`: `v2.0-phase1`, `v2.0-phase2`, etc.

---

## 9. Blocker Escalation

1. Agent posts blocker to PM inbox
2. PM identifies which team owns the blocker
3. PM posts to blocking team's inbox with `[BLOCKER]` tag
4. Blocking team responds within same session or next session
5. If unresolved after 2 sessions, Charles is notified

---

## 10. API Contracts

Before implementing features that other teams depend on, publish a contract in `contracts/`:

```markdown
## Function: serviceName.functionName(params)
- Returns: { ... }
- Errors: ERROR_CODE_1, ERROR_CODE_2
- Side effects: What it changes
- Called by: Who uses this
```

**Rules:**
- Contracts are written BEFORE implementation
- Teams implement against the contract
- To change a contract, update the file and notify dependent teams via PM inbox
- Current contracts: `sheets-api.md`, `llm-pipeline-api.md`, `life-events-api.md`

---

## 11. Testing Gates

Each phase must pass its testing gate before merging to `develop`:

| Phase | Gate |
|-------|------|
| 1. Sheets Storage | All integration tests pass + existing 78 tests updated |
| 2. LLM Pipeline | ≥85% eval accuracy + all integration tests pass |
| 3. Life Tracking | All integration tests + 5+ voice memo extraction samples |
| 4. Mobile UI | All views render + local STT works on iOS device |
| 5. Web App | Feature parity checklist 100% + auth + Kanban works |

---

## 12. Conflict Resolution

If two agents disagree:
1. Both state their positions in the PM's inbox
2. PM arbitrates and posts the decision
3. All agents follow the PM's decision

---

## 13. Session Preamble

When starting an agent session, use this context block:

```
You are the [Role] for the SmoothStream project.
Current phase: [N] - [Name]
Your branch: phase/[N]-[name]
Read before starting:
- contracts/[relevant-contract].md
- project_manager/phase_[N]_brief.md
- Your folder: [role]/progress.md (see where you left off)
Check your inbox: [role]/inbox.md
```
