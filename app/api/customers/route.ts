import { NextResponse } from 'next/server';
import { getApiContext, checkPermission } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { createUserWithRole } from '@/lib/api/utils';
import {
  buildCustomerInsert,
  buildCustomerUpdate,
  getLoginEmails,
  isCustomerType,
} from '@/lib/services/customer.service';

export async function GET() {
  try {
    const ctx = await getApiContext();

    if (ctx.isAdmin) {
      const { data, error } = await ctx.supabase
        .from('customers')
        .select('*')
        .order('name');
      if (error) throw error;

      // login_email is auth.users' address, not a customers column — the admin
      // grid shows it beside contact_email so the two are never confused. Only
      // for admins: a customer_owner knows their own login address.
      const rows = (data as { user_id: string }[]) || [];
      const emails = await getLoginEmails(
        ctx.adminClient,
        rows.map((row) => row.user_id).filter(Boolean)
      );

      return NextResponse.json(
        rows.map((row) => ({ ...row, login_email: emails[row.user_id] ?? null }))
      );
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
    const { name, email, password } = body;

    if (!name) return NextResponse.json({ error: 'שם הלקוח נדרש' }, { status: 400 });
    if (!email || !password) return NextResponse.json({ error: 'אימייל וסיסמה נדרשים' }, { status: 400 });

    // Checked here rather than left to the CHECK constraint, which would surface
    // as an English 500 through handleApiError.
    if (!isCustomerType(body.customer_type)) {
      return NextResponse.json({ error: 'נדרש לבחור סוג לקוח' }, { status: 400 });
    }

    const { record } = await createUserWithRole(ctx.adminClient, {
      email,
      password,
      name,
      roleName: 'customer_owner',
      userMetadataRole: 'customer_owner',
      insertRecord: async (userId: string) => {
        return await (ctx.adminClient.from('customers') as any)
          .insert(buildCustomerInsert(body, userId))
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
    const { id, name } = body;

    if (!id || !name) return NextResponse.json({ error: 'id ו-name נדרשים' }, { status: 400 });

    if ('customer_type' in body && !isCustomerType(body.customer_type)) {
      return NextResponse.json({ error: 'נדרש לבחור סוג לקוח' }, { status: 400 });
    }

    // customer_owner ALSO holds update_customer (006_roles_and_permissions.sql),
    // so the permission check above does not say WHICH customer. RLS used to
    // answer that by matching zero rows — which is exactly why an admin editing
    // another tenant got .single()'s "no rows" error instead of an update, since
    // `customers` has no admin-UPDATE policy.
    //
    // The write below runs on adminClient, which takes RLS out of the decision
    // entirely. This check is the only boundary left. Do not remove it.
    if (!ctx.isAdmin && ctx.customer?.id !== id) {
      return NextResponse.json({ error: 'אין הרשאה לעדכן לקוח זה' }, { status: 403 });
    }

    const { data, error } = await (ctx.adminClient.from('customers') as any)
      .update({
        ...buildCustomerUpdate(body, { isAdmin: ctx.isAdmin }),
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
