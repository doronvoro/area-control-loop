import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentCustomer, getCurrentWorker, requireAuth } from '@/lib/auth';
import { hasPermission, hasRole } from '@/lib/permissions';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    const supabase = await createClient();
    const customer = await getCurrentCustomer();
    const worker = await getCurrentWorker();

    // If customerId is provided, filter by it
    // Otherwise, get areas for current user's customer
    const targetCustomerId =
      customerId || (customer as any)?.id || (worker as any)?.customer_id;

    if (!targetCustomerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('customer_areas')
      .select('area_id, areas(*, crops(*))')
      .eq('customer_id', targetCustomerId);

    if (error) throw error;

    const areas = data?.map((item: any) => item.areas).filter(Boolean) || [];

    return NextResponse.json(areas);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAuth();

    // Check permission
    const canUpdate = await hasPermission('update_area');
    if (!canUpdate) {
      return NextResponse.json(
        { error: 'אין הרשאה לעדכן שטח' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, description, crop_id, size, size_unit_type } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: 'id ו-name נדרשים' },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS (permissions already checked above)
    const adminClient = createAdminClient();
    const { data, error } = await (adminClient
      .from('areas') as any)
      .update({
        name,
        description: description || null,
        crop_id: crop_id || null,
        size: size ?? null,
        size_unit_type: size_unit_type || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();

    // Check permission
    const canCreate = await hasPermission('create_area');
    if (!canCreate) {
      return NextResponse.json(
        { error: 'אין הרשאה ליצור שטח' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, customer_id, crop_id, size, size_unit_type } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name נדרש' },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS (permissions already checked above)
    const adminClient = createAdminClient();

    // Create area
    const { data: areaData, error: areaError } = await (adminClient
      .from('areas') as any)
      .insert({
        name,
        description: description || null,
        crop_id: crop_id || null,
        size: size ?? null,
        size_unit_type: size_unit_type || null,
      })
      .select()
      .single();

    if (areaError) throw areaError;

    // If customer_id is provided, link area to customer
    if (customer_id && areaData) {
      const { error: linkError } = await (adminClient
        .from('customer_areas') as any)
        .insert({
          customer_id,
          area_id: areaData.id,
        });

      if (linkError) {
        console.error('Error linking area to customer:', linkError);
        // Don't fail the request, area was created successfully
      }
    }

    return NextResponse.json(areaData, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();

    // Check permission
    const canDelete = await hasPermission('delete_area');
    if (!canDelete) {
      return NextResponse.json(
        { error: 'אין הרשאה למחוק שטח' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id נדרש' },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS (permissions already checked above)
    const adminClient = createAdminClient();
    const { error } = await (adminClient
      .from('areas') as any)
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
