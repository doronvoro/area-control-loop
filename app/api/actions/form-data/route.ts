import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth, getCurrentWorker } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';

export async function GET() {
  try {
    await requireAuth();

    const supabase = await createClient();
    const isAdmin = await hasRole('admin');
    const currentWorker = (await getCurrentWorker()) as { id: string; customer_id: string } | null;

    // Fetch common lookup data
    const [customersResult, findingsResult, actionTypesResult, unitTypesResult] = await Promise.all([
      isAdmin ? supabase.from('customers').select('*').order('name') : { data: [] },
      supabase.from('findings').select('*').order('name'),
      supabase.from('action_types').select('*').order('name'),
      supabase.from('unit_types').select('*').order('name'),
    ]);

    // For non-admin users, get their customer's areas and action workers
    let initialAreas: any[] = [];
    let initialWorkers: any[] = [];

    if (!isAdmin && currentWorker?.customer_id) {
      const [areasRes, workersRes] = await Promise.all([
        supabase
          .from('customer_areas')
          .select('areas(*)')
          .eq('customer_id', currentWorker.customer_id),
        supabase
          .from('workers')
          .select('*, worker_types!inner(*)')
          .eq('customer_id', currentWorker.customer_id)
          .eq('worker_types.name', 'action_worker'),
      ]);

      initialAreas = (areasRes.data || []).map((ca: any) => ca.areas).filter(Boolean);
      initialWorkers = workersRes.data || [];
    }

    return NextResponse.json({
      isAdmin,
      customers: customersResult.data || [],
      initialAreas,
      initialWorkers,
      findings: findingsResult.data || [],
      actionTypes: actionTypesResult.data || [],
      unitTypes: unitTypesResult.data || [],
      currentWorkerId: currentWorker?.id || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
