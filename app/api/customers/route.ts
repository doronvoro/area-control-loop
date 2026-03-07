import { NextResponse } from 'next/server';
import { getApiContext, checkPermission } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { createUserWithRole } from '@/lib/api/utils';

export async function GET() {
  try {
    const ctx = await getApiContext();

    if (ctx.isAdmin) {
      const { data, error } = await ctx.supabase
        .from('customers')
        .select('*')
        .order('name');
      if (error) throw error;
      return NextResponse.json(data);
    }

    if (ctx.customer) {
      return NextResponse.json([ctx.customer]);
    }

    return NextResponse.json({ error: 'אין הרשאה לצפות בלקוחות' }, { status: 403 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!(await checkPermission(ctx, 'create_customer'))) {
      return NextResponse.json({ error: 'אין הרשאה ליצור לקוח' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, email, password } = body;

    if (!name) return NextResponse.json({ error: 'שם הלקוח נדרש' }, { status: 400 });
    if (!email || !password) return NextResponse.json({ error: 'אימייל וסיסמה נדרשים' }, { status: 400 });

    const { record } = await createUserWithRole(ctx.adminClient, {
      email,
      password,
      name,
      roleName: 'customer_owner',
      userMetadataRole: 'customer_owner',
      insertRecord: async (userId: string) => {
        return await (ctx.adminClient.from('customers') as any)
          .insert({ user_id: userId, name, description: description || null })
          .select()
          .single();
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!(await checkPermission(ctx, 'update_customer'))) {
      return NextResponse.json({ error: 'אין הרשאה לעדכן לקוח' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description } = body;

    if (!id || !name) return NextResponse.json({ error: 'id ו-name נדרשים' }, { status: 400 });

    const { data, error } = await (ctx.supabase.from('customers') as any)
      .update({ name, description: description || null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!(await checkPermission(ctx, 'delete_customer'))) {
      return NextResponse.json({ error: 'אין הרשאה למחוק לקוח' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'id נדרש' }, { status: 400 });

    const { data: customer } = await (ctx.adminClient.from('customers') as any)
      .select('user_id')
      .eq('id', id)
      .single();

    const { error } = await (ctx.adminClient.from('customers') as any).delete().eq('id', id);
    if (error) throw error;

    if (customer?.user_id) {
      await ctx.adminClient.auth.admin.deleteUser(customer.user_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
