/**
 * Apply RLS fix using direct PostgreSQL connection
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Try to use pg if available, otherwise provide instructions
let Pool: any;
try {
  const pg = require('pg');
  Pool = pg.Pool;
} catch (e) {
  console.log('⚠️  pg package not found. Installing...');
  console.log('   Run: npm install pg @types/pg');
  console.log('   Then run this script again.\n');
  process.exit(1);
}

const pool = new Pool({
  host: '127.0.0.1',
  port: 54322,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
});

async function applyRLS() {
  console.log('🔧 Applying RLS fix using direct PostgreSQL connection...\n');

  try {
    const sqlPath = join(process.cwd(), 'supabase/migrations/20260125000000_fix_admin_rls_policies.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Split SQL properly, handling function definitions with $$
    const statements: string[] = [];
    let currentStatement = '';
    let inFunction = false;
    let dollarTag = '';
    
    const lines = sql.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments
      if (trimmed.startsWith('--') || trimmed.startsWith('/*') || trimmed === '') {
        continue;
      }
      
      currentStatement += line + '\n';
      
      // Check for function start
      if (trimmed.includes('CREATE OR REPLACE FUNCTION') || trimmed.includes('CREATE FUNCTION')) {
        inFunction = true;
        // Extract dollar tag (e.g., $$ or $tag$)
        const match = trimmed.match(/\$([^$]*)\$/);
        if (match) {
          dollarTag = match[0];
        }
      }
      
      // Check for function end
      if (inFunction && trimmed.includes('$$') && trimmed.includes('LANGUAGE')) {
        inFunction = false;
        statements.push(currentStatement.trim());
        currentStatement = '';
      } else if (!inFunction && trimmed.endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    // Filter out empty statements
    const filteredStatements = statements.filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        try {
          const displayText = statement.substring(0, 60).replace(/\n/g, ' ');
          console.log(`[${i + 1}/${statements.length}] Executing: ${displayText}...`);
          
          await pool.query(statement + ';');
          console.log(`   ✅ Success`);
        } catch (err: any) {
          if (err.message.includes('already exists') || err.message.includes('does not exist')) {
            console.log(`   ⚠️  ${err.message.split('\n')[0]}`);
          } else {
            console.log(`   ❌ Error: ${err.message.split('\n')[0]}`);
            throw err;
          }
        }
      }
    }

    // Verify function exists
    const { rows } = await pool.query(
      "SELECT proname FROM pg_proc WHERE proname = 'is_admin_user'"
    );
    
    if (rows.length > 0) {
      console.log('\n✅ Function verified: is_admin_user exists');
    }

    console.log('\n✅ RLS fix applied successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Try logging in to the app again');
    console.log('   2. You should now be able to see all data\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Alternative: Run the SQL manually in Supabase Studio');
    console.error('   http://127.0.0.1:54323 → SQL Editor\n');
  } finally {
    await pool.end();
  }
}

applyRLS();
