import { NextResponse } from 'next/server';
import { getApiContext, checkPermission, resolveCustomerId } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getWorkerTypeId, getWorkerTypeIds, createUserWithRole } from '@/lib/api/utils';
import { assertCustomerInScope, assertRowInScope } from '@/lib/api/tenancy';

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const type = searchParams.get('type');
    const all = searchParams.get('all');

    // Admin listing. ?all=true used to mean "every worker in the database"
    // regardless of the selected customer, so /admin/workers showed all four
    // tenants' staff mixed together with nothing on screen saying so. It now
    // respects the selection; an explicit ?customerId= still overrides it.
    if (all === 'true' && ctx.isAdmin) {
      const scopedCustomerId = resolveCustomerId(ctx, customerId);

      if (!scopedCustomerId) {
        // Admin with no customer selected is scoped to nothing, as everywhere
        // else. The "choose a customer" banner explains the empty screen.
        return NextResponse.json([]);
      }

      let query = ctx.supabase
        .from('workers')
        .select('*, worker_types(*), customers(*)')
        .eq('customer_id', scopedCustomerId);

      if (type) {
        const typeNames = type === 'super_worker' ? ['super_worker'] : [type, 'super_worker'];
        const typeIds = await getWorkerTypeIds(ctx.supabase, typeNames);
        if (typeIds.length > 0) {
          query = query.in('type_id', typeIds);
        }
      }

      const { data, error } = await query.order('name');
      if (error) throw error;

      // Fetch emails from auth.users
      const workersWithEmail = await Promise.all(
        (data || []).map(async (worker: any) => {
          try {
            const { data: userData, error: userError } = await ctx.adminClient.auth.admin.getUserById(worker.user_id);
            if (userError) {
              console.error(`Failed to fetch user ${worker.user_id}:`, userError.message);
              return { ...worker, email: null };
            }
            return { ...worker, email: userData?.user?.email || null };
          } catch (e) {
            console.error(`Error fetching user ${worker.user_id}:`, e);
            return { ...worker, email: null };
          }
        })
      );

      return NextResponse.json(workersWithEmail);
    }

    // Non-admin: get workers for current customer only
    const targetCustomerId = resolveCustomerId(ctx, customerId);

    if (!targetCustomerId) {
      // 200 with an empty list rather than a 401: there is no global 401
      // handler on the client, so this rendered the English word
      // "Unauthorized" in a red box inside a Hebrew RTL app.
      return NextResponse.json([]);
    }

    let query = ctx.supabase
      .from('workers')
      .select('*, worker_types(*), customers(*)')
      .eq('customer_id', targetCustomerId);

    if (type) {
      const typeNames = type === 'super_worker' ? ['super_worker'] : [type, 'super_worker'];
      const typeIds = await getWorkerTypeIds(ctx.supabase, typeNames);
      if (typeIds.length > 0) {
        query = query.in('type_id', typeIds);
      }
    }

    const { data, error } = await query.order('name');
    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!(await checkPermission(ctx, 'create_worker'))) {
      return NextResponse.json({ error: 'אין הרשאה ליצור עובד' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, customer_id, worker_type_id } = body;

    if (!name) return NextResponse.json({ error: 'שם העובד נדרש' }, { status: 400 });
    if (!email || !password) return NextResponse.json({ error: 'אימייל וסיסמה נדרשים' }, { status: 400 });
    if (!customer_id) return NextResponse.json({ error: 'נדרש לבחור לקוח' }, { status: 400 });
    if (!worker_type_id) return NextResponse.json({ error: 'נדרש לבחור סוג עובד' }, { status: 400 });

    // customer_id arrives in the request body, so it has to be checked against
    // the caller's scope — otherwise a customer owner could create a worker
    // inside another tenant.
    await assertCustomerInScope(ctx, customer_id);

    const { record } = await createUserWithRole(ctx.adminClient, {
      email,
      password,
      name,
      roleName: 'worker',
      userMetadataRole: 'worker',
      insertRecord: async (userId: string) => {
        return await (ctx.adminClient.from('workers') as any)
          .insert({ user_id: userId, customer_id, name, type_id: worker_type_id })
          .select('*, worker_types(*), customers(*)')
          .single();
      },
    });

    return NextResponse.json({ ...record, email }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!(await checkPermission(ctx, 'update_worker'))) {
      return NextResponse.json({ error: 'אין הרשאה לעדכן עובד' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, worker_type_id } = body;

    if (!id || !name) return NextResponse.json({ error: 'id ושם נדרשים' }, { status: 400 });
    if (!worker_type_id) return NextResponse.json({ error: 'נדרש לבחור סוג עובד' }, { status: 400 });

    await assertRowInScope(ctx, 'workers', id);

    const { data, error } = await (ctx.supabase.from('workers') as any)
      .update({ name, type_id: worker_type_id, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, worker_types(*), customers(*)')
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

    if (!(await checkPermission(ctx, 'delete_worker'))) {
      return NextResponse.json({ error: 'אין הרשאה למחוק עובד' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'id נדרש' }, { status: 400 });

    // The delete below runs on adminClient and so bypasses RLS completely.
    // Without this, any holder of delete_worker — which every customer owner
    // has — could delete another tenant's worker, and their login with it.
    await assertRowInScope(ctx, 'workers', id);

    // Get worker's user_id first
    const { data: worker } = await (ctx.adminClient.from('workers') as any)
      .select('user_id')
      .eq('id', id)
      .single();

    const { error } = await (ctx.adminClient.from('workers') as any).delete().eq('id', id);
    if (error) throw error;

    if (worker?.user_id) {
      await ctx.adminClient.auth.admin.deleteUser(worker.user_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
