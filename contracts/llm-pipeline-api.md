# LLM Pipeline API Contract

**Owner:** AI Pipeline Engineer
**Consumers:** Backend Engineer (voiceCommandHandler), Test Engineer (eval framework)

---

## agentPipeline

### run(transcript, userId)
Main entry point. Replaces direct `parseIntent()` call.

- **Params:** transcript (string), userId (UUID)
- **Returns:**
```json
{
  "intent": {
    "name": "create_task",
    "args": { ... },
    "confidence": 0.92
  },
  "result": {
    "success": true,
    "message": "Task created: Literature Review",
    "data": { ... }
  },
  "pendingActions": null
}
```

**Internal flow:**
1. Classify intent category (fast, minimal context)
2. Retrieve scoped context via contextRetriever
3. Parse intent with full function declarations
4. Execute via intentExecutor
5. Detect follow-up opportunities → store as pendingActions

**Confidence behavior:**
- `>= 0.7`: Execute normally
- `0.5 - 0.7`: Execute but flag: "I'm not fully sure — here's what I did"
- `< 0.5`: Return clarify intent, don't execute

---

## contextRetriever

### getContextForCategory(userId, category)
Returns minimal context scoped to the intent category.

- **Params:** userId (UUID), category (string: 'project'|'task'|'calendar'|'life'|'board'|'chat')
- **Returns:** context object (subset of full user context)

**Category → Context mapping:**
| Category | Data Fetched |
|----------|-------------|
| project | project list (from Sheets index) |
| task | project list + tasks for referenced project (from Sheets) |
| calendar | events for relevant date range (±7 days) |
| life | recent life events (last 7 days) |
| board | full context (projects, tasks, events, emails, life events) |
| chat | project names + counts only |

---

## modelClient

### callModel({ model, systemPrompt, userPrompt, tools, temperature, maxTokens })
Abstract LLM interface. All LLM calls go through this.

- **Returns:** `{ response, usage: { promptTokens, responseTokens }, latencyMs }`
- **Side effects:** Logs to `llm_logs` table via llmMonitor
- **Currently wraps:** Google Gemini only
- **Future:** Interface supports Claude, OpenAI swap

---

## promptTemplates

### buildPrompt(category, context, options?)
Composes a system prompt from modular templates.

- **Params:** category (string), context (object), options ({ fewShot?: boolean, confidence?: boolean })
- **Returns:** `{ systemPrompt: string, fewShotExamples?: string }`

---

## llmMonitor

### log(entry)
Writes to `llm_logs` table.

- **Entry:** `{ userId, model, intentCategory, parsedIntent, confidence, promptTokens, responseTokens, latencyMs, success, error }`

### getStats(filters?)
- **Returns:** `{ avgLatency, accuracyRate, intentDistribution, totalCalls, errorRate, costEstimate }`
- **Endpoint:** `GET /api/v1/admin/llm-stats`
