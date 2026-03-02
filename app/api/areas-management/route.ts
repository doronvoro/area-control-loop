import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasPermission, hasRole } from '@/lib/permissions';

interface Customer {
  id: string;
  name: string;
  description: string | null;
}

interface Area {
  id: string;
  name: string;
  description: string | null;
  crop_id: string | null;
}

export async function GET() {
  try {
    await requireAuth();

    const supabase = await createClient();
    const isAdmin = await hasRole('admin');

    // Fetch customers - admins see all, customer owners see only their own
    let customers: Customer[] = [];
    if (isAdmin) {
      const { data } = await supabase
        .from('customers')
        .select('id, name, description')
        .order('name');
      customers = data || [];
    } else {
      // Customer owner sees only their customer
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('customers')
          .select('id, name, description')
          .eq('user_id', user.id);
        customers = data || [];
      }
    }

    // Fetch customer_areas relationships with area data
    // For admins: use admin client to get all
    // For customer owners: regular client respects RLS
    let customerAreas;
    if (isAdmin) {
      const adminClient = createAdminClient();
      const { data } = await (adminClient.from('customer_areas') as any).select(
        'customer_id, area_id, areas(id, name, description, crop_id, area_type)'
      );
      customerAreas = data;
    } else {
      const { data } = await (supabase.from('customer_areas') as any).select(
        'customer_id, area_id, areas(id, name, description, crop_id, area_type)'
      );
      customerAreas = data;
    }

    // Build customer to areas map
    const customerAreasMap: Record<string, Area[]> = {};
    if (customerAreas) {
      for (const ca of customerAreas) {
        if (!customerAreasMap[ca.customer_id]) {
          customerAreasMap[ca.customer_id] = [];
        }
        if (ca.areas) {
          customerAreasMap[ca.customer_id].push(ca.areas);
        }
      }
    }

    // Fetch all crops for forms
    const { data: crops } = await supabase
      .from('crops')
      .select('id, name, description')
      .order('name');

    // Get permissions
    const permissions = {
      canCreateCustomer: await hasPermission('create_customer'),
      canUpdateCustomer: await hasPermission('update_customer'),
      canDeleteCustomer: await hasPermission('delete_customer'),
      canCreateArea: await hasPermission('create_area'),
      canUpdateArea: await hasPermission('update_area'),
      canDeleteArea: await hasPermission('delete_area'),
      canCreateSubArea: await hasPermission('create_sub_area'),
      canUpdateSubArea: await hasPermission('update_sub_area'),
      canDeleteSubArea: await hasPermission('delete_sub_area'),
    };

    return NextResponse.json({
      customers: customers || [],
      customerAreasMap,
      crops: crops || [],
      permissions,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
