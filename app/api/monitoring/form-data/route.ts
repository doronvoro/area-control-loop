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

    // Fetch data based on role
    const [customers, findings, unitTypes] = await Promise.all([
      ctx.isAdmin ? getCustomers(ctx.supabase) : Promise.resolve([]),
      getFindings(ctx.supabase),
      getUnitTypes(ctx.supabase),
    ]);

    // For non-admin users, pre-fetch inspectors and areas for their customer
    let initialInspectors: any[] = [];
    let initialAreas: any[] = [];

    if (!ctx.isAdmin && customerIdForData) {
      const inspectorTypeIds = await getWorkerTypeIds(ctx.supabase, ['inspector', 'super_worker']);

      const [areas, inspectorsRes] = await Promise.all([
        getCustomerAreasWithCrops(ctx.supabase, customerIdForData),
        inspectorTypeIds.length > 0
          ? ctx.supabase
              .from('workers')
              .select('*, worker_types(*)')
              .eq('customer_id', customerIdForData)
              .in('type_id', inspectorTypeIds)
          : Promise.resolve({ data: [] }),
      ]);

      initialAreas = areas;
      initialInspectors = inspectorsRes.data || [];
    }

    return NextResponse.json({
      isAdmin: ctx.isAdmin,
      customers,
      initialInspectors,
      initialAreas,
      findings,
      unitTypes,
      customerIdForData,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
