import { NextRequest, NextResponse } from 'next/server';
import { getApiContext, requireAdminOrCustomerOwner } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getCrops } from '@/lib/services/lookup.service';

export async function GET() {
  try {
    const ctx = await getApiContext();
    return NextResponse.json(await getCrops(ctx.supabase));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getApiContext();
    const forbidden = await requireAdminOrCustomerOwner(ctx);
    if (forbidden) return forbidden;

    const body = await request.json();
    const { name, description, parent_crop_id } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'שם גידול נדרש' }, { status: 400 });
    }

    const { data, error } = await (ctx.adminClient.from('crops') as any)
      .insert({ name: name.trim(), description: description?.trim() || null, parent_crop_id: parent_crop_id || null })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'גידול עם שם זה כבר קיים' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await getApiContext();
    const forbidden = await requireAdminOrCustomerOwner(ctx);
    if (forbidden) return forbidden;

    const body = await request.json();
    const { id, name, description, parent_crop_id } = body;

    if (!id) return NextResponse.json({ error: 'מזהה גידול נדרש' }, { status: 400 });
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'שם גידול נדרש' }, { status: 400 });
    }

    const { data, error } = await (ctx.adminClient.from('crops') as any)
      .update({ name: name.trim(), description: description?.trim() || null, parent_crop_id: parent_crop_id || null })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getApiContext();
    const forbidden = await requireAdminOrCustomerOwner(ctx);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'מזהה גידול נדרש' }, { status: 400 });

    const { error } = await (ctx.adminClient.from('crops') as any).delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
