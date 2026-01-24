# Data Summary

This document shows the current state of data in the database after comprehensive seeding.

## Current Data Counts

After running `npm run seed-data`, you should have:

### Core Tables
- **Areas**: 10 areas (אזור צפון, אזור מרכז, אזור דרום, אזור עמק, אזור הר, אזור גולן, אזור הגליל, אזור הנגב, אזור השפלה, אזור השרון)
- **Sub-Areas**: ~48 sub-areas (hierarchical structure with first and second level)
- **Report Areas**: Multiple report areas for monitoring and actions

### Lookup Tables
- **Findings**: 12 different findings (pest infestations, diseases, etc.)
- **Action Types**: 10 different action types (spray, prune, treat, biological control, etc.)
- **Unit Types**: 11 different unit types (ml, l, kg, g, mg, ppm, etc.)
- **Worker Types**: 2 types (inspector, action_worker)

### Users & Workers
- **Admin User**: admin@example.com
- **Workers**: 10 workers total
  - 5 Inspectors (יוסי כהן, שרה אברהם, רותם כהן, אור לוי, מיכל גולן)
  - 5 Action Workers (דני לוי, משה דוד, תמר דוד, אלון שרון, יואב נגב)

### Reports
- **Monitoring Reports**: Multiple sample reports with different statuses
- **Action Reports**: Multiple sample action reports

## How to Verify

1. **Dashboard** (`/dashboard`):
   - Should show non-zero counts for monitoring and action reports

2. **Monitoring Form** (`/monitoring`):
   - Should show 5 inspectors in dropdown
   - Should show 10 areas
   - Should show 12 findings
   - Should show 10 action types
   - Should show 11 unit types

3. **Action Form** (`/actions`):
   - Should show 5 action workers in dropdown
   - Should show all the same lookup data

4. **Areas Page** (`/areas`):
   - Should show all 10 areas

## Worker Login Credentials

All workers use password: `worker123`

- יוסי כהן: yossi@example.com
- דני לוי: dani@example.com
- שרה אברהם: sara@example.com
- משה דוד: moshe@example.com
- רותם כהן: rotem@example.com
- אור לוי: or@example.com
- תמר דוד: tamar@example.com
- אלון שרון: alon@example.com
- מיכל גולן: michal@example.com
- יואב נגב: yoav@example.com

## Re-seeding Data

To add more data or reset:

```bash
# Get service role key
npx supabase status --output json | grep SERVICE_ROLE_KEY

# Run seed script
SUPABASE_SERVICE_ROLE_KEY=<your-key> npm run seed-data
```

## Notes

- All data is linked to the admin customer
- Admin customer has access to all areas
- Workers belong to the admin customer
- Sample reports are created with realistic data
