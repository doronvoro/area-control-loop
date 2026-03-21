import { NextResponse } from 'next/server';
import { getApiContext, resolveCustomerId } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getWorkerTypeIds } from '@/lib/api/utils';
import { getFindings, getUnitTypes, getCustomers } from '@/lib/services/lookup.service';
import { getCustomerAreasWithCrops } from '@/lib/services/customer-area.service';

export async function GET() {
  try {
    const ctx = await getApiContext();
    const customerIdForData = resolveCustomerId(ctx);

    // Fetch common lookup data
    const [customers, findings, unitTypes] = await Promise.all([
      ctx.isAdmin ? getCustomers(ctx.supabase) : Promise.resolve([]),
      getFindings(ctx.supabase),
      getUnitTypes(ctx.supabase),
    ]);

    let initialAreas: any[] = [];
    let initialWorkers: any[] = [];

    if (customerIdForData) {
      const actionWorkerTypeIds = await getWorkerTypeIds(ctx.supabase, ['action_worker', 'super_worker']);

      const [areas, workersRes] = await Promise.all([
        getCustomerAreasWithCrops(ctx.supabase, customerIdForData),
        actionWorkerTypeIds.length > 0
          ? ctx.supabase
              .from('workers')
              .select('*, worker_types(*)')
              .eq('customer_id', customerIdForData)
              .in('type_id', actionWorkerTypeIds)
          : Promise.resolve({ data: [] }),
      ]);

      initialAreas = areas;
      initialWorkers = workersRes.data || [];
    } else if (ctx.isAdmin) {
      const actionWorkerTypeIds = await getWorkerTypeIds(ctx.supabase, ['action_worker', 'super_worker']);

      if (actionWorkerTypeIds.length > 0) {
        const { data: allWorkers } = await ctx.supabase
          .from('workers')
          .select('*, worker_types(*)')
          .in('type_id', actionWorkerTypeIds);
        initialWorkers = allWorkers || [];
      }
    }

    return NextResponse.json({
      isAdmin: ctx.isAdmin,
      customers,
      initialAreas,
      initialWorkers,
      findings,
      unitTypes,
      currentWorkerId: ctx.worker?.id || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
