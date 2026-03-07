# Backend Engineer Notes & Schemas

Date: 2026-03-07

## 1. Core Database Schemas

These tables will be managed in Supabase Postgres.

### `users`

- `id` (UUID, primary key)
- `email` (text, unique)
- `display_name` (text)
- `avatar_url` (text, nullable)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `projects`

- `id` (UUID, primary key)
- `user_id` (UUID, references users)
- `title` (text)
- `description` (text, nullable)
- `template_id` (UUID, references templates)
- `status` (enum: 'active', 'archived', 'completed')
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())
  _Note on offline sync:_ projects need a way to track `updated_at` reliably for the sync manager.

### `tasks`

- `id` (UUID, primary key)
- `project_id` (UUID, references projects)
- `parent_task_id` (UUID, references tasks, nullable for subtasks)
- `title` (text)
- `description` (text, nullable)
- `status` (text, template dependency)
- `priority` (enum: 'low', 'medium', 'high', 'urgent')
- `position` (integer, for UI ordering)
- `due_date` (timestamptz, nullable)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `templates`

- `id` (UUID, primary key)
- `name` (text)
- `type` (enum: 'kanban', 'checklist', 'sprint', 'calendar', 'custom')
- `config` (jsonb) : Features toggling supported (e.g. `{"features": {"priority": {"enabled": true}}}`)
- `is_system` (boolean, default true)
- `created_at` (timestamptz, default now())

### `meeting_notes`

- `id` (UUID, primary key)
- `project_id` (UUID, references projects, nullable)
- `user_id` (UUID, references users)
- `title` (text)
- `audio_url` (text, pointing to Supabase storage)
- `raw_transcript` (text)
- `summary` (text)
- `duration_seconds` (integer)
- `status` (enum: 'recording', 'transcribing', 'summarizing', 'done', 'error')
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `action_items`

- `id` (UUID, primary key)
- `meeting_note_id` (UUID, references meeting_notes)
- `task_id` (UUID, references tasks, nullable)
- `description` (text)
- `is_accepted` (boolean, default false)
- `created_at` (timestamptz, default now())

## 2. API Contracts

See `api_contracts.md` for explicit REST specifications.
