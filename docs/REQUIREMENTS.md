# Requirements Document: Pest Management Application

## 1. Overview

This document defines the requirements for migrating the existing Google Apps Script pest management application to a modern Next.js + Supabase + shadcn/ui stack. The application manages pest supervision and spray operations for agricultural plots.

## 2. Core Entities

### 2.1 Customers and Workers (לקוחות ועובדים)
**Source:** Google Sheet `עובדים` (migrated to customers and workers tables)
- **Customers (לקוחות):**
  - `user_id` - Reference to admin user who owns/manages the customer (UUID, Foreign Key to `auth.users.id`)
  - `name` (שם) - Customer name (String) - represents company/organization
  - `description` - Customer description (String, optional)
- **Workers (עובדים):**
  - `customer_id` - Reference to parent customer (UUID, Foreign Key to `customers.id`)
  - `user_id` - Reference to Supabase Auth user (UUID, Foreign Key to `auth.users.id`)
  - `name` (שם) - Worker name (String)
  - `type` (סוג) - Worker type: `'פקח'` (Inspector) or `'רסס'` (Sprayer)
- **Customer Invitations (הזמנות לקוחות):**
  - `invited_by_user_id` - Reference to admin user who sent the invitation (UUID, Foreign Key to `auth.users.id`)
  - `email` - Invitee email address (String, required)
  - `name` - Customer name (String, required)
  - `token` - Unique invitation token (String, auto-generated)
  - `status` - Invitation status: `'pending'`, `'accepted'`, `'expired'`, `'cancelled'`
  - `expires_at` - Expiration timestamp (default: 7 days from creation)
- **Business Rules:**
  - Each customer is linked to one admin user (one-to-one relationship via `user_id`)
  - Only admin users can invite new customers (via `customer_invitations`)
  - Each customer can have multiple workers (one-to-many relationship)
  - Each worker must be linked to an authenticated user (`auth.users`)
  - Each worker belongs to one customer
  - Workers are filtered by type to populate form dropdowns
  - Inspectors (type='פקח') are used in Supervision Form
  - Sprayers (type='רסס') are used in Spray Form
  - One-to-one relationship between workers and `auth.users` (each worker has one auth user)

### 2.2 Areas and Sub-Areas (נורמליזציה)
**Source:** Google Sheet `חלקות-זנים` (normalized into separate tables)
- **Areas (אזורים):**
  - `name` - Area name (String)
  - `description` - Area description (String, optional)
- **Sub-Areas (תת-אזורים):**
  - `area_id` - Reference to parent area (UUID)
  - `name` - Sub-area name (String)
  - `variety` (זן) - Variety name (String)
  - `rows` (שורות) - Row numbers/range (String, can be Date formatted as dd/MM/yyyy)
  - `display` (תצוגה) - Display value for UI (String, optional)
- **Report Areas (אזורי דוחות):**
  - `area_id` - Reference to parent area (UUID)
  - `name` - Report area name (String)
  - `description` - Report area description (String, optional)
- **Junction Tables:**
  - `pest_monitoring_report` - Links sub-areas to pest monitoring reports (common fields: `id`, `area_report_id`, `sub_area_id`)
  - `pest_monitoring_actions_report` - Links sub-areas to pest monitoring actions reports (common fields: `id`, `area_report_id`, `sub_area_id`)
- **Customer Areas (אזורי לקוחות):**
  - `customer_id` - Reference to customer (UUID)
  - `area_id` - Reference to area (UUID)
  - Junction table linking customers to areas (many-to-many)
- **Business Rules:**
  - Each customer can have access to multiple areas (many-to-many via `customer_areas`)
  - Areas contain multiple sub-areas
  - Report areas are associated with areas
  - Sub-areas can be linked to supervision or spray reports via junction tables
  - Display format: `"rows | variety"` (e.g., "41-39 | ביגסן")
  - If display is empty, fallback to rows, then variety
  - Date values in rows column are formatted as dd/MM/yyyy

### 2.3 Spray Materials (סוג ריסוס)
**Source:** Google Sheet `סוג ריסוס`
- **Fields:**
  - `spray_type` (סוג ריסוס) - Type of spray (String)
  - `material` (חומר) - Material name (String)
  - `dosage` (מינון) - Dosage amount (String)
- **Business Rules:**
  - Used in Supervision Form for each section
  - Materials are filtered by selected spray type

### 2.4 Worker Invitations (הזמנות עובדים)
**Purpose:** Allow customers to invite new workers to join their organization.

- **Fields:**
  - `customer_id` - Reference to customer sending invitation (UUID)
  - `email` - Invitee email address (String, required)
  - `name` - Worker name (String, required)
  - `type` - Worker type: `'פקח'` (Inspector) or `'רסס'` (Sprayer)
  - `token` - Unique invitation token (String, auto-generated)
  - `status` - Invitation status: `'pending'`, `'accepted'`, `'expired'`, `'cancelled'`
  - `expires_at` - Expiration timestamp (default: 7 days from creation)
  - `invited_by` - Reference to worker who sent the invitation (UUID, optional)

- **Business Rules:**
  - Only authenticated workers of a customer can send invitations for that customer
  - Each invitation has a unique token (UUID-based)
  - Invitations expire after 7 days (configurable)
  - Email addresses must be unique per pending invitation for the same customer
  - Cannot invite an email that already has a worker account in the system
  - When invitation is accepted:
    - Creates a new auth user account with the provided email and password
    - Creates a worker record linked to the customer
    - Updates invitation status to 'accepted'
  - Invitations can be cancelled by any worker of the customer
  - Expired invitations are automatically marked as 'expired' (via scheduled job or on access)
  - Invitation email contains:
    - Customer name
    - Worker name and type
    - Invitation link with token
    - Expiration date

- **Workflow:**
  1. Customer worker sends invitation via UI
  2. System generates unique token and expiration date
  3. Invitation email sent to invitee
  4. Invitee clicks link and lands on acceptance page
  5. Invitee provides password to create account
  6. System creates auth user and worker record
  7. Invitee can now log in and access the system

### 2.5 Customer Invitations (הזמנות לקוחות)
**Purpose:** Allow admin users to invite new customers to join the system.

- **Fields:**
  - `invited_by_user_id` - Reference to admin user sending invitation (UUID, Foreign Key to `auth.users.id`)
  - `email` - Invitee email address (String, required)
  - `name` - Customer name (String, required)
  - `token` - Unique invitation token (String, auto-generated)
  - `status` - Invitation status: `'pending'`, `'accepted'`, `'expired'`, `'cancelled'`
  - `expires_at` - Expiration timestamp (default: 7 days from creation)

- **Business Rules:**
  - Only admin users can send customer invitations
  - Each invitation has a unique token (UUID-based)
  - Invitations expire after 7 days (configurable)
  - Email addresses must be unique per pending invitation
  - Cannot invite an email that already has a customer account
  - When invitation is accepted:
    - Creates a new auth user account with the provided email and password
    - Creates a customer record linked to the new user
    - Updates invitation status to 'accepted'
  - Invitations can be cancelled by any admin user
  - Expired invitations are automatically marked as 'expired' (via scheduled job or on access)
  - Invitation email contains:
    - Customer name
    - Invitation link with token
    - Expiration date

- **Workflow:**
  1. Admin user sends customer invitation via UI
  2. System validates admin role
  3. System generates unique token and expiration date
  4. Invitation email sent to invitee
  5. Invitee clicks link and lands on acceptance page
  6. Invitee provides password to create account
  7. System creates auth user and customer record (linked via user_id)
  8. Invitee can now log in and manage their customer account

## 3. Forms

### 3.1 Supervision Form (טופס פיקוח)

**Purpose:** Record pest supervision inspections with multiple spray details per submission.

**Fields:**
- `inspector` (שם הפקח) - Required, dropdown from workers with type `'פקח'`
- `plot` (חלקה) - Required, dropdown from unique plot names (now uses areas/sub-areas)
- `sections[]` - Dynamic array of detail sections, each containing:
  - `variety` (זן) - Dropdown filtered by selected plot, displays as "rows | variety"
  - `sprayType` (סוג ריסוס) - Dropdown from spray types
  - `material` (חומר) - Dropdown filtered by selected spray type
  - `dosage` (מינון) - Text input

**Business Rules:**
- User can add/remove detail sections dynamically
- At least one section must be fully filled (variety/rows, sprayType, material, dosage)
- Variety selection is parsed to extract `rows` and `variety` separately
- Format: "rows | variety" or just rows/variety
- If variety contains numbers/dashes/commas, it's treated as rows

**Data Structure (One row per section):**
```javascript
{
  id: number,              // Sequential, auto-generated
  status: string,          // Default: "פתוח"
  key: string,            // Timestamp (same for all rows from same submission)
  createdDate: string,    // Format: "dd/MM/yyyy HH:mm:ss"
  inspector_id: uuid,     // Customer ID (type='פקח')
  pest_monitoring_report_id: uuid, // Reference to pest_monitoring_report junction table
  rows: string,           // Extracted from sub_area
  variety: string,        // Extracted from sub_area
  sprayType: string,      // Selected spray type
  material: string,       // Selected material
  dosage: string          // Dosage value
}
```

**Validation:**
- Inspector and plot are required
- At least one section must have: (rows OR variety) AND sprayType AND material AND dosage
- Empty sections are ignored

### 3.2 Spray Form (טופס ריסוס)

**Purpose:** Record spray operations (simpler form, one row per submission).

**Fields:**
- `sprayer` (שם הרסס) - Required, dropdown from workers with type `'רסס'`
- `plot` (חלקה) - Required, dropdown from unique plot names (now uses areas/sub-areas)

**Data Structure (One row per submission):**
```javascript
{
  id: number,              // Sequential, auto-generated
  status: string,          // Default: "פתוח"
  key: string,            // Timestamp (unique per submission)
  createdDate: string,    // Format: "dd/MM/yyyy HH:mm:ss"
  sprayer_id: uuid,       // Worker ID (type='רסס')
  pest_monitoring_actions_report_id: uuid // Reference to pest_monitoring_actions_report junction table
}
```

**Validation:**
- Both sprayer and plot are required

## 4. Data Storage

### 4.1 Supervision Results (פיקוח מזיקים תוצאות)
**Target:** External Google Spreadsheet (ID: `1uf1p-1tVaHi1dv1B-v-e-MQ5H_mYWEQgHnLnJoiLppg`)
**Sheet Name:** `פיקוח מזיקים תוצאות`

**Columns:**
1. `ID` - Sequential number (auto-generated)
2. `סטטוס` - Status (default: "פתוח")
3. `מפתח` - Key (timestamp, groups related rows)
4. `תאריך יצירה` - Created date (dd/MM/yyyy HH:mm:ss)
5. `שם הפקח` - Inspector name
6. `חלקה` - Plot name
7. `שורות` - Rows
8. `זן` - Variety
9. `סוג ריסוס` - Spray type
10. `חומר` - Material
11. `מינון` - Dosage

### 4.2 Spray Results (ריסוס תוצאות)
**Target:** External Google Spreadsheet (ID: `1GUDjmcQTlHoMYhu6A3e3_N2noJQ-DAUDYNe518xk33k`)
**Sheet Name:** `ריסוס תוצאות`

**Columns:**
1. `ID` - Sequential number (auto-generated)
2. `סטטוס` - Status (default: "פתוח")
3. `מפתח` - Key (timestamp)
4. `תאריך יצירה` - Created date (dd/MM/yyyy HH:mm:ss)
5. `שם הרסס` - Sprayer name
6. `חלקה` - Plot name

## 5. Business Logic

### 5.1 ID Generation
- Sequential, auto-incrementing
- Generated server-side when saving data
- Starts from 1 (or continues from last ID in database)

### 5.2 Key Generation
- Timestamp-based (milliseconds since epoch)
- Same `key` value for all rows from the same form submission
- Used to group related entries

### 5.3 Status Management
- Default status: `"פתוח"` (Open)
- Can be updated later (future enhancement)

### 5.4 Date Formatting
- Format: `"dd/MM/yyyy HH:mm:ss"`
- Example: `"15/03/2024 14:30:45"`
- Generated at submission time

### 5.5 Data Caching
- Frontend caches reference data (workers, plots, varieties, spray materials) on page load
- Reduces API calls and improves performance
- Cache is refreshed on form load

## 6. User Interface

### 6.1 Navigation
- Mobile-style hamburger menu
- Menu items:
  - "טופס פיקוח" (Supervision Form) - Default route
  - "דוח ריסוס" (Spray Report/Form) - Route: `?form=spray`
- RTL (right-to-left) layout for Hebrew content

### 6.2 Form Features
- Dynamic section addition/removal (Supervision Form only)
- Real-time validation
- Loading states during submission
- Success/error messages
- Form reset after successful submission (2-3 second delay)

### 6.3 Responsive Design
- Mobile-first approach
- Works on desktop and mobile devices
- Touch-friendly interface

## 7. Email Notifications

### 7.1 Supervision Form Submission
**Recipient:** `anyradios@gmail.com`
**Subject:** `טופס ריסוס חדש - פקח: {inspector}, חלקה: {plot}`
**Content:**
- Number of rows added
- Created date
- Inspector name
- Plot name
- Row number
- Key
- Section details (rows, variety, sprayType, material, dosage)
- Link to spreadsheet

### 7.2 Spray Form Submission
**Recipient:** `anyradios@gmail.com`
**Subject:** `טופס ריסוס חדש - רסס: {sprayer}, חלקה: {plot}`
**Content:**
- Created date
- Sprayer name
- Plot name
- Row number
- Key
- Link to spreadsheet

## 8. Technical Requirements for Migration

### 8.1 Database Schema Diagram

#### Entity Relationship Diagram (ERD) - Improved Normalized Schema

```mermaid
erDiagram
    auth_users ||--o{ customers : "owns"
    auth_users ||--o{ workers : "authenticated_by"
    auth_users ||--o{ customer_invitations : "invites"
    customers ||--o{ workers : "has"
    customers ||--o{ worker_invitations : "invites"
    customers ||--o{ customer_areas : "owns"
    areas ||--o{ customer_areas : "belongs_to"
    workers ||--o{ supervision_results : "inspector"
    workers ||--o{ spray_results : "sprayer"
    areas ||--o{ sub_areas : "contains"
    areas ||--o{ report_areas : "has"
    sub_areas ||--o{ pest_monitoring_report : "belongs_to"
    sub_areas ||--o{ pest_monitoring_actions_report : "belongs_to"
    report_areas ||--o{ pest_monitoring_report : "reports"
    report_areas ||--o{ pest_monitoring_actions_report : "reports"
    pest_monitoring_report ||--o{ supervision_results : "references"
    pest_monitoring_actions_report ||--o{ spray_results : "references"
    spray_materials ||--o{ supervision_results : "spray_type, material"

    auth_users {
        uuid id PK "Supabase Auth User ID"
        text email
        text encrypted_password
        timestamptz created_at
        Note: "Admin users can invite customers"
    }

    customers {
        uuid id PK
        uuid user_id FK "References auth.users.id - customer owner/admin"
        text name "Customer name"
        text description
        timestamptz created_at
        timestamptz updated_at
    }

    customer_invitations {
        uuid id PK
        uuid invited_by_user_id FK "References auth.users.id (admin only)"
        text email "Invitee email"
        text name "Customer name"
        text token "Unique invitation token"
        text status "pending, accepted, expired, cancelled"
        timestamptz expires_at
        timestamptz created_at
        timestamptz updated_at
    }

    workers {
        uuid id PK
        uuid customer_id FK "References customers.id"
        uuid user_id FK "References auth.users.id"
        text name "Worker name"
        text type "פקח or רסס"
        timestamptz created_at
        timestamptz updated_at
    }

    customer_areas {
        uuid id PK
        uuid customer_id FK "References customers.id"
        uuid area_id FK "References areas.id"
        timestamptz created_at
        timestamptz updated_at
    }

    worker_invitations {
        uuid id PK
        uuid customer_id FK "References customers.id"
        text email "Invitee email"
        text name "Worker name"
        text type "פקח or רסס"
        text token "Unique invitation token"
        text status "pending, accepted, expired"
        timestamptz expires_at
        uuid invited_by FK "References workers.id (who sent invite)"
        timestamptz created_at
        timestamptz updated_at
    }

    areas {
        uuid id PK
        text name "Area name"
        text description
        timestamptz created_at
        timestamptz updated_at
    }

    sub_areas {
        uuid id PK
        uuid area_id FK "References areas.id"
        text name "Sub-area name"
        text variety "Variety name"
        text rows "Row numbers/range"
        text display "Display value"
        timestamptz created_at
        timestamptz updated_at
    }

    report_areas {
        uuid id PK
        uuid area_id FK "References areas.id"
        text name "Report area name"
        text description
        timestamptz created_at
        timestamptz updated_at
    }

    pest_monitoring_report {
        uuid id PK
        uuid area_report_id FK "References report_areas.id"
        uuid sub_area_id FK "References sub_areas.id"
        timestamptz created_at
        timestamptz updated_at
    }

    pest_monitoring_actions_report {
        uuid id PK
        uuid area_report_id FK "References report_areas.id"
        uuid sub_area_id FK "References sub_areas.id"
        timestamptz created_at
        timestamptz updated_at
    }

    spray_materials {
        uuid id PK
        text spray_type
        text material
        text dosage
        timestamptz created_at
        timestamptz updated_at
    }

    supervision_results {
        serial id PK
        text status "Default: פתוח"
        text key "Timestamp grouping"
        timestamptz created_date
        uuid inspector_id FK "References workers.id (type='פקח')"
        uuid pest_monitoring_report_id FK "References pest_monitoring_report.id"
        text rows "Extracted from sub_area"
        text variety "Extracted from sub_area"
        text spray_type "FK: spray_materials.spray_type"
        text material "FK: spray_materials.material"
        text dosage
        timestamptz created_at
        timestamptz updated_at
    }

    spray_results {
        serial id PK
        text status "Default: פתוח"
        text key "Timestamp"
        timestamptz created_date
        uuid sprayer_id FK "References workers.id (type='רסס')"
        uuid pest_monitoring_actions_report_id FK "References pest_monitoring_actions_report.id"
        timestamptz created_at
        timestamptz updated_at
    }
```

#### Table Relationships

**Reference Data Tables (Lookup):**
- `auth.users` - Supabase authentication users (managed by Supabase Auth)
- `customers` - Stores customer information (companies/organizations), linked to admin users
- `customer_invitations` - Stores pending customer invitations sent by admin users
- `workers` - Stores worker information with type (inspector/sprayer), belongs to customers, linked to auth users
- `worker_invitations` - Stores pending worker invitations sent by customers
- `areas` - Main areas (normalized from plots)
- `sub_areas` - Sub-areas within areas, containing variety and row information
- `report_areas` - Areas that reports are associated with
- `spray_materials` - Stores spray type, material, and dosage combinations

**Junction Tables (Many-to-Many Relationships):**
- `customer_areas` - Links customers to areas (many-to-many)
  - Common fields: `id`, `customer_id`, `area_id`
- `pest_monitoring_report` - Links sub-areas to pest monitoring reports
  - Common fields: `id`, `area_report_id`, `sub_area_id`
- `pest_monitoring_actions_report` - Links sub-areas to pest monitoring actions reports
  - Common fields: `id`, `area_report_id`, `sub_area_id`

**Results Tables (Transaction Data):**
- `supervision_results` - Stores supervision form submissions (one row per section)
- `spray_results` - Stores spray form submissions (one row per submission)

**Relationships:**
- `auth.users` has one-to-one relationship with `customers` (via `user_id`) - admin users own customers
- `auth.users` can send many `customer_invitations` (one-to-many via `invited_by_user_id`) - only admin users
- `auth.users` has one-to-one relationship with `workers` (via `user_id`)
- `customers` have many `workers` (one-to-many via `customer_id`)
- `customers` can send many `worker_invitations` (one-to-many via `customer_id`)
- `workers` can send invitations on behalf of their customer (via `invited_by`)
- `customers` have many `areas` (many-to-many via `customer_areas` junction table)
- `workers` belong to one `customer` and are linked to one authenticated user
- `areas` contains multiple `sub_areas`
- `areas` has multiple `report_areas`
- `pest_monitoring_report` links `report_areas` to `sub_areas` for pest monitoring operations
- `pest_monitoring_actions_report` links `report_areas` to `sub_areas` for pest monitoring actions operations
- `supervision_results.pest_monitoring_report_id` references `pest_monitoring_report.id`
- `supervision_results.inspector_id` references `workers.id` (where `workers.type = 'פקח'`)
- `supervision_results.spray_type` and `supervision_results.material` reference `spray_materials`
- `spray_results.pest_monitoring_actions_report_id` references `pest_monitoring_actions_report.id`
- `spray_results.sprayer_id` references `workers.id` (where `workers.type = 'רסס'`)

#### Visual Table Structure

```
┌─────────────────────┐
│    auth.users       │
├─────────────────────┤
│ id (UUID, PK)        │
│ email (TEXT)         │
│ encrypted_password   │
│ created_at          │
└─────────────────────┘
         │
         ├───(user_id)───┐
         │                │
         │ (user_id)      │
         ▼                │
┌─────────────────────┐   │
│     customers       │   │
├─────────────────────┤   │
│ id (UUID, PK)        │   │
│ user_id (FK)─────────┘   │
│ name (TEXT)          │   │
│ description (TEXT)   │   │
│ created_at          │   │
│ updated_at          │   │
└─────────────────────┘   │
         │                │
         │ (customer_id)   │
         ▼                │
┌─────────────────────┐   │
│      workers        │   │
├─────────────────────┤   │
│ id (UUID, PK)        │   │
│ customer_id (FK)─────┘   │
│ user_id (UUID, FK)───────┘
│ name (TEXT)          │
│ type (TEXT)          │
│ created_at          │
│ updated_at          │
└─────────────────────┘
         │
         │ (invited_by)
         ▼
┌─────────────────────┐
│customer_invitations│
├─────────────────────┤
│ id (UUID, PK)        │
│ invited_by_user_id───┘
│ email (TEXT)         │
│ name (TEXT)          │
│ token (TEXT)         │
│ status (TEXT)        │
│ expires_at           │
│ created_at          │
│ updated_at          │
└─────────────────────┘
         │                    │
         │ (customer_id)      │
         ▼                    │
┌─────────────────────┐      │
│   customer_areas    │      │
├─────────────────────┤      │
│ id (UUID, PK)        │      │
│ customer_id (FK)─────┘      │
│ area_id (FK)───────────────┼──┐
│ created_at          │      │  │
│ updated_at          │      │  │
└─────────────────────┘      │  │
                              │  │
┌─────────────────────┐      │  │
│ worker_invitations  │      │  │
├─────────────────────┤      │  │
│ id (UUID, PK)        │      │  │
│ customer_id (FK)─────┘      │  │
│ email (TEXT)         │      │  │
│ name (TEXT)          │      │  │
│ type (TEXT)          │      │  │
│ token (TEXT)         │      │  │
│ status (TEXT)        │      │  │
│ expires_at           │      │  │
│ invited_by (FK)──────┘      │  │
│ created_at          │      │  │
│ updated_at          │      │  │
└─────────────────────┘      │  │
                              │  │
┌─────────────────────┐      │  │
│       areas         │      │  │
├─────────────────────┤      │  │
│ id (UUID, PK)        │◄──────┘  │
│ name (TEXT)          │          │
│ description (TEXT)   │          │
│ created_at          │          │
│ updated_at          │          │
└─────────────────────┘          │
                                  │
┌─────────────────────┐   │
│       areas          │   │
├─────────────────────┤   │
│ id (UUID, PK)        │───┼──┐
│ name (TEXT)          │   │  │
│ description (TEXT)   │   │  │
│ created_at          │   │  │
│ updated_at          │   │  │
└─────────────────────┘   │  │
                          │  │
┌─────────────────────┐   │  │
│     sub_areas        │   │  │
├─────────────────────┤   │  │
│ id (UUID, PK)        │   │  │
│ area_id (UUID, FK)──┘   │  │
│ name (TEXT)          │   │  │
│ variety (TEXT)       │   │  │
│ rows (TEXT)          │   │  │
│ display (TEXT)       │   │  │
│ created_at          │   │  │
│ updated_at          │   │  │
└─────────────────────┘   │  │
                          │  │
┌─────────────────────┐   │  │
│   report_areas      │   │  │
├─────────────────────┤   │  │
│ id (UUID, PK)        │───┼──┼──┐
│ area_id (UUID, FK)──┘   │  │  │
│ name (TEXT)          │   │  │  │
│ description (TEXT)   │   │  │  │
│ created_at          │   │  │  │
│ updated_at          │   │  │  │
└─────────────────────┘   │  │  │
                          │  │  │
┌─────────────────────┐   │  │  │
│pest_monitoring_report│   │  │  │
├─────────────────────┤   │  │  │
│ id (UUID, PK)        │   │  │  │
│ area_report_id (FK)──┘   │  │  │
│ sub_area_id (FK)────┘   │  │  │
│ created_at          │   │  │  │
│ updated_at          │   │  │  │
└─────────────────────┘   │  │  │
                          │  │  │
┌─────────────────────┐   │  │  │
│  pest_monitoring_actions_report    │   │  │  │
├─────────────────────┤   │  │  │
│ id (UUID, PK)        │   │  │  │
│ area_report_id (FK)──┘   │  │  │
│ sub_area_id (FK)────┘   │  │  │
│ created_at          │   │  │  │
│ updated_at          │   │  │  │
└─────────────────────┘   │  │  │
                          │  │  │
┌─────────────────────┐   │  │  │
│  spray_materials    │   │  │  │
├─────────────────────┤   │  │  │
│ id (UUID, PK)        │   │  │  │
│ spray_type (TEXT)   │───┼──┼──┼──┐
│ material (TEXT)      │   │  │  │  │
│ dosage (TEXT)        │   │  │  │  │
│ created_at          │   │  │  │  │
│ updated_at          │   │  │  │  │
└─────────────────────┘   │  │  │  │
                          │  │  │  │
┌─────────────────────┐   │  │  │  │
│supervision_results  │   │  │  │  │
├─────────────────────┤   │  │  │  │
│ id (SERIAL, PK)     │   │  │  │  │
│ status (TEXT)        │   │  │  │  │
│ key (TEXT)          │   │  │  │  │
│ created_date        │   │  │  │  │
│ inspector_id (FK)────┘   │  │  │  │
│ pest_monitoring_report_id─┘  │  │  │
│ rows (TEXT)                │  │  │
│ variety (TEXT)             │  │  │
│ spray_type (TEXT)──────────┘  │  │
│ material (TEXT)───────────────┘  │
│ dosage (TEXT)
│ created_at
│ updated_at
└─────────────────────┘

┌─────────────────────┐
│   spray_results      │
├─────────────────────┤
│ id (SERIAL, PK)     │
│ status (TEXT)        │
│ key (TEXT)          │
│ created_date        │
│ sprayer_id (FK)─────┘
│ pest_monitoring_actions_report_id───┘
│ created_at
│ updated_at
└─────────────────────┘
```

### 8.2 Database Schema (Supabase/PostgreSQL)

#### Table: `customers`
```sql
-- Customers represent companies/organizations that own areas and have workers
-- Each customer is linked to an admin user who owns/manages the customer

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_name ON customers(name);
```

#### Table: `customer_invitations`
```sql
-- Table for managing customer invitations sent by admin users
-- Only admin users can invite new customers to join the system

CREATE TABLE customer_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invited_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_invitations_invited_by_user_id ON customer_invitations(invited_by_user_id);
CREATE INDEX idx_customer_invitations_email ON customer_invitations(email);
CREATE INDEX idx_customer_invitations_token ON customer_invitations(token);
CREATE INDEX idx_customer_invitations_status ON customer_invitations(status);
CREATE INDEX idx_customer_invitations_expires_at ON customer_invitations(expires_at);
```

#### Table: `workers`
```sql
-- Note: auth.users is managed by Supabase Auth and created automatically
-- Workers belong to customers and are linked to auth users for authentication

CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('פקח', 'רסס')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_workers_customer_id ON workers(customer_id);
CREATE INDEX idx_workers_user_id ON workers(user_id);
CREATE INDEX idx_workers_type ON workers(type);
CREATE INDEX idx_workers_name ON workers(name);
```

#### Table: `customer_areas`
```sql
-- Junction table linking customers to areas (many-to-many)
-- Each customer can have access to multiple areas

CREATE TABLE customer_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, area_id)
);

CREATE INDEX idx_customer_areas_customer_id ON customer_areas(customer_id);
CREATE INDEX idx_customer_areas_area_id ON customer_areas(area_id);
```

#### Table: `worker_invitations`
```sql
-- Table for managing worker invitations sent by customers
-- Allows customers to invite new workers to join their organization

CREATE TABLE worker_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('פקח', 'רסס')),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by UUID REFERENCES workers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_worker_invitations_customer_id ON worker_invitations(customer_id);
CREATE INDEX idx_worker_invitations_email ON worker_invitations(email);
CREATE INDEX idx_worker_invitations_token ON worker_invitations(token);
CREATE INDEX idx_worker_invitations_status ON worker_invitations(status);
CREATE INDEX idx_worker_invitations_expires_at ON worker_invitations(expires_at);
```

#### Table: `areas`
```sql
CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_areas_name ON areas(name);
```

#### Table: `sub_areas`
```sql
CREATE TABLE sub_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variety TEXT,
  rows TEXT,
  display TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sub_areas_area_id ON sub_areas(area_id);
CREATE INDEX idx_sub_areas_name ON sub_areas(name);
```

#### Table: `report_areas`
```sql
CREATE TABLE report_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_areas_area_id ON report_areas(area_id);
CREATE INDEX idx_report_areas_name ON report_areas(name);
```

#### Table: `pest_monitoring_report`
```sql
CREATE TABLE pest_monitoring_report (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_report_id UUID NOT NULL REFERENCES report_areas(id) ON DELETE CASCADE,
  sub_area_id UUID NOT NULL REFERENCES sub_areas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(area_report_id, sub_area_id)
);

CREATE INDEX idx_pest_monitoring_report_area_report_id ON pest_monitoring_report(area_report_id);
CREATE INDEX idx_pest_monitoring_report_sub_area_id ON pest_monitoring_report(sub_area_id);
```

#### Table: `pest_monitoring_actions_report`
```sql
CREATE TABLE pest_monitoring_actions_report (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_report_id UUID NOT NULL REFERENCES report_areas(id) ON DELETE CASCADE,
  sub_area_id UUID NOT NULL REFERENCES sub_areas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(area_report_id, sub_area_id)
);

CREATE INDEX idx_pest_monitoring_actions_report_area_report_id ON pest_monitoring_actions_report(area_report_id);
CREATE INDEX idx_pest_monitoring_actions_report_sub_area_id ON pest_monitoring_actions_report(sub_area_id);
```

#### Table: `spray_materials`
```sql
CREATE TABLE spray_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spray_type TEXT NOT NULL,
  material TEXT NOT NULL,
  dosage TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spray_materials_type ON spray_materials(spray_type);
```

#### Table: `supervision_results`
```sql
CREATE TABLE supervision_results (
  id SERIAL PRIMARY KEY,
  status TEXT DEFAULT 'פתוח',
  key TEXT NOT NULL,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  inspector_id UUID NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  pest_monitoring_report_id UUID NOT NULL REFERENCES pest_monitoring_report(id) ON DELETE RESTRICT,
  rows TEXT,
  variety TEXT,
  spray_type TEXT,
  material TEXT,
  dosage TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_inspector_type CHECK (
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = supervision_results.inspector_id 
      AND workers.type = 'פקח'
    )
  )
);

CREATE INDEX idx_supervision_results_key ON supervision_results(key);
CREATE INDEX idx_supervision_results_inspector_id ON supervision_results(inspector_id);
CREATE INDEX idx_supervision_results_pest_monitoring_report_id ON supervision_results(pest_monitoring_report_id);
```

#### Table: `spray_results`
```sql
CREATE TABLE spray_results (
  id SERIAL PRIMARY KEY,
  status TEXT DEFAULT 'פתוח',
  key TEXT NOT NULL,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  sprayer_id UUID NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  pest_monitoring_actions_report_id UUID NOT NULL REFERENCES pest_monitoring_actions_report(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_sprayer_type CHECK (
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = spray_results.sprayer_id 
      AND workers.type = 'רסס'
    )
  )
);

CREATE INDEX idx_spray_results_key ON spray_results(key);
CREATE INDEX idx_spray_results_sprayer_id ON spray_results(sprayer_id);
CREATE INDEX idx_spray_results_pest_monitoring_actions_report_id ON spray_results(pest_monitoring_actions_report_id);
```

### 8.2 API Endpoints (Next.js API Routes)

#### GET `/api/customers`
- Returns list of all customers
- Requires authentication (user must be logged in)
- Returns: `{ id, user_id, name, description }`

#### POST `/api/customer-invitations`
- Creates a new customer invitation
- Requires authentication (user must be an admin)
- Body: `{ email, name }`
- Generates unique invitation token
- Sets expiration date (default: 7 days)
- Sends invitation email to the invitee
- Returns: `{ id, email, name, token, expires_at, status }`

#### GET `/api/customer-invitations?status={status}`
- Returns list of customer invitations
- Requires authentication (user must be an admin)
- Optional filters: `status` (pending, accepted, expired, cancelled)
- Returns: `{ id, email, name, status, expires_at, invited_by_user_id, created_at }`

#### GET `/api/customer-invitations/:token`
- Validates customer invitation token
- Returns invitation details if valid and not expired
- Used for invitation acceptance page
- Returns: `{ id, email, name }`

#### POST `/api/customer-invitations/:token/accept`
- Accepts a customer invitation
- Body: `{ password }` (for creating auth user account)
- Creates auth user account
- Creates customer record linked to user via user_id
- Updates invitation status to 'accepted'
- Returns: `{ customer: { id, name, user_id }, user: { id, email } }`

#### POST `/api/customer-invitations/:id/cancel`
- Cancels a pending customer invitation
- Requires authentication (user must be an admin)
- Updates invitation status to 'cancelled'
- Returns: `{ id, status }`

#### GET `/api/workers?customerId={customerId}&type={type}`
- Returns list of workers, optionally filtered by customer and/or type
- Requires authentication (user must be logged in)
- Types: `פקח` or `רסס`
- Returns: `{ id, customer_id, user_id, name, type, customer: { id, name } }`

#### GET `/api/customer-areas?customerId={customerId}`
- Returns areas associated with a customer
- Requires authentication (user must be logged in)
- Returns: `{ id, customer_id, area_id, area: { id, name, description } }`

#### GET `/api/areas?customerId={customerId}`
- Returns list of areas, optionally filtered by customer
- If customerId provided, returns only areas accessible to that customer

#### GET `/api/sub-areas?areaId={areaId}`
- Returns sub-areas for a specific area
- Format: `{ id, name, variety, rows, display }`

#### GET `/api/report-areas?areaId={areaId}`
- Returns report areas for a specific area

#### GET `/api/pest-monitoring-report?areaReportId={areaReportId}`
- Returns sub-areas linked to a pest monitoring report area
- Format: `{ id, area_report_id, sub_area_id, sub_area: { name, variety, rows, display } }`

#### GET `/api/pest-monitoring-actions-report?areaReportId={areaReportId}`
- Returns sub-areas linked to a pest monitoring actions report area
- Format: `{ id, area_report_id, sub_area_id, sub_area: { name, variety, rows, display } }`

#### GET `/api/spray-types`
- Returns list of unique spray types

#### GET `/api/materials?sprayType={sprayType}`
- Returns materials filtered by spray type

#### POST `/api/supervision`
- Saves supervision form data
- Accepts array of sections (one row per section)
- Returns saved records with IDs

#### POST `/api/spray`
- Saves spray form data
- Accepts single record
- Returns saved record with ID

#### POST `/api/worker-invitations`
- Creates a new worker invitation
- Requires authentication (user must be a worker of the customer)
- Body: `{ customer_id, email, name, type }`
- Generates unique invitation token
- Sets expiration date (default: 7 days)
- Sends invitation email to the invitee
- Returns: `{ id, email, name, type, token, expires_at, status }`

#### GET `/api/worker-invitations?customerId={customerId}&status={status}`
- Returns list of worker invitations
- Requires authentication (user must be a worker of the customer)
- Optional filters: `customerId`, `status` (pending, accepted, expired, cancelled)
- Returns: `{ id, email, name, type, status, expires_at, invited_by, created_at }`

#### GET `/api/worker-invitations/:token`
- Validates invitation token
- Returns invitation details if valid and not expired
- Used for invitation acceptance page
- Returns: `{ id, customer_id, email, name, type, customer: { id, name } }`

#### POST `/api/worker-invitations/:token/accept`
- Accepts a worker invitation
- Body: `{ password }` (for creating auth user account)
- Creates auth user account
- Creates worker record linked to customer
- Updates invitation status to 'accepted'
- Returns: `{ worker: { id, name, type }, user: { id, email } }`

#### POST `/api/worker-invitations/:id/cancel`
- Cancels a pending invitation
- Requires authentication (user must be a worker of the customer)
- Updates invitation status to 'cancelled'
- Returns: `{ id, status }`

### 8.3 Frontend Components (shadcn/ui)

- `Button` - Form submission, navigation
- `Select` - Dropdowns for customers, workers, areas, sub-areas, spray types, materials
- `Input` - Dosage field, email input for invitations
- `Card` - Form containers
- `Alert` - Success/error messages
- `Dialog` - Menu modal (mobile), invitation dialog
- `Form` - Form validation and handling
- `Table` - Display list of invitations
- `Badge` - Status indicators (pending, accepted, expired, cancelled)
- `InviteWorkerDialog` - Modal for sending worker invitations
- `InvitationAcceptPage` - Public page for accepting invitations

### 8.4 Data Migration

1. **Export from Google Sheets:**
   - Export `עובדים` → Split into `customers` and `workers` tables
     - Group workers by customer (may need to determine customer grouping logic)
     - Create `customers` table entries
     - Create `workers` table entries linked to customers
   - Export `חלקות-זנים` → Normalize into:
     - `areas` table (extract unique plot names as areas)
     - `sub_areas` table (map plot-variety combinations to sub-areas)
     - `report_areas` table (create report areas based on areas)
     - `pest_monitoring_report` table (link sub-areas to pest monitoring report areas)
     - `pest_monitoring_actions_report` table (link sub-areas to pest monitoring actions report areas)
   - Create `customer_areas` junction table:
     - Link customers to their accessible areas (many-to-many)
   - Export `סוג ריסוס` → `spray_materials` table
   - Export existing results (optional, for historical data)

2. **Import to Supabase:**
   - Use Supabase dashboard or migration scripts
   - Create customers:
     - Group workers by customer (determine customer structure from business logic)
     - Create `customers` table entries
   - Create auth users:
     - For each worker from `עובדים`, create a user in `auth.users` via Supabase Auth API
     - Generate temporary passwords or use email-based authentication
   - Import workers:
     - Link each worker to a customer via `customer_id`
     - Link `user_id` to the created auth user
     - Map `role` → `type` field
   - Create customer-area relationships:
     - Determine which areas each customer has access to
     - Create entries in `customer_areas` junction table
   - Normalize plot data:
     - Extract unique plot names → `areas`
     - Map plot-variety combinations → `sub_areas` (with `area_id` reference)
     - Create `report_areas` based on areas
     - Create junction table entries for `pest_monitoring_report` and `pest_monitoring_actions_report`



   - Handle date formatting for `rows` column
   - Preserve Hebrew text encoding
   - Ensure foreign key relationships are maintained

### 8.5 Email Service

- Replace `MailApp.sendEmail()` with:
  - Supabase Edge Functions + Resend/SendGrid
  - Or Next.js API route + email service (Resend, SendGrid, etc.)

## 9. Non-Functional Requirements

### 9.1 Performance
- Page load time < 2 seconds
- Form submission < 1 second
- Data caching for reference data

### 9.2 Security
- Authentication (Supabase Auth)
- Row Level Security (RLS) policies
- Input validation and sanitization
- CSRF protection

### 9.3 Accessibility
- RTL support for Hebrew
- Keyboard navigation
- Screen reader support
- ARIA labels

### 9.4 Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 10. Future Enhancements (Out of Scope)

- Status management UI
- Edit/delete functionality
- Reports and analytics
- User authentication and roles
- Multi-language support
- Export to Excel/PDF

## 11. Migration Checklist

- [ ] Set up Next.js project with TypeScript
- [ ] Set up Supabase project and database
- [ ] Create database schema
- [ ] Migrate reference data (workers, plots, varieties, spray materials)
- [ ] Implement API routes
- [ ] Create frontend components with shadcn/ui
- [ ] Implement Supervision Form
- [ ] Implement Spray Form
- [ ] Implement navigation/menu
- [ ] Set up email notifications
- [ ] Test form submissions
- [ ] Test data validation
- [ ] Test email notifications
- [ ] Deploy to production
- [ ] Migrate historical data (optional)

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Author:** Migration Requirements
