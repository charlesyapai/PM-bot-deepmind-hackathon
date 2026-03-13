# Sheets API Contract

**Owner:** Sheets Integration Engineer
**Consumers:** Backend Engineer (intentExecutor, routes), AI Pipeline Engineer (contextRetriever)

---

## sheetsService

### createProjectSheet(userId, title, description)
Creates a new Google Sheet with 3 tabs (Board, Project Info, History) in the user's SmoothStream root folder.

- **Params:** userId (UUID), title (string), description (string)
- **Returns:** `{ sheetId: string, folderId: string, folderUrl: string }`
- **Errors:** `GOOGLE_NOT_CONNECTED`, `SHEETS_QUOTA_EXCEEDED`, `FOLDER_CREATE_FAILED`
- **Side effects:** Creates Drive folder if root "SmoothStream" folder doesn't exist
- **Called by:** `intentExecutor.createProject()`, `routes/projects.js POST`

### getProjectBoard(userId, sheetId)
Reads the "Board" tab and returns all tasks.

- **Params:** userId (UUID), sheetId (string)
- **Returns:** `Task[]` where Task = `{ task_id, title, status, priority, due_date, description, tags, parent_task_id, position, created_at, updated_at }`
- **Errors:** `SHEET_NOT_FOUND`, `GOOGLE_NOT_CONNECTED`
- **Caching:** Returns from cache if fresh (< 30s TTL)

### getProjectInfo(userId, sheetId)
Reads the "Project Info" tab.

- **Params:** userId (UUID), sheetId (string)
- **Returns:** `{ project_id, title, description, status, created_at }`

### addTask(userId, sheetId, task)
Appends a new row to the "Board" tab.

- **Params:** userId (UUID), sheetId (string), task (object with title, status, priority, due_date, description, tags)
- **Returns:** `{ task_id: string }` (auto-generated UUID)
- **Side effects:** Appends row to History tab, invalidates cache, triggers JSON sync

### updateTask(userId, sheetId, taskId, updates)
Finds row by task_id, updates specified cells.

- **Params:** userId (UUID), sheetId (string), taskId (UUID), updates (partial Task object)
- **Returns:** `{ success: boolean }`
- **Errors:** `TASK_NOT_FOUND`
- **Side effects:** Updates `updated_at`, appends to History, invalidates cache, triggers JSON sync

### deleteTask(userId, sheetId, taskId)
Removes row from "Board" tab.

- **Params:** userId (UUID), sheetId (string), taskId (UUID)
- **Returns:** `{ success: boolean }`
- **Side effects:** Appends to History, invalidates cache, triggers JSON sync

### listProjectSheets(userId)
Lists all project Sheets in the user's SmoothStream root folder.

- **Params:** userId (UUID)
- **Returns:** `ProjectSummary[]` where ProjectSummary = `{ sheetId, title, status, taskCount, lastModified }`

### exportToJson(userId, sheetId)
Reads all tabs, writes `project_board.json` to the same Drive folder.

- **Params:** userId (UUID), sheetId (string)
- **Returns:** `{ fileId: string, success: boolean }`

### batchUpdate(userId, sheetId, operations)
Batch multiple mutations in one API call.

- **Params:** userId (UUID), sheetId (string), operations (`{ type: 'add'|'update'|'delete', task?: Task, taskId?: string, updates?: object }[]`)
- **Returns:** `{ results: { success: boolean, task_id?: string }[] }`

---

## sheetsCache

### get(sheetId, tab)
- Returns cached data or null if expired

### set(sheetId, tab, data)
- Stores data with 30s TTL

### invalidate(sheetId)
- Clears all cached data for a sheet

---

## sheetsSyncManager

### syncJsonFromSheet(userId, sheetId)
Reads current Sheet state → writes project_board.json to Drive folder.

- Called after every mutation (fire-and-forget with error logging)
- If sync fails, marks as `pending_sync` for retry on next read

### detectSheetChanges(userId, sheetId)
Compares Sheet state to last-known JSON.

- Returns: `{ changed: boolean, diff: { added: Task[], updated: Task[], deleted: string[] } }`
