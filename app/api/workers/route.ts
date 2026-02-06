import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentCustomer, getCurrentWorker, requireAuth } from '@/lib/auth';
import { hasPermission, hasRole } from '@/lib/permissions';

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const type = searchParams.get('type'); // 'inspector' or 'action_worker'
    const all = searchParams.get('all'); // Admin: get all workers

    const supabase = await createClient();
    const isAdmin = await hasRole('admin');

    // Admin can get all workers with ?all=true
    if (all === 'true' && isAdmin) {
      let query = supabase
        .from('workers')
        .select('*, worker_types(*), customers(*), auth_users:user_id(email)');

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (type) {
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

      // Fetch emails from auth.users using admin client
      const adminClient = createAdminClient();
      const workersWithEmail = await Promise.all(
        (data || []).map(async (worker: any) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(worker.user_id);
          return {
            ...worker,
            email: userData?.user?.email || null,
          };
        })
      );

      return NextResponse.json(workersWithEmail);
    }

    // Non-admin: get workers for current customer only
    const customer = await getCurrentCustomer();
    const worker = await getCurrentWorker();

    const targetCustomerId = customerId || (customer as any)?.id || (worker as any)?.customer_id;

    if (!targetCustomerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = supabase
      .from('workers')
      .select('*, worker_types(*), customers(*)')
      .eq('customer_id', targetCustomerId);

    if (type) {
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

export async function POST(request: Request) {
  try {
    await requireAuth();

    const canCreate = await hasPermission('create_worker');
    if (!canCreate) {
      return NextResponse.json({ error: 'אין הרשאה ליצור עובד' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, customer_id, worker_type_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'שם העובד נדרש' }, { status: 400 });
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'אימייל וסיסמה נדרשים' }, { status: 400 });
    }

    if (!customer_id) {
      return NextResponse.json({ error: 'נדרש לבחור לקוח' }, { status: 400 });
    }

    if (!worker_type_id) {
      return NextResponse.json({ error: 'נדרש לבחור סוג עובד' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Create auth user for the worker
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'worker',
      },
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json({ error: 'משתמש עם אימייל זה כבר קיים' }, { status: 400 });
      }
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Failed to create user');
    }

    // Create worker record
    const { data: workerData, error: workerError } = await (adminClient.from('workers') as any)
      .insert({
        user_id: authData.user.id,
        customer_id,
        name,
        type_id: worker_type_id,
      })
      .select('*, worker_types(*), customers(*)')
      .single();

    if (workerError) {
      // Rollback: delete the auth user if worker creation fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      throw workerError;
    }

    // Assign worker role to the new user
    const { data: roleData } = await (adminClient.from('roles') as any)
      .select('id')
      .eq('name', 'worker')
      .single();

    if (roleData) {
      await (adminClient.from('user_roles') as any).insert({
        user_id: authData.user.id,
        role_id: roleData.id,
      });
    }

    return NextResponse.json({ ...workerData, email }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAuth();

    const canUpdate = await hasPermission('update_worker');
    if (!canUpdate) {
      return NextResponse.json({ error: 'אין הרשאה לעדכן עובד' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, worker_type_id } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'id ושם נדרשים' }, { status: 400 });
    }

    if (!worker_type_id) {
      return NextResponse.json({ error: 'נדרש לבחור סוג עובד' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await (supabase.from('workers') as any)
      .update({
        name,
        type_id: worker_type_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, worker_types(*), customers(*)')
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();

    const canDelete = await hasPermission('delete_worker');
    if (!canDelete) {
      return NextResponse.json({ error: 'אין הרשאה למחוק עובד' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id נדרש' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Get worker's user_id first
    const { data: worker } = await (adminClient.from('workers') as any)
      .select('user_id')
      .eq('id', id)
      .single();

    // Delete worker record
    const { error } = await (adminClient.from('workers') as any).delete().eq('id', id);

    if (error) throw error;

    // Delete auth user
    if (worker?.user_id) {
      await adminClient.auth.admin.deleteUser(worker.user_id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
