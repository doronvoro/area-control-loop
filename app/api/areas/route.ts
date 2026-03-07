import { NextResponse } from 'next/server';
import { getApiContext, checkPermission, resolveCustomerId } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    const targetCustomerId = resolveCustomerId(ctx, customerId);

    if (!targetCustomerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await ctx.supabase
      .from('customer_areas')
      .select('area_id, areas(*, crops(*))')
      .eq('customer_id', targetCustomerId);

    if (error) throw error;

    const areas = data?.map((item: any) => item.areas).filter(Boolean) || [];

    return NextResponse.json(areas);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!(await checkPermission(ctx, 'update_area'))) {
      return NextResponse.json({ error: 'אין הרשאה לעדכן שטח' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, variety, planting_time, crop_id, size, size_unit_type, geometry, area_type } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'id ו-name נדרשים' }, { status: 400 });
    }

    const { data, error } = await (ctx.adminClient.from('areas') as any)
      .update({
        name,
        description: description || null,
        variety: variety || null,
        planting_time: planting_time || null,
        crop_id: crop_id || null,
        size: size ?? null,
        size_unit_type: size_unit_type || null,
        ...(geometry !== undefined ? { geometry: geometry || null } : {}),
        ...(area_type ? { area_type } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!(await checkPermission(ctx, 'create_area'))) {
      return NextResponse.json({ error: 'אין הרשאה ליצור שטח' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, variety, planting_time, customer_id, crop_id, size, size_unit_type, geometry, area_type } = body;

    if (!name) {
      return NextResponse.json({ error: 'name נדרש' }, { status: 400 });
    }

    const { data: areaData, error: areaError } = await (ctx.adminClient.from('areas') as any)
      .insert({
        name,
        description: description || null,
        variety: variety || null,
        planting_time: planting_time || null,
        crop_id: crop_id || null,
        size: size ?? null,
        size_unit_type: size_unit_type || null,
        ...(geometry !== undefined ? { geometry: geometry || null } : {}),
        ...(area_type ? { area_type } : {}),
      })
      .select()
      .single();

    if (areaError) throw areaError;

    if (customer_id && areaData) {
      const { error: linkError } = await (ctx.adminClient.from('customer_areas') as any)
        .insert({ customer_id, area_id: areaData.id });

      if (linkError) {
        console.error('Error linking area to customer:', linkError);
      }
    }

    return NextResponse.json(areaData, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!(await checkPermission(ctx, 'delete_area'))) {
      return NextResponse.json({ error: 'אין הרשאה למחוק שטח' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id נדרש' }, { status: 400 });
    }

    const { error } = await (ctx.adminClient.from('areas') as any).delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
