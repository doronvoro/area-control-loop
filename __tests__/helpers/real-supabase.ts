/**
 * Creates a real Supabase client for integration tests.
 * Uses the service role key to bypass RLS (matching the import route behavior).
 * Connects to local Supabase at 127.0.0.1:54321.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Local Supabase credentials (from .env.local.docker / npx supabase start)
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

let client: SupabaseClient | null = null;

export function createTestSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/**
 * Clean up all data created by a test import.
 * Deletes in reverse dependency order to respect foreign keys.
 */
export async function cleanupImport(
  supabase: SupabaseClient,
  batchId: string,
  cropIds: string[],
  findingIds: string[],
  materialIds: string[]
): Promise<void> {
  // 1. Delete recommend_material for these crops
  if (cropIds.length > 0) {
    await (supabase.from('recommend_material') as any)
      .delete()
      .in('crop_id', cropIds);
  }

  // 2. Delete crop_findings for these crops
  if (cropIds.length > 0) {
    await (supabase.from('crop_findings') as any)
      .delete()
      .in('crop_id', cropIds);
  }

  // 3. Delete pesticide_registry for this batch
  await (supabase.from('pesticide_registry') as any)
    .delete()
    .eq('import_batch_id', batchId);

  // 4. Delete import batch
  await (supabase.from('import_batches') as any)
    .delete()
    .eq('id', batchId);

  // 5. Delete lookup entries created by this import (source='registry')
  // Only delete if these IDs exist (avoids deleting pre-existing data)
  if (findingIds.length > 0) {
    await (supabase.from('findings') as any)
      .delete()
      .eq('source', 'registry')
      .in('id', findingIds);
  }
  if (materialIds.length > 0) {
    await (supabase.from('materials') as any)
      .delete()
      .eq('source', 'registry')
      .in('id', materialIds);
  }
  if (cropIds.length > 0) {
    await (supabase.from('crops') as any)
      .delete()
      .eq('source', 'registry')
      .in('id', cropIds);
  }
}
