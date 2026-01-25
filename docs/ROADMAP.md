# Project Roadmap: Area Control Loop

> **Last Updated:** 2026-01-25
> **Status:** Phase 1 - Stabilization & Core Completion

---

## Overview

Area Control Loop implements a pest management workflow:
**Monitoring → Analysis → Risk Assessment → Decision → Action → Reporting → Follow-up**

This roadmap tracks progress from the current state (Monitoring + Action phases) to full workflow implementation.

---

## Current State

| Category | Status |
|----------|--------|
| Core Workflows (Monitoring, Actions) | Complete |
| Authentication & User Management | Complete |
| Areas & Sub-areas Data Model | Complete |
| Dashboard & Basic Reports | Complete |
| Invitation System | Partial (creation only) |
| Permission System | Partial (basic checks) |
| Email Notifications | Not Started |
| Advanced Reporting | Not Started |

---

## Phase 1: Stabilization & Core Completion

*Goal: Complete the foundation before adding new features*

### P0 - Critical

- [ ] Complete invitation acceptance flow
  - [ ] Token validation endpoint
  - [ ] User account creation on accept
  - [ ] Status update (pending → accepted)
- [ ] Implement email notifications for invitations
  - [ ] Email service integration (Resend/SendGrid)
  - [ ] Invitation email template
  - [ ] Expiration reminder emails

### P1 - High Priority

- [ ] Sub-area management UI
  - [ ] Create sub-area form
  - [ ] Edit sub-area form
  - [ ] Delete with confirmation
  - [ ] Tree view display
- [ ] Customer-area linking UI
  - [ ] Assign areas to customers
  - [ ] Remove area assignments
- [ ] Permission assignment mechanism
  - [ ] Define permission model
  - [ ] Admin UI for assigning permissions
  - [ ] Role-based permission groups

### P2 - Medium Priority

- [ ] Reports page improvements
  - [ ] Pagination (currently limited to 50)
  - [ ] Search/filter by date, area, worker
  - [ ] Sort by columns

### Milestone Completion

| Milestone | Target Date | Completed Date | Notes |
|-----------|-------------|----------------|-------|
| Invitation flow complete | - | - | |
| Sub-area UI complete | - | - | |
| Phase 1 complete | - | - | |

---

## Phase 2: Reporting & Analysis

*Goal: Implement comprehensive reporting and analysis capabilities*

### P0 - Critical

- [ ] Comprehensive reports dashboard
  - [ ] Summary statistics cards
  - [ ] Charts (findings by area, actions over time)
  - [ ] Trend indicators
- [ ] Date range filtering
  - [ ] Date picker component
  - [ ] Filter all report queries
  - [ ] Preset ranges (today, week, month, year)

### P1 - High Priority

- [ ] Export functionality
  - [ ] Export to Excel (.xlsx)
  - [ ] Export to CSV
  - [ ] Export filtered results
- [ ] Trend analysis
  - [ ] Pest frequency over time
  - [ ] Area comparison
  - [ ] Seasonal patterns

### P2 - Medium Priority

- [ ] PDF report generation
  - [ ] Report templates
  - [ ] Scheduled report generation
- [ ] Email scheduled reports
  - [ ] Weekly summary emails
  - [ ] Custom schedule per user

### Milestone Completion

| Milestone | Target Date | Completed Date | Notes |
|-----------|-------------|----------------|-------|
| Reports dashboard complete | - | - | |
| Export functionality complete | - | - | |
| Phase 2 complete | - | - | |

---

## Phase 3: Risk Assessment & Decision Support

*Goal: Help users make informed decisions based on data*

### P0 - Critical

- [ ] Risk scoring system
  - [ ] Define severity levels for findings
  - [ ] Calculate risk scores per area
  - [ ] Risk score display in UI
- [ ] Alert system
  - [ ] High-risk finding alerts
  - [ ] In-app notifications
  - [ ] Email alerts for critical issues

### P1 - High Priority

- [ ] Recommendation engine
  - [ ] Suggest actions based on findings
  - [ ] Material recommendations by pest type
  - [ ] Dosage recommendations
- [ ] Historical comparison
  - [ ] Compare current vs previous period
  - [ ] Year-over-year analysis
  - [ ] Progress tracking

### P2 - Medium Priority

- [ ] Area heat maps
  - [ ] Visual representation of problem areas
  - [ ] Severity color coding
  - [ ] Interactive map navigation

### Milestone Completion

| Milestone | Target Date | Completed Date | Notes |
|-----------|-------------|----------------|-------|
| Risk scoring complete | - | - | |
| Alert system complete | - | - | |
| Phase 3 complete | - | - | |

---

## Phase 4: Follow-up & Workflow Automation

*Goal: Close the loop with automated follow-up and tracking*

### P0 - Critical

- [ ] Follow-up reminders
  - [ ] Identify unresolved monitoring reports
  - [ ] Reminder scheduling
  - [ ] Escalation for overdue items
- [ ] Workflow status tracking
  - [ ] Visual workflow status indicator
  - [ ] Status history/audit trail
  - [ ] Bulk status updates

### P1 - High Priority

- [ ] Automatic status updates
  - [ ] Update monitoring status when action linked
  - [ ] Mark as resolved when action completed
- [ ] Notification system
  - [ ] In-app notification center
  - [ ] Email notification preferences
  - [ ] Notification history

### P2 - Medium Priority

- [ ] Mobile push notifications
  - [ ] Push notification infrastructure
  - [ ] User opt-in/opt-out
  - [ ] Notification categories

### Milestone Completion

| Milestone | Target Date | Completed Date | Notes |
|-----------|-------------|----------------|-------|
| Reminders system complete | - | - | |
| Notifications complete | - | - | |
| Phase 4 complete | - | - | |

---

## Phase 5: Advanced Features

*Goal: Polish and extend for broader use cases*

### P1 - High Priority

- [ ] Multi-language support
  - [ ] i18n framework setup
  - [ ] English translations
  - [ ] Language switcher UI
- [ ] Mobile-optimized PWA
  - [ ] Service worker
  - [ ] Offline capability
  - [ ] Install prompt

### P2 - Medium Priority

- [ ] External API
  - [ ] API documentation
  - [ ] API key management
  - [ ] Rate limiting
- [ ] Audit log
  - [ ] Track all changes
  - [ ] User action history
  - [ ] Compliance reporting

### P3 - Low Priority

- [ ] Google Sheets export
  - [ ] Sheets API integration
  - [ ] Sync mechanism
  - [ ] Two-way sync (optional)

### Milestone Completion

| Milestone | Target Date | Completed Date | Notes |
|-----------|-------------|----------------|-------|
| Multi-language complete | - | - | |
| PWA complete | - | - | |
| Phase 5 complete | - | - | |

---

## 


*Address alongside feature development*

| Item | Priority | Status |
|------|----------|--------|
| Remove `as any` type casts | Medium | [ ] Not Started |
| Consolidate RLS policies | High | [ ] Not Started |
| Auto-generate database types | Medium | [ ] Not Started |
| Add test coverage | High | [ ] Not Started |
| API error handling standardization | Medium | [ ] Not Started |

---

## Changelog

### 2026-01-25
- Initial roadmap created
- Documented current state analysis
- Defined 5 phases with priorities

---

## How to Update This Document

When completing a milestone:

1. Check off completed items with `[x]`
2. Fill in the "Completed Date" in milestone tables
3. Add notes if relevant
4. Update the "Last Updated" date at the top
5. Add entry to Changelog section
