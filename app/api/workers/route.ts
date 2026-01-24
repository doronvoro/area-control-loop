import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentCustomer, getCurrentWorker, requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const type = searchParams.get('type'); // 'inspector' or 'action_worker'

    const supabase = await createClient();
    const customer = await getCurrentCustomer();
    const worker = await getCurrentWorker();

    const targetCustomerId =
      customerId || (customer as any)?.id || (worker as any)?.customer_id;

    if (!targetCustomerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = supabase
      .from('workers')
      .select('*, worker_types(*), customers(*)')
      .eq('customer_id', targetCustomerId);

    if (type) {
      // Get worker type by name
      const { data: workerType } = await supabase
        .from('worker_types')
        .select('id')
        .eq('name', type)
        .single();

      if (workerType && (workerType as any).id) {
        query = query.eq('type_id', (workerType as any).id);
      }
    }

    const { data, error } = await query.order('name');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
