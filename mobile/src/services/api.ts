import { getAuthHeaders } from '../lib/supabase';

// Use your Mac's LAN IP so both simulator and physical device can connect
const BASE_URL = 'http://127.0.0.1:3000/api/v1';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ProjectStatus = 'active' | 'archived' | 'completed';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TemplateType = 'kanban' | 'checklist' | 'sprint';

export interface Project {
  id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  template: TemplateType;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  projects?: { title: string; status: string };
}

export interface Template {
  id: string;
  name: string;
  type: TemplateType;
  config?: Record<string, unknown>;
}

export interface MeetingNote {
  id: string;
  title: string;
  transcript?: string;
  summary?: string;
  action_items?: string[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function getProjects(status?: ProjectStatus): Promise<Project[]> {
  const query = status ? `?status=${status}` : '';
  return apiFetch<Project[]>(`/projects${query}`);
}

export function createProject(data: {
  title: string;
  description?: string;
  template?: TemplateType;
}): Promise<Project> {
  return apiFetch<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function archiveProject(id: string): Promise<void> {
  return apiFetch<void>(`/projects/${id}`, { method: 'DELETE' });
}

export function hardDeleteProject(id: string): Promise<void> {
  return apiFetch<void>(`/projects/${id}?hard=true`, { method: 'DELETE' });
}

export function restoreProject(id: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}/restore`, { method: 'POST' });
}

/** @deprecated Use archiveProject or hardDeleteProject instead */
export function deleteProject(id: string): Promise<void> {
  return archiveProject(id);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function getTemplates(): Promise<Template[]> {
  return apiFetch<Template[]>('/templates');
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function getTasks(projectId?: string): Promise<Task[]> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return apiFetch<Task[]>(`/tasks${query}`);
}

export function getDailySummary(): Promise<{ summary: string }> {
  return apiFetch<{ summary: string }>('/tasks/daily-summary');
}

export function createTask(data: {
  title: string;
  project_id?: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
}): Promise<Task> {
  return apiFetch<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTask(
  id: string,
  fields: Partial<Pick<Task, 'title' | 'status' | 'priority' | 'description' | 'due_date'>>
): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export function aiEditTask(id: string, instruction: string): Promise<{ message: string; task: Task }> {
  return apiFetch<{ message: string; task: Task }>(`/tasks/${id}/ai-edit`, {
    method: 'POST',
    body: JSON.stringify({ instruction }),
  });
}

export function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Meeting Notes
// ---------------------------------------------------------------------------

export function getMeetingNotes(): Promise<MeetingNote[]> {
  return apiFetch<MeetingNote[]>('/meeting-notes');
}

export function createMeetingNote(data: {
  title: string;
  transcript?: string;
}): Promise<MeetingNote> {
  return apiFetch<MeetingNote>('/meeting-notes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Calendar Events
// ---------------------------------------------------------------------------

export type CalendarEvent = {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  recurrence: string | null;
  status: string;
  created_at: string;
  google_event_id?: string | null;
  sync_status?: 'local' | 'synced' | 'conflict';
};

export function getCalendarEvents(from?: string, to?: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<CalendarEvent[]>(`/calendar${query}`);
}

export function createCalendarEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>('/calendar', {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export function updateCalendarEvent(id: string, fields: Partial<CalendarEvent>): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>(`/calendar/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export function deleteCalendarEvent(id: string): Promise<void> {
  return apiFetch<void>(`/calendar/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export interface Attachment {
  id: string;
  task_id: string | null;
  project_id: string | null;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
  created_at: string;
}

export function getAttachments(taskId?: string, projectId?: string): Promise<Attachment[]> {
  const params = new URLSearchParams();
  if (taskId) params.set('task_id', taskId);
  if (projectId) params.set('project_id', projectId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<Attachment[]>(`/attachments${query}`);
}

export async function uploadAttachment(
  file: { uri: string; name: string; type: string },
  taskId?: string,
  projectId?: string
): Promise<Attachment> {
  const authHeaders = await getAuthHeaders();
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);
  if (taskId) formData.append('task_id', taskId);
  if (projectId) formData.append('project_id', projectId);

  const response = await fetch(`${BASE_URL}/attachments`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      // Do NOT set Content-Type — let fetch set multipart boundary automatically
    },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<Attachment>;
}

export function deleteAttachment(id: string): Promise<void> {
  return apiFetch<void>(`/attachments/${id}`, { method: 'DELETE' });
}

export function getAttachmentDownloadUrl(id: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(`/attachments/${id}/download`);
}

// ---------------------------------------------------------------------------
// Gmail Integration
// ---------------------------------------------------------------------------

export interface GmailConnection {
  connected: boolean;
  email: string | null;
}

export interface EmailRule {
  id: string;
  name: string;
  sender_filter: string | null;
  label_filter: string | null;
  date_from: string | null;
  date_to: string | null;
  created_at: string;
}

export interface ImportedEmail {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  snippet: string;
  received_at: string;
}

export function getGmailStatus(): Promise<GmailConnection> {
  return apiFetch<GmailConnection>('/gmail/status');
}

export function connectGmail(authCode: string): Promise<GmailConnection> {
  return apiFetch<GmailConnection>('/gmail/connect', {
    method: 'POST',
    body: JSON.stringify({ auth_code: authCode }),
  });
}

export function disconnectGmail(): Promise<void> {
  return apiFetch<void>('/gmail/disconnect', { method: 'POST' });
}

export function getEmailRules(): Promise<EmailRule[]> {
  return apiFetch<EmailRule[]>('/gmail/rules');
}

export function createEmailRule(data: {
  name: string;
  sender_filter?: string;
  label_filter?: string;
  date_from?: string;
  date_to?: string;
}): Promise<EmailRule> {
  return apiFetch<EmailRule>('/gmail/rules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteEmailRule(id: string): Promise<void> {
  return apiFetch<void>(`/gmail/rules/${id}`, { method: 'DELETE' });
}

export function getImportedEmails(): Promise<ImportedEmail[]> {
  return apiFetch<ImportedEmail[]>('/gmail/emails');
}

export function syncGmailNow(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>('/gmail/sync', { method: 'POST' });
}

export function createTaskFromEmail(emailId: string): Promise<Task> {
  return apiFetch<Task>('/gmail/emails/' + emailId + '/create-task', {
    method: 'POST',
  });
}

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

export interface HousekeepingItem {
  id: string;
  title: string;
  detail: string;
}

export interface HousekeepingResult {
  overdue_tasks: HousekeepingItem[];
  stale_projects: HousekeepingItem[];
  missing_info: HousekeepingItem[];
  past_events: HousekeepingItem[];
  upcoming_deadlines: HousekeepingItem[];
}

// ---------------------------------------------------------------------------
// Google Integration (v2 — unified OAuth)
// ---------------------------------------------------------------------------

export interface GoogleConnection {
  connected: boolean;
  email: string | null;
  scopes: string[];
  services: {
    gmail: boolean;
    calendar: boolean;
    drive: boolean;
  };
  last_email_sync: string | null;
  last_calendar_sync: string | null;
  drive_root_folder_id: string | null;
  drive_root_folder_name: string | null;
  drive_project_folder_count: number;
}

export function getGoogleStatus(): Promise<GoogleConnection> {
  return apiFetch<GoogleConnection>('/google/status');
}

export function getGoogleAuthUrl(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/google/auth-url');
}

export function disconnectGoogle(): Promise<void> {
  return apiFetch<void>('/google/disconnect', { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Google Drive
// ---------------------------------------------------------------------------

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string;
  webViewLink: string | null;
  iconLink: string | null;
}

export function getDriveFiles(projectId: string): Promise<DriveFile[]> {
  return apiFetch<DriveFile[]>(`/drive/files/${projectId}`);
}

export async function uploadToDrive(
  projectId: string,
  file: { uri: string; name: string; type: string }
): Promise<DriveFile> {
  const authHeaders = await getAuthHeaders();
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);

  const response = await fetch(`${BASE_URL}/drive/upload/${projectId}`, {
    method: 'POST',
    headers: { ...authHeaders },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<DriveFile>;
}

export function deleteDriveFile(fileId: string): Promise<void> {
  return apiFetch<void>(`/drive/files/${fileId}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Calendar Sync
// ---------------------------------------------------------------------------

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  deleted: number;
}

export function syncCalendar(): Promise<SyncResult> {
  return apiFetch<SyncResult>('/calendar/sync', { method: 'POST' });
}

export function getCalendarSyncStatus(): Promise<{
  last_sync: string | null;
  synced_count: number;
}> {
  return apiFetch('/calendar/sync/status');
}

// ---------------------------------------------------------------------------
// Board Update
// ---------------------------------------------------------------------------

export interface BoardUpdateSection {
  title: string;
  items: { label: string; detail: string }[];
}

export interface SuggestedAction {
  type: 'create_project' | 'create_task' | 'update_task' | 'create_event';
  label: string;
  args: Record<string, unknown>;
}

export interface BoardUpdate {
  id: string;
  trigger: 'voice' | 'manual' | 'scheduled';
  summary: string;
  suggestedActions?: SuggestedAction[];
  sections: BoardUpdateSection[];
  email_data: Record<string, unknown> | null;
  drive_data: Record<string, unknown> | null;
  calendar_data: Record<string, unknown> | null;
  housekeeping_data: Record<string, unknown> | null;
  created_at: string;
}

export function triggerBoardUpdate(projectId?: string): Promise<BoardUpdate> {
  return apiFetch<BoardUpdate>('/board-update', {
    method: 'POST',
    body: JSON.stringify(projectId ? { project_id: projectId } : {}),
  });
}

export function getBoardUpdateHistory(): Promise<BoardUpdate[]> {
  return apiFetch<BoardUpdate[]>('/board-update/history');
}

export interface ApplyResult {
  summary: string;
  results: { label: string; success: boolean; message: string }[];
}

export function applyBoardSuggestions(suggestedActions: SuggestedAction[]): Promise<ApplyResult> {
  return apiFetch<ApplyResult>('/board-update/apply', {
    method: 'POST',
    body: JSON.stringify({ suggestedActions }),
  });
}

// ---------------------------------------------------------------------------
// Project Emails (AI-matched imported emails per project)
// ---------------------------------------------------------------------------

export function getProjectEmails(projectId: string): Promise<ImportedEmail[]> {
  return apiFetch<ImportedEmail[]>(`/gmail/emails?project_id=${projectId}`);
}

export async function getHousekeeping(): Promise<HousekeepingResult> {
  // Backend returns camelCase keys with varying item shapes — normalize here
  const raw = await apiFetch<Record<string, unknown>>('/housekeeping');
  const r = raw as {
    overdueTasks?: { id: string; title: string; due_date?: string; project_title?: string }[];
    staleProjects?: { id: string; title: string; last_activity?: string }[];
    unsetTasks?: { id: string; title: string; missing?: string[] }[];
    pastEvents?: { id: string; title: string; start_time?: string }[];
    upcomingDeadlines?: { id: string; title: string; due_date?: string; hours_remaining?: number; project_title?: string }[];
  };

  return {
    overdue_tasks: (r.overdueTasks || []).map((t) => ({
      id: t.id,
      title: t.title,
      detail: `Due ${t.due_date || 'unknown'}${t.project_title ? ` (${t.project_title})` : ''}`,
    })),
    stale_projects: (r.staleProjects || []).map((p) => ({
      id: p.id,
      title: p.title,
      detail: p.last_activity ? `Last activity: ${p.last_activity.split('T')[0]}` : 'No activity',
    })),
    missing_info: (r.unsetTasks || []).map((t) => ({
      id: t.id,
      title: t.title,
      detail: `Missing: ${(t.missing || []).join(', ')}`,
    })),
    past_events: (r.pastEvents || []).map((e) => ({
      id: e.id,
      title: e.title,
      detail: `Was scheduled for ${e.start_time ? e.start_time.split('T')[0] : 'unknown'}`,
    })),
    upcoming_deadlines: (r.upcomingDeadlines || []).map((t) => ({
      id: t.id,
      title: t.title,
      detail: `Due in ${t.hours_remaining ?? '?'}h${t.project_title ? ` (${t.project_title})` : ''}`,
    })),
  };
}
