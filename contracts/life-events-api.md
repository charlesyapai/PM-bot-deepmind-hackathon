# Life Events API Contract

**Owner:** Backend Engineer
**Consumers:** Mobile Engineer, Web Engineer, AI Pipeline Engineer (contextRetriever)

---

## REST Endpoints

### GET /api/v1/life-events
List life events with filters.

- **Query params:** `type` (optional), `startDate` (ISO), `endDate` (ISO), `source` (optional)
- **Returns:** `LifeEvent[]`

### POST /api/v1/life-events
Create a life event manually.

- **Body:** `{ type, title, start_time, end_time?, duration_minutes?, metadata?, source? }`
- **Returns:** `{ id, ...created event }`

### PUT /api/v1/life-events/:id
Update a life event.

- **Body:** partial LifeEvent fields
- **Returns:** `{ id, ...updated event }`

### DELETE /api/v1/life-events/:id
Delete a life event.

- **Returns:** 204

### POST /api/v1/life-events/voice-memo
Upload audio for processing.

- **Body:** multipart/form-data with `audio` file
- **Returns:** `{ memoId, transcript, extractedEvents: LifeEvent[] }`
- **Flow:** audio → Deepgram transcription → Gemini extraction → life_events rows

### GET /api/v1/life-events/daily/:date
Daily breakdown.

- **Returns:**
```json
{
  "date": "2026-03-13",
  "timeAllocation": { "sleep": 480, "work": 360, "exercise": 45, "social": 60, "meal": 90, "downtime": 120 },
  "tasksCompleted": 3,
  "eventsAttended": 2,
  "lifeEvents": [ ... ]
}
```

### GET /api/v1/life-events/weekly/:weekStart
Weekly report with comparison.

- **Returns:**
```json
{
  "weekStart": "2026-03-09",
  "avgSleepMinutes": 420,
  "exerciseHours": 3.5,
  "workHours": 38,
  "socialHours": 5,
  "mealCount": 18,
  "comparison": { "sleep": -30, "exercise": +1.0, "work": -2 },
  "tasksCompleted": 12,
  "productivityScore": 72
}
```

### GET /api/v1/life-events/insights
AI-generated recommendations.

- **Returns:**
```json
{
  "insights": [
    { "type": "warning", "category": "sleep", "message": "You averaged 6h sleep this week, down from 7.5h" },
    { "type": "suggestion", "category": "exercise", "message": "Free slot tomorrow 7-8am — good time for a run" },
    { "type": "positive", "category": "social", "message": "Good social balance this week — 5h across 3 interactions" }
  ],
  "generatedAt": "2026-03-13T10:00:00Z"
}
```

---

## Types

```typescript
type LifeEventType = 'sleep' | 'meal' | 'exercise' | 'social' | 'work' | 'downtime' | 'commute' | 'other';
type LifeEventSource = 'manual' | 'voice' | 'auto' | 'calendar';

interface LifeEvent {
  id: string;
  user_id: string;
  type: LifeEventType;
  title: string | null;
  start_time: string;      // ISO timestamp
  end_time: string | null;
  duration_minutes: number | null;
  metadata: Record<string, any>;
  source: LifeEventSource;
  raw_transcript: string | null;
  created_at: string;
}
```

---

## AI Intents (consumed by intentExecutor)

| Intent | Args | Description |
|--------|------|-------------|
| `log_life_event` | `{ type, title, start_time, end_time?, metadata? }` | Log a life event from voice |
| `quick_log` | `{ type, title? }` | Shorthand: "started workout", uses current time |
| `record_voice_memo` | `{}` | Triggers extended recording mode on client |
| `get_daily_breakdown` | `{ date? }` | Returns daily summary (defaults to today) |
| `get_weekly_insights` | `{}` | Returns AI recommendations |
