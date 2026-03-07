# Demo Scenario: Research Analyst Workflow

## Persona

**Dr. Alex Chen** — Research Analyst at a university biomedical research center.
Manages 3 active research projects under different Principal Investigators (PIs).
Uses Personal Bot to stay on top of cross-project tasks, emails from PIs, calendar scheduling, and document management.

---

## Projects

### 1. NIH Grant - Alzheimer's Biomarkers
- **PI:** Dr. Sarah Chen
- **Status:** Active, mid-stage — data collection underway
- **Tasks:** Literature review (done), IRB approval (done), patient recruitment (in progress), biomarker assay development (todo), data analysis pipeline (todo), manuscript draft (todo)
- **Emails:** Dr. Mitchell sends updates about new patient data, protocol changes
- **Drive:** Protocol docs, IRB approval letter, preliminary results spreadsheet

### 2. NSF Climate Modeling Study
- **PI:** Dr. James Park
- **Status:** Active, early stage — model setup phase
- **Tasks:** Dataset acquisition (done), model calibration (in progress, overdue), validation framework (todo, due soon), peer review prep (todo), conference abstract (todo, urgent)
- **Emails:** Dr. Park sends model parameters and conference deadline reminders
- **Drive:** Model configs, dataset manifests, draft abstract

### 3. Industry Collab - Genomics Pipeline
- **PI:** Dr. Priya Sharma
- **Status:** Active, just started
- **Tasks:** Requirements gathering (in progress), pipeline architecture (todo), test dataset prep (todo), benchmarking (todo)
- **Emails:** Dr. Sharma sends onboarding docs and timeline expectations
- **Drive:** Requirements spec, partner agreement

---

## Demo Flow (Voice Commands)

### Scene 1: Morning Check-in
**Voice:** "Good morning, catch me up"
**Expected:** Board update triggers — scans emails, calendar, tasks. AI returns summary:
- "You have 2 new emails: Dr. Mitchell shared preliminary biomarker results, and Dr. Park reminded you about the conference abstract deadline (March 15)."
- "Model calibration for the NSF study is overdue by 3 days."
- "You have a PI meeting with Dr. Sharma tomorrow at 10am."

### Scene 2: Email Triage
**Voice:** "Show me emails from Dr. Mitchell"
**Expected:** check_emails returns Dr. Mitchell's emails about new patient data and protocol amendment.

**Voice:** "Create a task from that email about the protocol"
**Expected:** create_task_from_email — creates "[Email] Protocol Amendment - Updated consent forms" in the Alzheimer's project.

### Scene 3: Task Management
**Voice:** "Mark the literature review as done in the Alzheimer's project"
**Expected:** AI finds the task in context, responds "That task is already completed!" (it was pre-seeded as done).

**Voice:** "What tasks are overdue?"
**Expected:** run_housekeeping — "Model calibration for NSF Climate Modeling is overdue by 3 days. The conference abstract is due in 2 days."

**Voice:** "Move the model calibration due date to next Friday"
**Expected:** update_task — due date updated.

### Scene 4: Scheduling
**Voice:** "Schedule a meeting with Dr. Mitchell to discuss the biomarker results, Friday at 2pm"
**Expected:** create_event — "Scheduled 'Meeting with Dr. Mitchell - Biomarker Results' on Friday at 14:00."

**Voice:** "What's on my calendar this week?"
**Expected:** Lists upcoming events including the PI meeting with Dr. Sharma and the newly created Mitchell meeting.

### Scene 5: Project Overview
**Voice:** "What files are in my Alzheimer's project?"
**Expected:** list_drive_files — shows Protocol v2.pdf, IRB Approval Letter.pdf, Preliminary Results.xlsx

**Voice:** "How are my projects looking overall?"
**Expected:** list_projects — "You have 3 active projects: 1. NIH Grant - Alzheimer's Biomarkers (4 pending, 2 done), 2. NSF Climate Modeling Study (3 pending, 1 done), 3. Industry Collab - Genomics Pipeline (4 pending, 0 done)."

### Scene 6: Quick Create
**Voice:** "Create a new project called Conference Poster with tasks: design layout, write abstract, gather figures, and get PI feedback"
**Expected:** create_project with batch tasks — "Created project 'Conference Poster' with 4 tasks."

---

## Seed Data Summary

| Entity | Count | Details |
|--------|-------|---------|
| Projects | 3 | Alzheimer's, Climate Modeling, Genomics Pipeline |
| Tasks | 17 | Mixed statuses, some overdue, some due soon |
| Calendar Events | 4 | PI meetings, conference deadline, lab booking |
| Imported Emails | 5 | From 3 different PIs, research-relevant content |
| Drive Files | 6 | PDFs, spreadsheets, docs across 2 projects |

---

## Key Demo Moments

1. **Board Update** — shows the compound AI summarization (emails + tasks + calendar in one answer)
2. **Email-to-Task** — demonstrates real-world email ingestion workflow
3. **Overdue Detection** — housekeeping catches the overdue model calibration
4. **Smart Context** — AI auto-selects the right project when the user says "the Alzheimer's project"
5. **Batch Create** — voice creates a project + 4 tasks in one command
6. **Drive Files** — shows file awareness per project
