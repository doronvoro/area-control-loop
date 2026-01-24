# Area Control Loop Application

A flexible area-control loop application implementing the workflow: **Monitoring → Analysis → Risk Assessment → Decision → Action → Reporting → Follow-up**. Currently focusing on **Monitoring** and **Action** phases.

## Features

- **Monitoring Phase**: Inspectors record findings and recommendations
- **Action Phase**: Workers execute actions based on monitoring recommendations
- **Hierarchical Area Management**: Support for nested sub-areas
- **RTL Support**: Full Hebrew RTL support for first customer
- **Multi-tenant**: Customer-based access control
- **Worker Types**: Flexible worker type system (Inspector, Action Worker)

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript
- **UI**: shadcn/ui, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Form Validation**: react-hook-form + zod

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Supabase CLI (optional, for local development)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase locally:**
   ```bash
   # If you have Supabase CLI installed
   supabase start
   
   # Or use Docker Compose directly
   docker-compose up -d
   ```

3. **Configure environment variables:**
   
   Get your Supabase connection details:
   ```bash
   npx supabase status
   ```
   
   Create a `.env.local` file in the root directory with:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key-from-supabase-status>
   ```
   
   To get the anon key, run:
   ```bash
   npx supabase status --output json | grep ANON_KEY
   ```
   
   Or check the Supabase Studio at http://127.0.0.1:54323 → Settings → API

4. **Run database migrations:**
   ```bash
   # If using Supabase CLI (this will reset and apply all migrations including fake data)
   npx supabase db reset
   
   # Or manually run migrations from supabase/migrations/
   ```

5. **Seed fake data (optional):**
   ```bash
   # The migration 004_fake_data.sql has already created:
   # - 5 areas (אזור צפון, אזור מרכז, etc.)
   # - Multiple sub-areas with hierarchical structure
   # - Report areas for monitoring and actions
   # - Lookup data (findings, action types, unit types)
   
   # To add more data or create customers/workers, you can:
   # 1. Register users via the app
   # 2. Use the TypeScript seed script (requires service role key):
   #    SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/seed-fake-data.ts
   ```

6. **Start the development server:**
   ```bash
   npm run dev
   ```

7. **Create default admin user (optional):**
   ```bash
   # Get service role key
   npx supabase status --output json | grep SERVICE_ROLE_KEY
   
   # Create admin user
   SUPABASE_SERVICE_ROLE_KEY=<your-key> npm run create-admin
   ```
   
   Default admin credentials:
   - **Email:** `admin@example.com`
   - **Password:** `admin123`
   - See `ADMIN_CREDENTIALS.md` for details

8. **Access the application:**
   - App: http://localhost:3000
   - Login: http://localhost:3000/login
   - Supabase Studio: http://localhost:54323

## Database Schema

The application uses the following main tables:

- `worker_types` - Worker type lookup (inspector, action_worker)
- `customers` - Customer organizations
- `workers` - Workers linked to customers
- `areas` - Main areas
- `sub_areas` - Hierarchical sub-areas
- `monitoring_area_report` - Monitoring records
- `actions_area_report` - Action records
- `findings`, `action_types`, `unit_types` - Lookup tables

See `supabase/migrations/` for the complete schema.

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── actions/           # Action form page
│   ├── dashboard/         # Dashboard page
│   ├── login/             # Login page
│   ├── monitoring/        # Monitoring form page
│   └── reports/           # Reports page
├── components/            # React components
│   ├── actions/          # Action form components
│   ├── layout/           # Layout components (Navbar)
│   ├── monitoring/       # Monitoring form components
│   └── ui/               # shadcn/ui components
├── lib/                  # Utilities
│   ├── supabase/        # Supabase client utilities
│   ├── auth.ts          # Authentication helpers
│   ├── email.ts         # Email service
│   └── rtl.ts           # RTL utilities
├── supabase/            # Supabase configuration
│   └── migrations/      # Database migrations
└── types/               # TypeScript types
```

## Key Features Implementation

### Monitoring Form
- Inspector selection
- Area and sub-area selection
- Finding selection
- Recommendations (material, dosage, unit, action type)

### Action Form
- Worker selection
- Area selection (triggers monitoring report fetch)
- Link to existing monitoring reports or create new action
- Update monitoring status when linking
- Action details (material, dosage, action type, time, notes)

### RTL Support
- Full Hebrew RTL layout
- Tailwind RTL plugin
- Hebrew font support
- Mirrored UI components

## Development

- **Linting**: `npm run lint`
- **Type checking**: `npm run type-check` (if configured)
- **Build**: `npm run build`
- **Start production**: `npm start`

## Notes

- The first customer requires Hebrew (RTL) support
- Worker types use English in database ('inspector', 'action_worker') but display Hebrew in UI
- Monitoring reports can be linked to action reports via `actions_area_report_id`
- All API routes are protected by authentication middleware
