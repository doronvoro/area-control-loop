# Action Report Redesign

> **Last Updated:** 2026-02-12
> **Status:** Draft — Planning Phase

---

## Table of Contents

1. [Current System](#1-current-system)
2. [Problems with Current Design](#2-problems-with-current-design)
3. [Proposed Redesign: Task-Based Actions](#3-proposed-redesign-task-based-actions)
4. [Future Improvements](#4-future-improvements)
5. [Implementation Plan](#5-implementation-plan)

---

## 1. Current System

### 1.1 How It Works Today

The system has two main workflows — **Monitoring** and **Actions** — that are connected but operate as separate forms.

#### The Full Flow

```
Inspector goes to field
    ↓
Opens Monitoring Form, selects area
    ↓
For each sub-area, records:
  - Finding (pest/disease found)
  - Severity (low/medium/high/critical)
  - Treatment recommendations (material, dosage, action type)
    ↓
Monitoring report saved with status = 'pending'
    ↓
─── time passes ───
    ↓
Action worker opens Action Form, selects area
    ↓
Form auto-loads unprocessed monitoring reports for that area
    ↓
Worker reviews monitoring recommendations
Worker can adjust dosage/material if needed
Worker can add standalone entries (not from monitoring)
    ↓
Action report saved, linked back to monitoring
```

### 1.2 Current Database Structure

```
report_areas (shared container for both types)
├── id
├── area_id
├── area_type_id         → 'monitoring' or 'action'
├── name
├── status               → always 'pending' (never updated)
├── report_number
├── worker_id
└── created_at

monitoring_area_report (one per sub-area + finding)
├── id
├── area_report_id       → FK to report_areas
├── sub_area_id
├── finding_id
├── severity
├── actions_area_report_id → FK to actions_area_report (link to action)
└── created_at

monitoring_treatments (one per treatment recommendation)
├── id
├── monitoring_report_id → FK to monitoring_area_report
├── material_id
├── dosage
├── unit_type_id
├── action_type_id
├── status               → 'pending' (default), synced once on action creation
├── action_treatment_id  → FK to action_treatments (link to action)
├── notes
└── created_at

actions_area_report (one per sub-area + finding)
├── id
├── area_report_id       → FK to report_areas
├── sub_area_id
├── finding_id
├── severity
└── created_at

action_treatments (one per treatment performed)
├── id
├── action_report_id     → FK to actions_area_report
├── material_id
├── dosage
├── unit_type_id
├── action_type_id
├── status               → 'pending', 'planned', 'in_progress', 'completed'
├── action_time
├── notes
└── created_at
```

### 1.3 Current Linking Mechanism

Two levels of linking between monitoring and actions:

```
Report level:
  monitoring_area_report.actions_area_report_id  →  actions_area_report.id

Treatment level:
  monitoring_treatments.action_treatment_id  →  action_treatments.id
```

One action form submission can:
- Process multiple monitoring reports (from the same area)
- Add standalone entries (sub-area + finding + treatments not tied to monitoring)
- Add extra treatments to monitoring-sourced entries

### 1.4 Current Action Form Capabilities

| Feature | From Monitoring | Standalone |
|---------|----------------|------------|
| Sub-area | Read-only (from monitoring) | Worker picks from dropdown |
| Finding | Read-only (from monitoring) | Worker picks from dropdown |
| Severity | Pre-filled, editable | Worker selects |
| Treatments | Pre-filled from recommendations | Worker fills manually |
| Dosage | Pre-filled, can adjust | Worker fills manually |
| Material | Pre-filled, can adjust | Worker fills manually |
| Can add more treatments | Yes | Yes |

---

## 2. Problems with Current Design

### 2.1 UI Complexity

The ActionForm component is **1088 lines** with:
- 12 separate `useState` calls managing one logical unit
- Cascading API fetches (area → sub-areas + monitoring → action types → materials → dosage)
- Index-based state keys (`"2-1"` for entry 2, treatment 1) that break when entries are removed
- Default objects duplicated 4-5 times
- `any` types throughout — no type safety

**Impact on user:** The form is slow to load (many API calls), confusing to navigate, and errors are swallowed silently.

### 2.2 Status Fields Are Meaningless

| Field | What It Should Do | What It Actually Does |
|-------|-------------------|----------------------|
| `report_areas.status` | Track report completion | Set to `'pending'` on creation, **never updated** |
| `action_treatments.status` | Track treatment execution | Set by worker on creation, **never updated after** |
| `monitoring_treatments.status` | Track if recommendation was fulfilled | Synced **once** when action is created, **never updated after** |

There is no `UPDATE` endpoint for actions. Once created, statuses cannot change.

### 2.3 Unnecessary Status on Action Reports

If the action worker creates the report **after doing the work**, then the report itself IS the completion. The status field adds complexity with no value:
- No one manually tracks `planned → in_progress → completed`
- There's no UI to update status after creation
- The default `'pending'` on a report that records completed work is contradictory

### 2.4 No Transaction Safety

Creating an action report involves multiple sequential DB inserts:
1. Create/find `report_areas`
2. Create `actions_area_report`
3. Create each `action_treatment`
4. Update `monitoring_treatments.action_treatment_id`
5. Update `monitoring_area_report.actions_area_report_id`

If step 4 fails, steps 1-3 are already committed. No rollback. Inconsistent data.

### 2.5 No Big Picture Visibility

- No dashboard showing area health status
- No way to see which monitoring findings are still unaddressed
- No way for the customer to see the gap between what was found and what was done
- Workers can't see the impact of their work

### 2.6 Status Sync Is One-Time Only

The monitoring ↔ action status sync happens **only in the POST handler** when the action is created. If someone could later mark an action treatment as completed (they can't today, but might in the future), the monitoring treatment status would NOT update.

---

## 3. Proposed Redesign: Task-Based Actions

### 3.1 Core Idea

**Shift from "fill out a report form" to "check off tasks."**

When an inspector creates a monitoring report with treatment recommendations, the system automatically generates **action tasks**. The action worker sees a simple task list and confirms what they did — instead of re-entering data into a complex form.

### 3.2 New Workflow

```
STEP 1: Inspector creates monitoring report (no change)
  ├── Selects area, sub-areas, findings
  ├── Recommends treatments (material, dosage, action type)
  └── Saves report

STEP 2: System auto-generates action tasks
  ├── One task per monitoring_treatment
  ├── Task contains: sub-area, finding, recommended treatment
  └── Tasks are visible immediately to action workers

STEP 3: Action worker opens task list (NEW — replaces complex form)
  ├── Sees all pending tasks for their areas
  ├── Grouped by area → sub-area
  ├── Each task shows the recommendation
  └── Worker acts:
      ├── [✓ בוצע] — Done (one tap, saves with recommended values)
      ├── [✏️ בוצע עם שינויים] — Done with changes (adjust dosage/material/notes)
      └── [➕ הוסף פעולה] — Add standalone action (not from monitoring)

STEP 4: Status is derived, not entered
  ├── Task has action_treatment_id? → Done ✅
  ├── Task has NO action_treatment_id? → Pending ⏳
  └── Area status = calculated from task completion ratio
```

### 3.3 What This Changes for Each Role

#### Action Worker (before vs. after)

**Before:**
1. Open action form
2. Select customer (if admin)
3. Select area
4. Wait for monitoring data to load (multiple API calls)
5. Review auto-populated entries
6. Scroll through complex form with nested treatments
7. Fill status for each treatment
8. Submit batch

**After:**
1. Open task list → see all pending tasks for their areas
2. Tap "בוצע" on each completed task
3. If something changed, tap "בוצע עם שינויים" and adjust
4. If they did extra work, tap "הוסף פעולה"
5. Done

#### Inspector (before vs. after)

**Before:** No visibility into whether recommendations were followed.

**After:** Can see on each monitoring report which treatments were executed and which are still pending.

#### Customer/Manager (before vs. after)

**Before:** No dashboard, no visibility.

**After:** Area status board showing health at a glance (see section 3.7).

### 3.4 Database Changes

#### Remove

- `action_treatments.status` — not needed. Existence of the record = completed.
- `report_areas.status` — not needed. Derived from data.
- `monitoring_treatments.status` — not needed. Has `action_treatment_id`? = done. Doesn't? = pending.

#### Keep As-Is

- `report_areas` table (container for reports)
- `monitoring_area_report` + `monitoring_treatments` (monitoring side unchanged)
- `actions_area_report` + `action_treatments` (action records still created)
- `monitoring_area_report.actions_area_report_id` (report-level link)
- `monitoring_treatments.action_treatment_id` (treatment-level link)

#### Add

- `action_treatments.notes` — already exists, keep for "done with changes" comments
- `action_treatments.action_time` — already exists, keep for when action was performed
- Consider: `action_treatments.deviation_reason` — optional field explaining why the worker deviated from the recommendation

#### Status Derivation Logic (no columns needed)

```sql
-- Is a monitoring treatment fulfilled?
-- YES if: monitoring_treatments.action_treatment_id IS NOT NULL
-- NO  if: monitoring_treatments.action_treatment_id IS NULL

-- Area status (query, not stored):
SELECT
  a.id,
  a.name,
  COUNT(mt.id) as total_treatments,
  COUNT(mt.action_treatment_id) as completed_treatments,
  CASE
    WHEN COUNT(mt.id) = 0 THEN 'no_monitoring'
    WHEN COUNT(mt.action_treatment_id) = COUNT(mt.id) THEN 'all_done'
    WHEN COUNT(mt.action_treatment_id) > 0 THEN 'partial'
    ELSE 'needs_action'
  END as derived_status
FROM areas a
LEFT JOIN report_areas ra ON ra.area_id = a.id AND ra.area_type_id = 'monitoring'
LEFT JOIN monitoring_area_report mar ON mar.area_report_id = ra.id
LEFT JOIN monitoring_treatments mt ON mt.monitoring_report_id = mar.id
GROUP BY a.id, a.name;
```

### 3.5 API Changes

#### New Endpoints

**`GET /api/action-tasks?areaId={areaId}&workerId={workerId}`**

Returns pending action tasks (monitoring treatments without linked action treatments).

```json
{
  "tasks": [
    {
      "monitoring_treatment_id": "mt-123",
      "monitoring_report_id": "mar-456",
      "sub_area": { "id": "sa-1", "name": "Block A", "display": "41-39 | ביגסן" },
      "finding": { "id": "f-1", "name": "כנימות" },
      "severity": "high",
      "recommendation": {
        "action_type": { "id": "at-1", "name": "ריסוס" },
        "material": { "id": "m-1", "name": "Pyrethrin" },
        "dosage": 100,
        "unit_type": { "id": "ut-1", "name": "מ\"ל" }
      },
      "monitoring_date": "2026-02-10T10:00:00Z"
    }
  ]
}
```

**`POST /api/action-tasks/complete`**

Complete one or more tasks. Simple payload:

```json
{
  "area_id": "area-123",
  "worker_id": "worker-456",
  "completed_tasks": [
    {
      "monitoring_treatment_id": "mt-123",
      "monitoring_report_id": "mar-456",
      "as_recommended": true
    },
    {
      "monitoring_treatment_id": "mt-124",
      "monitoring_report_id": "mar-456",
      "as_recommended": false,
      "material_id": "m-2",
      "dosage": 150,
      "unit_type_id": "ut-1",
      "action_type_id": "at-1",
      "notes": "הוגברה מינון בגלל נגיעות חמורה"
    }
  ],
  "standalone_actions": [
    {
      "sub_area_id": "sa-3",
      "finding_id": "f-5",
      "action_type_id": "at-2",
      "material_id": "m-3",
      "dosage": 50,
      "unit_type_id": "ut-1",
      "notes": "טיפול מונע"
    }
  ]
}
```

Behind the scenes, this endpoint:
1. Creates/finds `report_areas` (type='action')
2. Groups tasks by sub_area + finding → creates `actions_area_report` records
3. Creates `action_treatments` for each completed task
4. Updates `monitoring_treatments.action_treatment_id` to link them
5. Updates `monitoring_area_report.actions_area_report_id` to link reports
6. All in a **database transaction** (RPC function or Supabase transaction)

**`GET /api/areas/status?customerId={customerId}`**

Returns derived area status for dashboard:

```json
{
  "areas": [
    {
      "id": "area-1",
      "name": "שטח א",
      "status": "partial",
      "total_findings": 3,
      "completed_actions": 2,
      "pending_actions": 1,
      "last_monitoring": "2026-02-10T10:00:00Z",
      "last_action": "2026-02-11T14:00:00Z"
    }
  ]
}
```

#### Endpoints to Remove/Deprecate

| Current Endpoint | Action |
|-----------------|--------|
| `POST /api/actions` (batch format) | Replace with `POST /api/action-tasks/complete` |
| `POST /api/actions` (single format) | Replace with `POST /api/action-tasks/complete` |
| `GET /api/actions/form-data` | Replace with `GET /api/action-tasks` |
| `GET /api/monitoring/by-area-for-actions` | Logic moves into `GET /api/action-tasks` |
| `GET /api/cascade` | Keep — still needed for standalone actions |

### 3.6 UI Changes

#### Action Worker: Task List View (replaces ActionForm)

```
┌──────────────────────────────────────────────────┐
│  משימות פעולה                           [🔄 רענן] │
│                                                    │
│  ┌─ שטח א ──────────────────────────── 2 משימות ─┐│
│  │                                                ││
│  │  Block A / כנימות                    🔴 גבוהה  ││
│  │  ריסוס — Pyrethrin 100 מ"ל                     ││
│  │  ניטור: 10/02/2026                             ││
│  │  ┌──────────┐  ┌─────────────────────┐         ││
│  │  │  ✓ בוצע  │  │ ✏️ בוצע עם שינויים  │         ││
│  │  └──────────┘  └─────────────────────┘         ││
│  │                                                ││
│  │  Block B / עובש                      🟡 בינונית ││
│  │  ריסוס — Fungicide 50 מ"ל                      ││
│  │  ניטור: 10/02/2026                             ││
│  │  ┌──────────┐  ┌─────────────────────┐         ││
│  │  │  ✓ בוצע  │  │ ✏️ בוצע עם שינויים  │         ││
│  │  └──────────┘  └─────────────────────┘         ││
│  │                                                ││
│  └────────────────────────────────────────────────┘│
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  ➕ הוסף פעולה שאינה קשורה לניטור             │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │            💾 שמור את כל הפעולות               │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

#### "Done with changes" — Inline Edit (expands below the task)

```
│  Block A / כנימות                       🔴 גבוהה  │
│  ריסוס — Pyrethrin 100 מ"ל (מומלץ)                │
│  ┌──────────────────────────────────────────────┐  │
│  │  חומר:   [Pyrethrin      ▾]                  │  │
│  │  מינון:  [150          ]  [מ"ל  ▾]           │  │
│  │  הערות:  [הוגברה מינון בגלל נגיעות חמורה  ]  │  │
│  │                            ┌──────────┐      │  │
│  │                            │  ✓ אישור │      │  │
│  │                            └──────────┘      │  │
│  └──────────────────────────────────────────────┘  │
```

#### Standalone Action — Simple Form (expands below "הוסף פעולה")

```
│  ┌──────────────────────────────────────────────┐  │
│  │  פעולה נוספת                                  │  │
│  │  תת-שטח: [Block C        ▾]                  │  │
│  │  ממצא:   [עכברים         ▾]                  │  │
│  │  סוג:    [מלכודות        ▾]                  │  │
│  │  חומר:   [               ▾]                  │  │
│  │  מינון:  [             ]  [         ▾]       │  │
│  │  הערות:  [טיפול מונע                       ] │  │
│  │                            ┌──────────┐      │  │
│  │                            │  ✓ הוסף  │      │  │
│  │                            └──────────┘      │  │
│  └──────────────────────────────────────────────┘  │
```

### 3.7 Comparison: Current vs. Proposed

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Worker experience** | Complex form, 10+ fields, cascading dropdowns | Task list, one tap per task |
| **Status tracking** | Manual, half-implemented, never updated | Derived automatically from links |
| **API calls on load** | 6+ cascading fetches | 1 call to get task list |
| **Form component** | 1088 lines, 12 state variables | ~200-300 lines estimated |
| **Transaction safety** | None (sequential inserts) | DB transaction (all or nothing) |
| **Monitoring-action gap** | Not visible | Clearly visible (pending tasks) |
| **Standalone actions** | Supported | Supported (add action button) |
| **Type safety** | `any` everywhere | Proper TypeScript types |

---

## 4. Future Improvements

These are ideas to implement **after** the task-based redesign is working.

### 4.1 Idea: Derived Area Status Dashboard

A visual board for customers and managers showing the health of all their areas at a glance.

```
┌──────────────────────────────────────────────────┐
│  לוח בקרת שטחות                                   │
│                                                    │
│  שטח א                          שטח ב             │
│  ┌────────────┐                 ┌────────────┐     │
│  │ 🟡 בטיפול  │                 │ 🔴 דורש טיפול│     │
│  │ 3 ממצאים   │                 │ 2 ממצאים   │     │
│  │ 2 טופלו ╱ 1 ממתין           │ 0 טופלו    │     │
│  │ ניטור: לפני 2 ימים          │ ניטור: לפני 5 ימים│
│  └────────────┘                 └────────────┘     │
│                                                    │
│  שטח ג                          שטח ד             │
│  ┌────────────┐                 ┌────────────┐     │
│  │ 🟢 טופל    │                 │ ⚪ לא נבדק  │     │
│  │ 4 ממצאים — הכל טופל          │              │     │
│  │ ניטור: לפני יום              │ אין ניטור    │     │
│  └────────────┘                 └────────────┘     │
└──────────────────────────────────────────────────┘
```

Status logic:
- 🟢 **טופל** (Done) — all monitoring treatments have linked actions
- 🟡 **בטיפול** (In progress) — some treatments done, some pending
- 🔴 **דורש טיפול** (Needs action) — monitoring exists, no actions yet
- ⚪ **לא נבדק** (Not inspected) — no monitoring reports

### 4.2 Idea: Area Drill-Down Timeline

Clicking an area shows a timeline of monitoring → action per sub-area:

```
שטח א — פירוט

Block A / כנימות
├── 🔍 ניטור: 10/02 — Pyrethrin 100 מ"ל (מומלץ)
└── ✅ פעולה: 11/02 — Pyrethrin 150 מ"ל (בוצע עם שינויים)

Block B / עובש
├── 🔍 ניטור: 10/02 — Fungicide 50 מ"ל (מומלץ)
└── ⏳ ממתין לפעולה

Block C / עכברים
└── 🔧 פעולה: 11/02 — מלכודות (פעולה עצמאית)
```

### 4.3 Idea: Worker Impact View

Show action workers the impact of their work:

```
הפעולות שלי — השבוע

✅ 12 משימות הושלמו
📊 4 שטחות טופלו
🔧 2 פעולות עצמאיות

שטח א: 3/3 ✅
שטח ב: 2/4 🟡
שטח ג: 4/4 ✅
```

### 4.4 Idea: Inspector Follow-up View

Show inspectors whether their recommendations were followed:

```
המלצות שלי — מעקב

שטח א (ניטור: 10/02)
├── כנימות → ✅ בוצע (11/02) — מינון הוגבר ל-150 מ"ל
└── עובש → ⏳ ממתין

שטח ב (ניטור: 08/02)
├── זבוב לבן → ✅ בוצע (09/02)
└── קרדית → ✅ בוצע (09/02)
```

---

## 5. Implementation Plan

### Phase 1: Task-Based Action System (Start Here)

#### Step 1: New API Endpoints

1. Create `GET /api/action-tasks` endpoint
   - Fetches monitoring treatments without linked action treatments
   - Joins sub-area, finding, material, action type data
   - Filters by area and/or worker's customer
   - Returns flat task list

2. Create `POST /api/action-tasks/complete` endpoint
   - Accepts completed tasks + standalone actions
   - Wraps all operations in a DB transaction (Supabase RPC or sequential with error handling)
   - Creates action records and links back to monitoring
   - Returns success/failure

3. Create `GET /api/areas/status` endpoint
   - Returns derived status per area
   - Counts total vs. completed treatments
   - Used by dashboard (future) and task list grouping

#### Step 2: New UI — Task List Component

1. Create `ActionTaskList` component (replaces `ActionForm`)
   - Fetches tasks from `GET /api/action-tasks`
   - Groups by area → sub-area
   - Shows recommendation details per task
   - "בוצע" button for one-tap completion
   - "בוצע עם שינויים" expands inline edit
   - "הוסף פעולה" for standalone actions

2. Create `TaskCard` component
   - Displays one task: sub-area, finding, severity, recommendation
   - Action buttons: done / done with changes
   - Inline edit form for modifications

3. Create `StandaloneActionForm` component
   - Simple form for non-monitoring actions
   - Sub-area, finding, action type, material, dosage, notes
   - Uses existing cascade API for dropdowns

#### Step 3: Remove Status Columns (Migration)

1. Create migration to:
   - Remove `action_treatments.status` column
   - Remove `monitoring_treatments.status` column
   - Remove `report_areas.status` column
2. Update TypeScript types in `types/database.ts`
3. Remove status-related code from existing API routes

#### Step 4: Clean Up

1. Deprecate old `POST /api/actions` endpoint (keep temporarily for backward compatibility)
2. Remove or simplify `ActionForm.tsx` (1088 lines → removed)
3. Remove `GET /api/actions/form-data` endpoint
4. Remove `GET /api/monitoring/by-area-for-actions` (logic absorbed into new endpoint)
5. Remove legacy single-treatment format support from all endpoints

### Phase 2: Dashboard (Future)

- Area status board with derived status
- Drill-down timeline per area
- Worker impact view
- Inspector follow-up view

### Phase 3: Notifications (Future)

- Alert when new monitoring creates tasks
- Reminder for tasks pending > X days
- Summary email for customers

---

## Appendix: Database Relationship Diagram

```
┌─────────────┐       ┌──────────────────────┐       ┌──────────────────┐
│   areas      │──────▶│    report_areas       │       │    workers        │
│             │       │                      │◀──────│                  │
│ id          │       │ id                   │       │ id               │
│ name        │       │ area_id              │       │ name             │
│             │       │ area_type_id         │       │ worker_type      │
└─────────────┘       │ worker_id            │       │ customer_id      │
      │               │ report_number        │       └──────────────────┘
      │               └──────────────────────┘
      │                    │              │
      │                    │              │
      ▼                    ▼              ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  sub_areas    │  │ monitoring_area_ │  │ actions_area_    │
│              │  │ report           │  │ report           │
│ id           │◀─│                  │  │                  │
│ area_id      │  │ id               │  │ id               │
│ name         │  │ area_report_id   │  │ area_report_id   │
│ variety      │  │ sub_area_id      │──│ sub_area_id      │
│ crop_id      │  │ finding_id       │  │ finding_id       │
└──────────────┘  │ severity         │  │ severity         │
                  │ actions_area_    │─▶│                  │
                  │   report_id      │  └──────────────────┘
                  └──────────────────┘           │
                           │                     │
                           ▼                     ▼
                  ┌──────────────────┐  ┌──────────────────┐
                  │ monitoring_      │  │ action_          │
                  │ treatments       │  │ treatments       │
                  │                  │  │                  │
                  │ id               │  │ id               │
                  │ monitoring_      │  │ action_          │
                  │   report_id      │  │   report_id      │
                  │ material_id      │  │ material_id      │
                  │ dosage           │  │ dosage           │
                  │ unit_type_id     │  │ unit_type_id     │
                  │ action_type_id   │  │ action_type_id   │
                  │ action_treatment_│─▶│ action_time      │
                  │   id (link)      │  │ notes            │
                  │ notes            │  │                  │
                  └──────────────────┘  └──────────────────┘

Links:
  monitoring_area_report.actions_area_report_id  →  actions_area_report.id
  monitoring_treatments.action_treatment_id      →  action_treatments.id
```

---

*This document will be updated as implementation progresses.*
