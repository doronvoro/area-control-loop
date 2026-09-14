import { NextResponse } from 'next/server';
import { getApiContext, checkPermission, resolveCustomerId } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!(await checkPermission(ctx, 'add_area_to_customer'))) {
      return NextResponse.json({ error: 'אין הרשאה להקצאת שטח ללקוח' }, { status: 403 });
    }

    const body = await request.json();
    const { customer_id, area_id } = body;

    if (!customer_id || !area_id) {
      return NextResponse.json({ error: 'customer_id ו-area_id נדרשים' }, { status: 400 });
    }

    const { data: existing } = await (ctx.adminClient.from('customer_areas') as any)
      .select('id')
      .eq('customer_id', customer_id)
      .eq('area_id', area_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'השטח כבר משויך ללקוח זה' }, { status: 400 });
    }

    const { data, error } = await (ctx.adminClient.from('customer_areas') as any)
      .insert({ customer_id, area_id })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!(await checkPermission(ctx, 'remove_area_from_customer'))) {
      return NextResponse.json({ error: 'אין הרשאה להסרת שטח מלקוח' }, { status: 403 });
    }

    const body = await request.json();
    const { customer_id, area_id } = body;

    if (!customer_id || !area_id) {
      return NextResponse.json({ error: 'customer_id ו-area_id נדרשים' }, { status: 400 });
    }

    const { error } = await (ctx.adminClient.from('customer_areas') as any)
      .delete()
      .eq('customer_id', customer_id)
      .eq('area_id', area_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    // This handler read every customer↔area pair — including customer names —
    // through adminClient, for any authenticated user, with ?customerId= as an
    // unchecked filter. It is the one route where the ungated override in
    // resolveCustomerId was a genuine cross-tenant read rather than something
    // RLS quietly absorbed.
    const scopedCustomerId = resolveCustomerId(ctx, customerId);

    if (!scopedCustomerId && !ctx.isAdmin) {
      // A user with no tenancy (self-registered, no customer or worker row)
      // gets nothing rather than everything.
      return NextResponse.json([]);
    }

    // ctx.supabase, not adminClient: the admin RLS policies are in place, so
    // this keeps RLS as a backstop underneath the explicit filter instead of
    // making the filter the only thing standing between tenants.
    let query = (ctx.supabase.from('customer_areas') as any)
      .select('id, customer_id, area_id, areas(id, name, description, crop_id, area_type, geometry, crops(id, name, description)), customers(id, name)');

    if (scopedCustomerId) {
      query = query.eq('customer_id', scopedCustomerId);
    }
    // An admin with no selection still sees every tenant here; phase 5 of the
    // customer switcher changes that to an empty result.

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    return handleApiError(error);
  }
}
