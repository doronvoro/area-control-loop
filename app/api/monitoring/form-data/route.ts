import { NextResponse } from 'next/server';
import { getApiContext, resolveCustomerId } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getWorkerTypeIds } from '@/lib/api/utils';

export async function GET() {
  try {
    const ctx = await getApiContext();
    const customerIdForData = resolveCustomerId(ctx);

    // Fetch data based on role
    const [customersResult, findingsResult, unitTypesResult] = await Promise.all([
      ctx.isAdmin ? ctx.supabase.from('customers').select('*').order('name') : { data: [] },
      ctx.supabase.from('findings').select('*').order('name'),
      ctx.supabase.from('unit_types').select('*').order('name'),
    ]);

    // For non-admin users, pre-fetch inspectors and areas for their customer
    let initialInspectors: any[] = [];
    let initialAreas: any[] = [];

    if (!ctx.isAdmin && customerIdForData) {
      const inspectorTypeIds = await getWorkerTypeIds(ctx.supabase, ['inspector', 'super_worker']);

      const [areasRes, inspectorsRes] = await Promise.all([
        ctx.supabase
          .from('customer_areas')
          .select('areas(*, crops(*))')
          .eq('customer_id', customerIdForData),
        inspectorTypeIds.length > 0
          ? ctx.supabase
              .from('workers')
              .select('*, worker_types(*)')
              .eq('customer_id', customerIdForData)
              .in('type_id', inspectorTypeIds)
          : Promise.resolve({ data: [] }),
      ]);

      initialAreas = (areasRes.data || []).map((ca: any) => ca.areas).filter(Boolean);
      initialInspectors = inspectorsRes.data || [];
    }

    return NextResponse.json({
      isAdmin: ctx.isAdmin,
      customers: customersResult.data || [],
      initialInspectors,
      initialAreas,
      findings: findingsResult.data || [],
      unitTypes: unitTypesResult.data || [],
      customerIdForData,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
