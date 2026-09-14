import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertAreaVisible } from '@/lib/api/utils';
import { AuthError } from '@/lib/auth';
import { createMockSupabase } from '../helpers/mock-supabase';

/**
 * The guard on cross-tenant writes.
 *
 * findOrCreateReportArea reads an area through the RLS-scoped client and then
 * inserts through adminClient, which bypasses RLS. POST /api/monitoring and
 * POST /api/actions both take area_id straight from the request body, so if the
 * read result is not enforced there is nothing between a guessed id and a row
 * in another tenant's data.
 *
 * The read was already there. Its empty result was discarded with
 * `areaData?.name || 'אזור'` — the fallback string is what made the hole
 * invisible, because the insert then succeeded with a plausible-looking name.
 */

const supabase = createMockSupabase({
  areas: [
    { id: 'area-mine', name: 'חלקה שלי' },
    // 'area-theirs' is deliberately absent: an area the RLS client cannot see
    // returns no row, which is exactly what another tenant's area looks like.
  ],
}) as unknown as SupabaseClient;

describe('assertAreaVisible', () => {
  it('returns the area name when the caller can see it', async () => {
    await expect(assertAreaVisible(supabase, 'area-mine')).resolves.toBe('חלקה שלי');
  });

  it('throws when the area is not visible to the caller', async () => {
    await expect(assertAreaVisible(supabase, 'area-theirs')).rejects.toThrow(AuthError);
  });

  it('throws 403, not 404 — existence is itself tenant information', async () => {
    // A 404 would confirm the id is unused and a 403 that it is taken, which
    // turns the endpoint into an oracle for enumerating other tenants' areas.
    await expect(assertAreaVisible(supabase, 'area-theirs')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('fails with a message the UI can show', async () => {
    // Surfaced to the user through handleApiError, so it is Hebrew and says
    // what happened rather than leaking that the id exists elsewhere.
    await expect(assertAreaVisible(supabase, 'area-theirs')).rejects.toThrow(
      'אין הרשאה לדווח על שטח זה'
    );
  });

  it('never returns the placeholder that hid the hole', async () => {
    // The old code returned 'אזור' for an unseen area and let the write
    // proceed, which is why the report looked normal in the list afterwards.
    // Any resolved value must be a real area name.
    await expect(assertAreaVisible(supabase, 'area-mine')).resolves.not.toBe('אזור');
  });
});
