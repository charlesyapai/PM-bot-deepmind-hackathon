# API Contracts

**Base URL**: `https://api.personalbot.app/v1`
**Authentication**: Bearer JWT in `Authorization` header
**Content-Type**: `application/json`

## Common Behaviors

- **Pagination**: Queries handling lists can accept `?page=1&limit=20` to paginate results.
- **Offline Sync**: Query parameters like `?updated_after=TIMESTAMP` assist the frontend's offline sync-on-reconnect layer.
- **Error format**:
  ```json
  {
    "error": {
      "code": "ERROR_CODE",
      "message": "Human readable format",
      "details": {}
    }
  }
  ```

---

## 1. Projects

### `GET /projects`

Retrieve all projects for the authenticated user, optionally filtered by status.

- **Query**: `status` (active, archived, completed), `updated_after` (for offline re-sync)
- **Response**: Array of Project objects

### `POST /projects`

Create a new project.

- **Request Body**: `title`, `description` (op), `template_id`
- **Response**: Project object (201 Created)

### `GET /projects/:id`

Get a single project detail.

- **Response**: Project object

### `PUT /projects/:id`

Update an existing project.

- **Request Body**: Partial Project object
- **Response**: Updated Project object

---

## 2. Tasks

### `GET /projects/:id/tasks`

List tasks for a specific project.

- **Query**: `updated_after`, `status`, `priority`
- **Response**: Array of Task objects

### `POST /projects/:id/tasks`

Create a new task under a project.

- **Request Body**: `title`, `description` (op), `priority` (op), `due_date` (op), `parent_task_id` (op)
- **Response**: Task object (201 Created)

### `PUT /tasks/:id`

Update task attributes.

- **Request Body**: Partial Task object
- **Response**: Updated Task object

### `POST /tasks/:id/subtasks`

Create a subtask for a specific parent task.

- **Request Body**: `title`, `description` (op), `priority` (op)
- **Response**: Task object specifying a `parent_task_id`

### `PUT /tasks/:id/reorder`

Allows drag-and-drop reordering for Kanban and checklist templates.

- **Request Body**: `{ "new_position": number }`
- **Response**: 204 No Content

---

## 3. Templates

### `GET /templates`

List out the valid templates.

- **Response**: Array of Template objects

### `GET /templates/:id`

Retrieve a single template and its `config` payload.

- **Response**: Template object with JSONB config

---

## 4. Meeting Notes

### `GET /meeting-notes`

List meeting notes recorded by the user.

- **Query**: `updated_after`
- **Response**: Array of Meeting Note objects

### `POST /meeting-notes`

Upload a meeting recording audio.

- **Request Body**: `audio_url`, `project_id` (op)
- **Response**: Meeting Note entity (sync triggers down the road)

### `GET /meeting-notes/:id`

Get a specific meeting note detail including raw transcripts, summary mapping, and attached action items.

- **Response**: Detailed Meeting Note Object (with `action_items` included)

### `POST /meeting-notes/:id/summarize`

Manually trigger AI summarization against an already uploaded meeting note.

- **Response**: `{ "status": "summarizing" }` (202 Accepted)

---

## 5. Action Items

### `PUT /meeting-notes/:meeting_note_id/actions/:action_id`

Accept or reject a proposed action item.

- **Request Body**: `{ "is_accepted": boolean }`
- **Side effects**: If accepted, generates a task inside the overarching project.
- **Response**: Updated Action Item object
