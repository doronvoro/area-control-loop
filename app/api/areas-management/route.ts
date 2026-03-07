import { NextResponse } from 'next/server';
import { getApiContext, checkPermission } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

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
    const ctx = await getApiContext();

    // Fetch customers - admins see all, customer owners see only their own
    let customers: Customer[] = [];
    if (ctx.isAdmin) {
      const { data } = await ctx.supabase
        .from('customers')
        .select('id, name, description')
        .order('name');
      customers = data || [];
    } else {
      // Customer owner sees only their customer
      if (ctx.user) {
        const { data } = await ctx.supabase
          .from('customers')
          .select('id, name, description')
          .eq('user_id', ctx.user.id);
        customers = data || [];
      }
    }

    // Fetch customer_areas relationships with area data
    // For admins: use admin client to get all
    // For customer owners: regular client respects RLS
    let customerAreas;
    if (ctx.isAdmin) {
      const { data } = await (ctx.adminClient.from('customer_areas') as any).select(
        'customer_id, area_id, areas(id, name, description, crop_id, area_type)'
      );
      customerAreas = data;
    } else {
      const { data } = await (ctx.supabase.from('customer_areas') as any).select(
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
    const { data: crops } = await ctx.supabase
      .from('crops')
      .select('id, name, description')
      .order('name');

    // Get permissions
    const permissions = {
      canCreateCustomer: await checkPermission(ctx, 'create_customer'),
      canUpdateCustomer: await checkPermission(ctx, 'update_customer'),
      canDeleteCustomer: await checkPermission(ctx, 'delete_customer'),
      canCreateArea: await checkPermission(ctx, 'create_area'),
      canUpdateArea: await checkPermission(ctx, 'update_area'),
      canDeleteArea: await checkPermission(ctx, 'delete_area'),
      canCreateSubArea: await checkPermission(ctx, 'create_sub_area'),
      canUpdateSubArea: await checkPermission(ctx, 'update_sub_area'),
      canDeleteSubArea: await checkPermission(ctx, 'delete_sub_area'),
    };

    return NextResponse.json({
      customers: customers || [],
      customerAreasMap,
      crops: crops || [],
      permissions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
