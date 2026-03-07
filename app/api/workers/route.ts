import { NextResponse } from 'next/server';
import { getApiContext, checkPermission, resolveCustomerId } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getWorkerTypeId, createUserWithRole } from '@/lib/api/utils';

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const type = searchParams.get('type');
    const all = searchParams.get('all');

    // Admin can get all workers with ?all=true
    if (all === 'true' && ctx.isAdmin) {
      let query = ctx.supabase
        .from('workers')
        .select('*, worker_types(*), customers(*)');

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (type) {
        const typeId = await getWorkerTypeId(ctx.supabase, type);
        if (typeId) {
          query = query.eq('type_id', typeId);
        }
      }

      const { data, error } = await query.order('name');
      if (error) throw error;

      // Fetch emails from auth.users
      const workersWithEmail = await Promise.all(
        (data || []).map(async (worker: any) => {
          const { data: userData } = await ctx.adminClient.auth.admin.getUserById(worker.user_id);
          return { ...worker, email: userData?.user?.email || null };
        })
      );

      return NextResponse.json(workersWithEmail);
    }

    // Non-admin: get workers for current customer only
    const targetCustomerId = resolveCustomerId(ctx, customerId);

    if (!targetCustomerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = ctx.supabase
      .from('workers')
      .select('*, worker_types(*), customers(*)')
      .eq('customer_id', targetCustomerId);

    if (type) {
      const typeId = await getWorkerTypeId(ctx.supabase, type);
      if (typeId) {
        query = query.eq('type_id', typeId);
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
