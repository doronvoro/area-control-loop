# Treatment Deduplication — Design Analysis

## The Problem

When a monitoring inspector records multiple findings on the same sub-area, each finding gets its own treatment recommendation. If two findings recommend the same treatment (same material, action type, dosage), the system creates duplicate treatment records.

This duplication flows downstream:
- The action worker sees 2 separate tasks for what is physically 1 spray
- The action report records 2 identical treatments
- Material consumption and cost reports are overstated

### Example

Inspector monitors Sub-area X and finds:
- **Aphids** — recommends Insecticide 4L spray
- **Whiteflies** — recommends Insecticide 4L spray

Current result:
```
monitoring_area_report (sub_area=X, finding=aphids)
  └── monitoring_treatment: Insecticide 4L spray

monitoring_area_report (sub_area=X, finding=whiteflies)
  └── monitoring_treatment: Insecticide 4L spray
```

Worker completes both tasks:
```
actions_area_report (sub_area=X, finding=aphids)
  └── action_treatment: Insecticide 4L spray     ← duplicate

actions_area_report (sub_area=X, finding=whiteflies)
  └── action_treatment: Insecticide 4L spray     ← duplicate
```

**Reality:** The worker sprayed once. The report shows two sprays.

---

## Current Data Model

```
report_areas (monitoring/action type)
  │
  ├── monitoring_area_report        1 per (sub_area + finding)
  │     ├── sub_area_id
  │     ├── finding_id              ← finding baked into report
  │     ├── severity
  │     │
  │     └── monitoring_treatments   1+ per report
  │           ├── material_id
  │           ├── dosage
  │           ├── unit_type_id
  │           ├── action_type_id
  │           └── action_treatment_id ──→ action_treatments (1-to-1 link)
  │
  ├── actions_area_report           1 per (sub_area + finding)
  │     ├── sub_area_id
  │     ├── finding_id              ← finding baked into report
  │     ├── severity
  │     │
  │     └── action_treatments       1+ per report
  │           ├── material_id
  │           ├── dosage
  │           ├── unit_type_id
  │           ├── action_type_id
  │           └── action_time

Unique constraints:
  monitoring_area_report: UNIQUE(area_report_id, sub_area_id, finding_id)
  actions_area_report:    UNIQUE(area_report_id, sub_area_id, finding_id)
```

The `finding_id` on both report tables forces a 1-to-1 relationship between findings and their treatments. Two findings cannot share a treatment record.

---

## Scenarios Analysis

| Scenario | Physical Reality | Current DB Result | Correct? |
|---|---|---|---|
| 2 findings, same material + same dosage | Worker sprays once | 2 action_treatments (identical) | Wrong — shows double |
| 2 findings, same material + different dosage | Worker sprays once (picks one dosage) | 2 action_treatments (differ in dosage) | Wrong — implies 2 sprays |
| 2 findings, different materials | Worker sprays twice | 2 action_treatments (different) | Correct |
| 1 finding, 1 treatment | Worker sprays once | 1 action_treatment | Correct |

Key insight: for a single submission on the same sub-area, same material = 1 physical action regardless of dosage. The worker can't spray the same material at two different rates simultaneously.

---

## Clean Database Design (if starting from scratch)

```
report_areas (action type)
  │
  ├── action_report_findings           findings observed/addressed
  │     ├── sub_area_id
  │     ├── finding_id
  │     ├── severity
  │     ├── notes
  │     └── monitoring_treatment_id    (optional link to monitoring)
  │
  ├── action_executions                physical actions performed
  │     ├── sub_area_id
  │     ├── material_id
  │     ├── dosage
  │     ├── unit_type_id
  │     ├── action_type_id
  │     ├── action_time
  │     └── notes
  │
  └── action_execution_findings        many-to-many junction
        ├── action_execution_id  ──→ action_executions
        └── action_report_finding_id ──→ action_report_findings
```

Relationships:
- 1 execution → N findings (one spray covers multiple pests)
- 1 finding → N executions (one pest needs multiple treatments)
- 1 finding → 0 executions (documented but untreated)

Example with clean design:
```
action_execution: Insecticide 4L spray        ← 1 record
  ├── linked to finding: aphids               (via junction)
  └── linked to finding: whiteflies           (via junction)
```

---

## Solution Options — Where to Solve

### At Action Time (downstream fix)

| Option | What Changes | Effort | Impact |
|---|---|---|---|
| **A. Do nothing, fix report only** | Report groups identical treatments for display | Low | Low — worker still sees duplicates |
| **B. Group in action UI** | Show grouped tasks, worker completes once, API creates 2 records | Medium | Medium — better worker UX, report still duplicated |
| **C. Group in action UI + report** | B + report deduplicates display | Medium | High — best UX for worker and report reader |
| **D. API-level dedup** | API merges same sub_area + material into 1 action_treatment, links both monitoring_treatments to it | Medium | High — clean data, but breaks 1-to-1 assumption |
| **E. Clean DB migration** | New schema with junction table | High | Highest — future-proof, accurate queries |

### At Monitoring Time (upstream prevention)

| Option | What Changes | Effort | Impact |
|---|---|---|---|
| **1. No restriction** (current) | Inspector adds freely | None | None — duplicates flow downstream |
| **2. Warning only** | Show warning when same material+action_type exists on same sub-area | Low | Low — inspector stays aware, may still create duplicates |
| **3. Suggest reuse** | Offer to link to existing treatment instead of creating new | Medium | Medium — reduces duplicates, inspector chooses |
| **4. Shared treatment pool** | Treatments defined at sub-area level, linked to findings separately | High | High — no duplicates possible, major form redesign |
| **5. Auto-merge on submit** | API merges identical treatments silently | Medium | Medium — needs junction table (clean design) |
| **6. Block duplicate** | Prevent same material+action_type on same sub-area | Low | Medium — too restrictive, may frustrate inspector |

### Effort vs Impact

```
                        High Impact
                            │
                   E (Clean DB)    C (Action UI + Report)
                            │
                            │  D (API dedup)
                            │
              3 (Suggest)   │  B (Action UI only)
                            │
         Low Effort ────────┼──────── High Effort
                            │
              2 (Warning)   │  4 (Shared pool)
                            │
           A,1 (Do nothing) │  5 (Auto-merge)
                            │
                        Low Impact
```

---

## Recommendation

**Combine Option 2 + Option C:**

1. **Monitoring form (Option 2):** Add a warning when inspector creates a treatment with the same material + action type on the same sub-area. Non-blocking — inspector can dismiss and create anyway. This reduces unintentional duplicates.

2. **Action page UI (Option C, part 1):** Group tasks that share the same sub-area + material + action type. Show as one card with multiple findings listed. Worker completes once, API submits for all linked findings.

3. **Report view (Option C, part 2):** Group identical action_treatments by (sub_area, material, dosage, action_type) and display as one row with multiple findings.

This approach:
- No schema migration needed
- No risk to existing data
- Inspector workflow preserved (per-finding thinking)
- Worker sees reality (1 spray = 1 task)
- Report is accurate (no duplicate counts)
- Per-finding traceability maintained in the database

### Why not the clean DB design?

The clean design is architecturally superior but the migration effort and risk don't justify it at this stage. The current model's only problem is display duplication, which is fully solvable in the UI layer. If material consumption reporting becomes critical (e.g., regulatory compliance), revisit the schema then.

---

## Implementation Order

1. **Option 2 — Monitoring warning** (low effort, immediate value)
2. **Option C part 1 — Action page grouping** (medium effort, biggest UX win)
3. **Option C part 2 — Report deduplication** (medium effort, completes the solution)
