import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth, getCurrentCustomer } from '@/lib/auth';
import { hasPermission, hasRole } from '@/lib/permissions';

export async function GET(request: Request) {
  try {
    await requireAuth();

    const isAdmin = await hasRole('admin');

    // Admins can list all customers
    if (isAdmin) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      return NextResponse.json(data);
    }

    // Customer owners can see their own customer
    const customer = await getCurrentCustomer();
    if (customer) {
      return NextResponse.json([customer]);
    }

    return NextResponse.json(
      { error: 'אין הרשאה לצפות בלקוחות' },
      { status: 403 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();

    // Check permission
    const canCreate = await hasPermission('create_customer');
    if (!canCreate) {
      return NextResponse.json(
        { error: 'אין הרשאה ליצור לקוח' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, email, password } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'שם הלקוח נדרש' },
        { status: 400 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'אימייל וסיסמה נדרשים' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Create auth user for the customer using admin client
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'customer_owner',
      },
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'משתמש עם אימייל זה כבר קיים' },
          { status: 400 }
        );
      }
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Failed to create user');
    }

    // Create customer record using admin client to bypass RLS
    const { data: customerData, error: customerError } = await (adminClient
      .from('customers') as any)
      .insert({
        user_id: authData.user.id,
        name,
        description: description || null,
      })
      .select()
      .single();

    if (customerError) {
      // Rollback: delete the auth user if customer creation fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      throw customerError;
    }

    // Assign customer_owner role to the new user
    const { data: roleData } = await (adminClient
      .from('roles') as any)
      .select('id')
      .eq('name', 'customer_owner')
      .single();

    if (roleData) {
      await (adminClient
        .from('user_roles') as any)
        .insert({
          user_id: authData.user.id,
          role_id: roleData.id,
        });
    }

    return NextResponse.json(customerData, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAuth();

    // Check permission
    const canUpdate = await hasPermission('update_customer');
    if (!canUpdate) {
      return NextResponse.json(
        { error: 'אין הרשאה לעדכן לקוח' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, description } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: 'id ו-name נדרשים' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await (supabase
      .from('customers') as any)
      .update({
        name,
        description: description || null,
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

export async function DELETE(request: Request) {
  try {
    await requireAuth();

    // Check permission
    const canDelete = await hasPermission('delete_customer');
    if (!canDelete) {
      return NextResponse.json(
        { error: 'אין הרשאה למחוק לקוח' },
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

    const adminClient = createAdminClient();

    // Get customer's user_id first
    const { data: customer } = await (adminClient
      .from('customers') as any)
      .select('user_id')
      .eq('id', id)
      .single();

    // Delete customer record (this will cascade to customer_areas, workers, etc.)
    const { error } = await (adminClient
      .from('customers') as any)
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Delete auth user
    if (customer?.user_id) {
      await adminClient.auth.admin.deleteUser(customer.user_id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
