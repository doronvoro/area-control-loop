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
    const [allCustomers, findings, unitTypes] = await Promise.all([
      ctx.isAdmin ? getCustomers(ctx.supabase) : Promise.resolve([]),
      getFindings(ctx.supabase),
      getUnitTypes(ctx.supabase),
    ]);

    // An admin with a customer selected must not be offered a different one
    // here. This form has its own customer dropdown, so two pickers that can
    // disagree means submitting a report against a tenant other than the one
    // shown in the nav — with nothing on screen indicating the mismatch.
    const customers =
      ctx.isAdmin && customerIdForData
        ? allCustomers.filter((c: { id: string }) => c.id === customerIdForData)
        : allCustomers;

    // Pre-fetch inspectors and areas for whoever has a resolved customer. This
    // used to be guarded on !ctx.isAdmin, so an admin got empty lists and had
    // to pick a customer in the form first; with a selection they now take the
    // same path as an owner.
    let initialInspectors: any[] = [];
    let initialAreas: any[] = [];

    if (customerIdForData) {
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
