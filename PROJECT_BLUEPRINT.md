# Personal Bot -- Complete Project Blueprint

**Purpose:** This document describes everything needed to rebuild Personal Bot from scratch. It covers what the app is, how it works, every component involved, the UX flows, architecture, database schema, AI strategy, and how all pieces integrate.

---

## 1. What This App Is

Personal Bot is a **voice-driven personal project and task manager** for iOS. The user speaks into the app, and an AI assistant interprets the command to create projects, manage tasks, schedule calendar events, check emails, and maintain board health -- all through natural conversation.

**Core premise:** The voice is the primary input. The visual UI is the structured display layer. You should be able to manage your entire workflow without touching a button.

**What makes it different from a basic task app:**
- AI-powered intent parsing (not keyword matching -- actual conversational understanding)
- Smart context inference (knows which project you mean, detects duplicate tasks, suggests refinements)
- Housekeeping mode ("clean up my board" analyzes overdue tasks, stale projects, missed meetings)
- Gmail integration (import emails, create tasks from emails via voice)
- File attachments with local caching for offline access

---

## 2. Architecture Overview

```
+------------------+         +------------------+         +------------------+
|   iOS App        |  REST   |   Express.js     |  SQL    |   Supabase       |
|   (Expo/RN)      |-------->|   Backend        |-------->|   (PostgreSQL)   |
|                  |         |   Port 3000      |         |   + Storage      |
|  - 5 tab screens |  WS     |                  |  REST   |   + Auth         |
|  - VoiceOverlay  |-------->|  - Voice WS      |-------->|                  |
|  - Local storage |         |  - Deepgram STT  |         +------------------+
+------------------+         |  - Gemini AI     |
                             |  - Gmail API     |         +------------------+
                             |                  |-------->|   Deepgram       |
                             +------------------+   WS    |   (Speech-to-    |
                                                          |    Text)         |
                                                          +------------------+
                                                          +------------------+
                                                          |   Google Gemini  |
                                                          |   2.5 Flash      |
                                                          |   (Intent Parse) |
                                                          +------------------+
```

### Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Mobile | React Native + Expo (TypeScript) | Cross-platform with native module access via dev builds |
| Backend | Node.js + Express | Lightweight, real-time WS support, JS ecosystem |
| Database | Supabase (PostgreSQL) | Auth, real-time, storage, row-level security in one |
| File Storage | Supabase Storage | Integrated with auth, signed URLs for secure access |
| Speech-to-Text | Deepgram | Real-time streaming STT via WebSocket, high accuracy |
| AI/NLU | Google Gemini 2.5 Flash | Function calling for structured intent parsing, low latency |
| Gmail | Google Gmail API (googleapis) | REST API for email fetch, OAuth2 for auth |

### Data Flow for a Voice Command

```
User speaks "Add a task called fix the login bug to my app project"
    |
    v
[expo-av] captures audio chunks (PCM 16-bit, 16kHz mono)
    |
    v
[WebSocket] streams audio to backend ws://host:3000/voice/stream?token=JWT
    |
    v
[VoiceSession] receives chunks, forwards to Deepgram live streaming
    |
    v
[Deepgram] returns partial transcripts (streaming) and final transcript
    |
    v
[VoiceCommandHandler] receives final transcript:
    1. Fetches user context from Supabase (projects, tasks, events, emails)
    2. Formats context with today's date, task lists grouped by project
    3. Appends conversation history for multi-turn support
    4. Calls Gemini parseIntent(transcript, context)
    |
    v
[Gemini 2.5 Flash] with 14 function declarations:
    - Reads system instruction (personality, inference rules, guardrails)
    - Reads context (projects with tasks, calendar, emails)
    - Returns function call: { name: "create_task", args: { projectId: "xxx", title: "Fix the login bug" } }
    |
    v
[IntentExecutor] executes the function call against Supabase:
    - Inserts task into tasks table
    - Returns: { success: true, message: 'Created task "Fix the login bug"' }
    |
    v
[WebSocket] sends result back to mobile:
    { type: "action", intent: {...}, result: { success: true, message: "..." } }
    |
    v
[VoiceOverlay] displays success card with green checkmark
    - Auto-dismisses after 3 seconds
    - Haptic feedback (success vibration)
```
