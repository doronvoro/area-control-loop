import { NextResponse } from 'next/server';
import { getApiContext, resolveCustomerId } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getWorkerTypeId } from '@/lib/api/utils';

export async function GET() {
  try {
    const ctx = await getApiContext();
    const customerIdForData = resolveCustomerId(ctx);

    // Fetch common lookup data
    const [customersResult, findingsResult, actionTypesResult, unitTypesResult] = await Promise.all([
      ctx.isAdmin ? ctx.supabase.from('customers').select('*').order('name') : { data: [] },
      ctx.supabase.from('findings').select('*').order('name'),
      ctx.supabase.from('action_types').select('*').order('name'),
      ctx.supabase.from('unit_types').select('*').order('name'),
    ]);

    let initialAreas: any[] = [];
    let initialWorkers: any[] = [];

    if (customerIdForData) {
      const actionWorkerTypeId = await getWorkerTypeId(ctx.supabase, 'action_worker');

      const [areasRes, workersRes] = await Promise.all([
        ctx.supabase
          .from('customer_areas')
          .select('areas(*)')
          .eq('customer_id', customerIdForData),
        actionWorkerTypeId
          ? ctx.supabase
              .from('workers')
              .select('*, worker_types(*)')
              .eq('customer_id', customerIdForData)
              .eq('type_id', actionWorkerTypeId)
          : Promise.resolve({ data: [] }),
      ]);

      initialAreas = (areasRes.data || []).map((ca: any) => ca.areas).filter(Boolean);
      initialWorkers = workersRes.data || [];
    } else if (ctx.isAdmin) {
      const actionWorkerTypeId = await getWorkerTypeId(ctx.supabase, 'action_worker');

      if (actionWorkerTypeId) {
        const { data: allWorkers } = await ctx.supabase
          .from('workers')
          .select('*, worker_types(*)')
          .eq('type_id', actionWorkerTypeId);
        initialWorkers = allWorkers || [];
      }
    }

    return NextResponse.json({
      isAdmin: ctx.isAdmin,
      customers: customersResult.data || [],
      initialAreas,
      initialWorkers,
      findings: findingsResult.data || [],
      actionTypes: actionTypesResult.data || [],
      unitTypes: unitTypesResult.data || [],
      currentWorkerId: ctx.worker?.id || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
