# Database Schema

## Overview

Area Control Loop database schema for pest management workflow:
**Monitoring → Analysis → Risk Assessment → Decision → Action → Reporting → Follow-up**

---

## Core Tables

### `customers`
**Description:** Organizations/companies using the system. Each customer owns areas and employs workers.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to auth.users (owner) |
| name | TEXT | Customer/organization name |
| description | TEXT | Additional details |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

### `workers`
**Description:** Employees who perform monitoring or action tasks. Each worker belongs to a customer and has a type (inspector/action_worker).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| customer_id | UUID | FK → customers |
| user_id | UUID | FK → auth.users |
| name | TEXT | Worker name |
| type_id | UUID | FK → worker_types |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

### `worker_types`
**Description:** Lookup table for worker roles. Values: 'inspector' (performs monitoring), 'action_worker' (performs treatments).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Type identifier (inspector/action_worker) |
| display_name | TEXT | Hebrew display name |
| description | TEXT | Role description |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

## Area Management

### `areas`
**Description:** Main agricultural areas/fields. Each area can have a default crop and contains multiple sub-areas.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Area name |
| description | TEXT | Area description |
| crop_id | UUID | FK → crops (default crop) |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

### `sub_areas`
**Description:** Subdivisions within an area (rows, sections, beds). Supports hierarchical nesting via parent_sub_area_id.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| area_id | UUID | FK → areas |
| parent_sub_area_id | UUID | FK → sub_areas (for nesting) |
| level | INTEGER | Nesting level (0 = top level) |
| name | TEXT | Sub-area name |
| variety | TEXT | Plant variety |
| rows | TEXT | Row numbers/identifiers |
| display | TEXT | Display format |
| crop_id | UUID | FK → crops (override area crop) |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

### `customer_areas`
**Description:** Junction table linking customers to areas they manage. Enables multi-tenant access control.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| customer_id | UUID | FK → customers |
| area_id | UUID | FK → areas |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

## Report Structure

### `report_areas`
**Description:** Report container/header. Groups multiple monitoring or action entries into a single named report with auto-incrementing report_number.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| area_id | UUID | FK → areas |
| type | TEXT | Report type: 'monitoring' or 'action' |
| name | TEXT | Report name/title |
| description | TEXT | Report description |
| report_number | SERIAL | Auto-incrementing friendly number |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

### `monitoring_area_report`
**Description:** Monitoring entries within a report. Each row represents a finding in a specific sub-area. One report can have multiple entries. Treatments are stored in the `monitoring_treatments` table.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| area_report_id | UUID | FK → report_areas |
| sub_area_id | UUID | FK → sub_areas |
| finding_id | UUID | FK → findings |
| actions_area_report_id | UUID | FK → actions_area_report (linked action) |
| status | TEXT | Status: pending/in_progress/completed |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Unique Constraint:** (area_report_id, sub_area_id, finding_id)

---

### `actions_area_report`
**Description:** Action entries within a report. Each row represents an action performed in a specific sub-area for a finding. Treatments are stored in the `action_treatments` table.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| area_report_id | UUID | FK → report_areas |
| sub_area_id | UUID | FK → sub_areas |
| finding_id | UUID | FK → findings |
| status | TEXT | Status: planned/in_progress/completed |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Unique Constraint:** (area_report_id, sub_area_id, finding_id)

---

## Treatment Tables

### `monitoring_treatments`
**Description:** Recommended treatments for a monitoring finding. Multiple treatments can be recommended per finding.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| monitoring_report_id | UUID | FK → monitoring_area_report |
| material_id | UUID | FK → materials |
| dosage | NUMERIC | Recommended dosage amount |
| unit_type_id | UUID | FK → unit_types |
| action_type_id | UUID | FK → action_types |
| status | TEXT | Status: pending/in_progress/completed |
| notes | TEXT | Treatment notes |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

### `action_treatments`
**Description:** Actual treatments performed for an action report. Multiple treatments can be applied per action.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| action_report_id | UUID | FK → actions_area_report |
| material_id | UUID | FK → materials |
| dosage | NUMERIC | Applied dosage amount |
| unit_type_id | UUID | FK → unit_types |
| action_type_id | UUID | FK → action_types |
| status | TEXT | Status: pending/in_progress/completed |
| notes | TEXT | Treatment notes |
| action_time | TIMESTAMPTZ | When treatment was applied |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

## Lookup Tables

### `findings`
**Description:** Types of pest/disease findings that can be recorded during monitoring.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Finding identifier |
| description | TEXT | Hebrew description |
| severity | TEXT | Severity level |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

### `action_types`
**Description:** Types of actions that can be performed (spray, biological control, etc.).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Action identifier |
| description | TEXT | Hebrew description |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

### `materials`
**Description:** Chemicals, biological agents, or other materials used in treatments.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Material name |
| description | TEXT | Material description |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

### `unit_types`
**Description:** Units of measurement for dosages (liter/dunam, kg/hectare, etc.).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Unit identifier |
| description | TEXT | Hebrew description |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

### `crops`
**Description:** Crop types grown in areas.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Crop identifier |
| description | TEXT | Hebrew description |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

### `crop_findings`
**Description:** Junction table linking crops to their common findings/pests.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| crop_id | UUID | FK → crops |
| finding_id | UUID | FK → findings |
| created_at | TIMESTAMPTZ | Creation timestamp |

---

### `recommend_material`
**Description:** Recommended material/dosage combinations for specific crop + action_type. Used for auto-suggestions in the UI.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| crop_id | UUID | FK → crops |
| action_type_id | UUID | FK → action_types |
| material_id | UUID | FK → materials |
| unit_type_id | UUID | FK → unit_types |
| dosage | NUMERIC | Recommended dosage |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

## Authorization Tables

### `roles`
**Description:** User roles for access control.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Role identifier (admin, user) |
| display_name | TEXT | Hebrew display name |
| description | TEXT | Role description |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

### `user_roles`
**Description:** Junction table assigning roles to users.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK → auth.users |
| role_id | UUID | FK → roles |
| created_at | TIMESTAMPTZ | Creation timestamp |

**Unique Constraint:** (user_id, role_id)

---

### `invitations`
**Description:** Pending invitations for new users to join the system.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| invitation_type | TEXT | Type of invitation |
| invited_by_user_id | UUID | FK → auth.users |
| invited_user_id | UUID | FK → auth.users (when accepted) |
| customer_id | UUID | FK → customers |
| email | TEXT | Invited email |
| name | TEXT | Invited person name |
| worker_type_id | UUID | FK → worker_types |
| token | TEXT | Unique invitation token |
| status | TEXT | pending/accepted/expired |
| expires_at | TIMESTAMPTZ | Expiration timestamp |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

---

## Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  customers   │────<│   workers    │>────│ worker_types │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       │ customer_areas
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    areas     │────<│  sub_areas   │     │    crops     │
└──────────────┘     └──────────────┘     └──────────────┘
       │                                         │
       │                                         │ crop_findings
       ▼                                         ▼
┌──────────────┐                          ┌──────────────┐
│ report_areas │                          │   findings   │
│ (container)  │                          └──────────────┘
└──────────────┘
       │
       ├────────────────────────┐
       ▼                        ▼
┌──────────────────┐    ┌──────────────────┐
│monitoring_area_  │    │ actions_area_    │
│     report       │    │     report       │
└──────────────────┘    └──────────────────┘
       │                        │
       ▼                        ▼
┌──────────────────┐    ┌──────────────────┐
│  monitoring_     │    │   action_        │
│  treatments      │    │  treatments      │
└──────────────────┘    └──────────────────┘
       │                        │
       ▼                        ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  materials   │  │ action_types │  │  unit_types  │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Report Hierarchy Example

```
Report #15 (report_areas)
├── name: "ניטור חודשי ינואר 2026"
├── type: "monitoring"
├── area: "חממה A"
│
└── monitoring_area_report entries:
    │
    ├── [sub_area: "שורה 1", finding: "כנימות"]
    │   └── monitoring_treatments:
    │       ├── treatment 1: ריסוס, קונפידור, 0.5 ליטר/דונם, completed
    │       └── treatment 2: הדברה ביולוגית, טריכודרמה, 1.0, pending
    │
    ├── [sub_area: "שורה 1", finding: "עכביש אדום"]
    │   └── monitoring_treatments:
    │       └── treatment 1: ריסוס, אבמקטין, 0.3 ליטר/דונם, pending
    │
    └── [sub_area: "שורה 2", finding: "אין ממצאים"]
        └── monitoring_treatments: (none)
```
