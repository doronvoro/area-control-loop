# Fake Data Seeding Guide

This document describes the fake data that has been seeded into the database.

## What's Been Created

### ✅ Automatically Created (via Migration 004_fake_data.sql)

1. **Areas (5 areas)**
   - אזור צפון (North Area)
   - אזור מרכז (Center Area)
   - אזור דרום (South Area)
   - אזור עמק (Valley Area)
   - אזור הר (Mountain Area)

2. **Sub-Areas (Hierarchical)**
   - Multiple first-level sub-areas for each area
   - Some second-level sub-areas (nested structure)
   - Each sub-area has:
     - Variety (זן A, זן B, זן C)
     - Rows (1-10, 11-20, 21-30)
     - Display format

3. **Report Areas**
   - Monitoring report areas for all areas
   - Action report areas for first 3 areas

4. **Lookup Tables**
   - **Findings (8 types):**
     - pest_infestation (הדבקות מזיקים) - high severity
     - disease (מחלה) - medium severity
     - nutrient_deficiency (חוסר חומרים מזינים) - low severity
     - weed_growth (צמיחת עשבים) - low severity
     - aphids (כנימות) - high severity
     - mites (קרדיות) - medium severity
     - fungal_infection (זיהום פטרייתי) - high severity
     - bacterial_disease (מחלה חיידקית) - medium severity

   - **Action Types (6 types):**
     - spray (ריסוס)
     - prune (גיזום)
     - treat (טיפול)
     - monitor (ניטור)
     - fertilize (דישון)
     - irrigate (השקיה)

   - **Unit Types (6 types):**
     - ml (מיליליטר)
     - l (ליטר)
     - kg (קילוגרם)
     - g (גרם)
     - units (יחידות)
     - liters_per_hectare (ליטר לדונם)

   - **Worker Types (2 types):**
     - inspector (פקח)
     - action_worker (רסס)

## ⚠️ What Requires Manual Setup

The following require auth users to be created first (via registration or Supabase dashboard):

1. **Customers**
   - Must be linked to an `auth.users` record
   - Create via app registration or manually in Supabase

2. **Workers**
   - Must be linked to both a customer and an `auth.users` record
   - Create after customers exist

3. **Customer-Area Links**
   - Link customers to areas via `customer_areas` table
   - Required for customers to access areas

4. **Monitoring Reports**
   - Require existing workers (inspectors) and report areas
   - Can be created via the monitoring form

5. **Action Reports**
   - Require existing workers (action_workers) and report areas
   - Can be created via the action form

## How to Verify Data

1. **Via Supabase Studio:**
   - Open http://127.0.0.1:54323
   - Navigate to "Table Editor"
   - Check tables: `areas`, `sub_areas`, `report_areas`, `findings`, `action_types`, `unit_types`

2. **Via SQL:**
   ```sql
   -- Count records
   SELECT 'areas' as table_name, COUNT(*) FROM areas
   UNION ALL SELECT 'sub_areas', COUNT(*) FROM sub_areas
   UNION ALL SELECT 'report_areas', COUNT(*) FROM report_areas
   UNION ALL SELECT 'findings', COUNT(*) FROM findings
   UNION ALL SELECT 'action_types', COUNT(*) FROM action_types
   UNION ALL SELECT 'unit_types', COUNT(*) FROM unit_types;
   ```

## Next Steps

1. **Register test users:**
   - Go to http://localhost:3000/register
   - Create a few test accounts

2. **Create a customer:**
   - After registration, create a customer record linked to a user
   - You can do this via SQL or create an admin interface

3. **Create workers:**
   - Link registered users to customers as workers
   - Assign worker types (inspector or action_worker)

4. **Link customer to areas:**
   - Insert records into `customer_areas` table
   - This allows the customer to access those areas

5. **Test the forms:**
   - Use the monitoring form to create monitoring reports
   - Use the action form to create action reports

## Using the TypeScript Seed Script

For more advanced seeding (after users exist):

```bash
# Get service role key
npx supabase status --output json | grep SERVICE_ROLE_KEY

# Run seed script
SUPABASE_SERVICE_ROLE_KEY=<your-key> npx tsx scripts/seed-fake-data.ts
```

Note: You may need to install `tsx` first:
```bash
npm install -D tsx
```
