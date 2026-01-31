import { config } from 'dotenv';
import { Client } from 'pg';

// Load environment variables from .env.local
config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL in .env.local');
  console.error('Get it from Supabase Dashboard > Settings > Database > Connection string (URI)');
  console.log('\nAlternatively, run this SQL directly in Supabase Studio:\n');
  printSQL();
  process.exit(1);
}

function printSQL() {
  console.log(`
-- Add INSERT policies for admins on monitoring_area_report and related tables

-- Allow admins to insert monitoring reports
CREATE POLICY "Admins can create monitoring reports"
  ON monitoring_area_report FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- Allow admins to update monitoring reports
CREATE POLICY "Admins can update monitoring reports"
  ON monitoring_area_report FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- Allow admins to delete monitoring reports
CREATE POLICY "Admins can delete monitoring reports"
  ON monitoring_area_report FOR DELETE
  USING (is_admin_user(auth.uid()));

-- Allow admins to insert report_areas
CREATE POLICY "Admins can create report areas"
  ON report_areas FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- Allow admins to update report_areas
CREATE POLICY "Admins can update report areas"
  ON report_areas FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- Allow admins to delete report_areas
CREATE POLICY "Admins can delete report areas"
  ON report_areas FOR DELETE
  USING (is_admin_user(auth.uid()));
  `);
}

async function applyMigration() {
  console.log('Connecting to database...');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected!\n');

    const migrations = [
      {
        name: 'Admins can create monitoring reports',
        check: `SELECT 1 FROM pg_policies WHERE tablename = 'monitoring_area_report' AND policyname = 'Admins can create monitoring reports'`,
        sql: `CREATE POLICY "Admins can create monitoring reports" ON monitoring_area_report FOR INSERT WITH CHECK (is_admin_user(auth.uid()));`,
      },
      {
        name: 'Admins can update monitoring reports',
        check: `SELECT 1 FROM pg_policies WHERE tablename = 'monitoring_area_report' AND policyname = 'Admins can update monitoring reports'`,
        sql: `CREATE POLICY "Admins can update monitoring reports" ON monitoring_area_report FOR UPDATE USING (is_admin_user(auth.uid()));`,
      },
      {
        name: 'Admins can delete monitoring reports',
        check: `SELECT 1 FROM pg_policies WHERE tablename = 'monitoring_area_report' AND policyname = 'Admins can delete monitoring reports'`,
        sql: `CREATE POLICY "Admins can delete monitoring reports" ON monitoring_area_report FOR DELETE USING (is_admin_user(auth.uid()));`,
      },
      {
        name: 'Admins can create report areas',
        check: `SELECT 1 FROM pg_policies WHERE tablename = 'report_areas' AND policyname = 'Admins can create report areas'`,
        sql: `CREATE POLICY "Admins can create report areas" ON report_areas FOR INSERT WITH CHECK (is_admin_user(auth.uid()));`,
      },
      {
        name: 'Admins can update report areas',
        check: `SELECT 1 FROM pg_policies WHERE tablename = 'report_areas' AND policyname = 'Admins can update report areas'`,
        sql: `CREATE POLICY "Admins can update report areas" ON report_areas FOR UPDATE USING (is_admin_user(auth.uid()));`,
      },
      {
        name: 'Admins can delete report areas',
        check: `SELECT 1 FROM pg_policies WHERE tablename = 'report_areas' AND policyname = 'Admins can delete report areas'`,
        sql: `CREATE POLICY "Admins can delete report areas" ON report_areas FOR DELETE USING (is_admin_user(auth.uid()));`,
      },
    ];

    console.log('Applying RLS policies for admin INSERT permissions...\n');

    for (const migration of migrations) {
      // Check if policy already exists
      const checkResult = await client.query(migration.check);

      if (checkResult.rows.length > 0) {
        console.log(`⏭️  ${migration.name} - already exists, skipping`);
        continue;
      }

      try {
        await client.query(migration.sql);
        console.log(`✅ ${migration.name} - created`);
      } catch (err: any) {
        if (err.message.includes('already exists')) {
          console.log(`⏭️  ${migration.name} - already exists`);
        } else {
          console.error(`❌ ${migration.name} - error: ${err.message}`);
        }
      }
    }

    console.log('\nMigration complete!');
  } catch (err: any) {
    console.error('Error:', err.message);
    console.log('\nFallback: Run this SQL directly in Supabase Studio:');
    printSQL();
  } finally {
    await client.end();
  }
}

applyMigration();
