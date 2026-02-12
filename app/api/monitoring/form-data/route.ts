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

    // Fetch data based on role
    const [customersResult, findingsResult, unitTypesResult] = await Promise.all([
      isAdmin ? supabase.from('customers').select('*').order('name') : { data: [] },
      supabase.from('findings').select('*').order('name'),
      supabase.from('unit_types').select('*').order('name'),
    ]);

    // For non-admin users, pre-fetch inspectors and areas for their customer
    let initialInspectors: any[] = [];
    let initialAreas: any[] = [];

    if (!isAdmin && customerIdForData) {
      const { data: inspectorType } = await supabase
        .from('worker_types')
        .select('id')
        .eq('name', 'inspector')
        .single();

      const [areasRes, inspectorsRes] = await Promise.all([
        supabase
          .from('customer_areas')
          .select('areas(*)')
          .eq('customer_id', customerIdForData),
        inspectorType
          ? supabase
              .from('workers')
              .select('*, worker_types(*)')
              .eq('customer_id', customerIdForData)
              .eq('type_id', (inspectorType as any).id)
          : Promise.resolve({ data: [] }),
      ]);

      initialAreas = (areasRes.data || []).map((ca: any) => ca.areas).filter(Boolean);
      initialInspectors = inspectorsRes.data || [];
    }

    return NextResponse.json({
      isAdmin,
      customers: customersResult.data || [],
      initialInspectors,
      initialAreas,
      findings: findingsResult.data || [],
      unitTypes: unitTypesResult.data || [],
      customerIdForData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
