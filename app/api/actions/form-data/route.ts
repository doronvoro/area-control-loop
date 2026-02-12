import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth, getCurrentWorker, getCurrentCustomer } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';

export async function GET() {
  try {
    await requireAuth();

    const supabase = await createClient();
    const isAdmin = await hasRole('admin');
    const currentWorker = (await getCurrentWorker()) as { id: string; customer_id: string } | null;
    const currentCustomer = (await getCurrentCustomer()) as { id: string } | null;

    // Determine customer_id from worker or customer owner
    const customerIdForData = currentWorker?.customer_id || currentCustomer?.id || null;

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

    if (!isAdmin && customerIdForData) {
      // Look up the action_worker type ID
      const { data: actionWorkerType } = await supabase
        .from('worker_types')
        .select('id')
        .eq('name', 'action_worker')
        .single();

      const [areasRes, workersRes] = await Promise.all([
        supabase
          .from('customer_areas')
          .select('areas(*)')
          .eq('customer_id', customerIdForData),
        actionWorkerType
          ? supabase
              .from('workers')
              .select('*, worker_types(*)')
              .eq('customer_id', customerIdForData)
              .eq('type_id', (actionWorkerType as any).id)
          : Promise.resolve({ data: [] }),
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
