# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Area Control Loop is a pest management application implementing the workflow: Monitoring → Analysis → Risk Assessment → Decision → Action → Reporting → Follow-up. Currently focused on **Monitoring** (inspectors record findings/recommendations) and **Action** (workers execute based on monitoring) phases.

The application is Hebrew-first with full RTL support, multi-tenant with customer-based access control.

## Common Commands

```bash
# Development
npm run dev              # Start development server (http://localhost:3000)
npm run build            # Production build
npm run lint             # ESLint with Prettier

# Database
npx supabase start       # Start local Supabase
npx supabase db reset    # Reset and apply all migrations

# Data scripts (require SUPABASE_SERVICE_ROLE_KEY env var)
npm run create-admin     # Create admin@example.com / admin123
npm run create-workers   # Create sample workers
npm run seed-data        # Seed comprehensive data
npm run create-test-users # Create test users
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 16+ (App Router), React 19, TypeScript
- **UI**: shadcn/ui, Tailwind CSS with RTL plugin (`tailwindcss-rtl`)
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Auth**: Supabase Auth with middleware-based session management
- **Forms**: react-hook-form + zod validation

### Key Patterns

**Supabase Client Usage**:
- `lib/supabase/client.ts` - Browser client (client components)
- `lib/supabase/server.ts` - Server client (server components, API routes)
- `lib/supabase/middleware.ts` - Session refresh and route protection

**Authentication Flow**:
- Middleware in `middleware.ts` protects all routes except `/login`, `/register`, `/invitations/accept`, `/api/auth`
- Use `createClient()` from `lib/supabase/server.ts` in server components/API routes

**Database Types**:
- Manually defined in `types/database.ts` (not auto-generated)
- Tables: `customers`, `workers`, `worker_types`, `areas`, `sub_areas`, `report_areas`, `monitoring_area_report`, `actions_area_report`, `findings`, `action_types`, `unit_types`, `invitations`, `customer_areas`

### Data Model
- **Multi-tenant**: Workers belong to customers; customers own areas via `customer_areas` junction table
- **Hierarchical areas**: `sub_areas` can nest via `parent_sub_area_id` with `level` field
- **Worker types**: Stored as lookup table (`worker_types`), typically 'inspector' and 'action_worker'
- **Report linking**: `monitoring_area_report.actions_area_report_id` links monitoring to action reports

### RTL/Hebrew Notes
- Worker types use English in DB ('inspector', 'action_worker') but display Hebrew in UI
- Full RTL layout via Tailwind RTL plugin
- Hebrew font support configured

## Project Structure

```
app/
  api/                  # API routes (action-types, areas, workers, monitoring, etc.)
  actions/              # Action form page
  admin/                # Admin pages
  monitoring/           # Monitoring form page
  dashboard/            # Dashboard
  login/, register/     # Auth pages
components/
  ui/                   # shadcn/ui components
  layout/               # Navbar, layout components
  monitoring/, actions/ # Form-specific components
lib/
  supabase/             # Supabase clients (client.ts, server.ts, middleware.ts)
  auth.ts, permissions.ts, rtl.ts, email.ts
supabase/
  migrations/           # SQL migrations (001-007 + dated)
scripts/                # Data seeding and admin scripts (run with tsx)
types/
  database.ts           # TypeScript types for Supabase tables
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
```

For scripts requiring admin access:
```bash
SUPABASE_SERVICE_ROLE_KEY=<key> npm run <script>
```

## Project Roadmap

See `docs/ROADMAP.md` for the full project roadmap with phases, milestones, and progress tracking. Update the roadmap when completing milestones.
