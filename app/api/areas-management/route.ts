import { NextResponse } from 'next/server';
import { getApiContext, checkPermission } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getCrops } from '@/lib/services/lookup.service';

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

interface CustomerAreaRow {
  customer_id: string;
  areas: Area | null;
}

const AREA_COLUMNS = 'customer_id, area_id, areas(id, name, description, crop_id, area_type)';

/**
 * GET /api/areas-management
 *
 * Scoped to the caller's customer by default. /areas is a tenant screen, so an
 * admin who has selected a customer must see that customer's tree and no one
 * else's — this route fed the whole tenant list into it.
 *
 * `?scope=all` opts back out, for /admin/areas-management: the cross-tenant
 * screen whose whole job is managing customers and their areas side by side.
 * Default-scoped rather than default-all so a new caller inherits the scope
 * instead of quietly leaking every tenant.
 */
export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();

    // Admin-only, like every other cross-tenant switch. A non-admin passing it
    // still gets their own tenancy.
    const crossTenant = ctx.isAdmin && new URL(request.url).searchParams.get('scope') === 'all';

    const [
      canCreateCustomer,
      canUpdateCustomer,
      canDeleteCustomer,
      canCreateArea,
      canUpdateArea,
      canDeleteArea,
      canCreateSubArea,
      canUpdateSubArea,
      canDeleteSubArea,
      crops,
    ] = await Promise.all([
      checkPermission(ctx, 'create_customer'),
      checkPermission(ctx, 'update_customer'),
      checkPermission(ctx, 'delete_customer'),
      checkPermission(ctx, 'create_area'),
      checkPermission(ctx, 'update_area'),
      checkPermission(ctx, 'delete_area'),
      checkPermission(ctx, 'create_sub_area'),
      checkPermission(ctx, 'update_sub_area'),
      checkPermission(ctx, 'delete_sub_area'),
      getCrops(ctx.supabase),
    ]);

    const permissions = {
      canCreateCustomer,
      canUpdateCustomer,
      canDeleteCustomer,
      canCreateArea,
      canUpdateArea,
      canDeleteArea,
      canCreateSubArea,
      canUpdateSubArea,
      canDeleteSubArea,
    };

    // An admin with no customer selected is scoped to nothing. 200 with an
    // empty payload, not a 401: it is the normal resting state after login, and
    // the shell already explains it with a "choose a customer" banner.
    if (!crossTenant && !ctx.scopedCustomerId) {
      return NextResponse.json({
        customers: [],
        customerAreasMap: {},
        crops: crops || [],
        permissions,
      });
    }

    let customers: Customer[] = [];
    let customerAreas: CustomerAreaRow[] = [];

    if (crossTenant) {
      const [{ data: customerRows }, { data: areaRows }] = await Promise.all([
        ctx.supabase.from('customers').select('id, name, description').order('name'),
        // adminClient: this path deliberately spans tenants, and the admin
        // SELECT policies are narrower than what the screen needs.
        ctx.adminClient.from('customer_areas').select(AREA_COLUMNS),
      ]);
      customers = (customerRows as Customer[]) || [];
      customerAreas = (areaRows as unknown as CustomerAreaRow[]) || [];
    } else {
      // ctx.supabase, not adminClient: RLS stays as a backstop underneath the
      // explicit customer filter rather than the filter being the only thing
      // between tenants.
      const [{ data: customerRows }, { data: areaRows }] = await Promise.all([
        ctx.supabase
          .from('customers')
          .select('id, name, description')
          .eq('id', ctx.scopedCustomerId)
          .order('name'),
        ctx.supabase
          .from('customer_areas')
          .select(AREA_COLUMNS)
          .eq('customer_id', ctx.scopedCustomerId),
      ]);
      customers = (customerRows as Customer[]) || [];
      customerAreas = (areaRows as unknown as CustomerAreaRow[]) || [];
    }

    // Build customer to areas map
    const customerAreasMap: Record<string, Area[]> = {};
    for (const ca of customerAreas) {
      if (!customerAreasMap[ca.customer_id]) {
        customerAreasMap[ca.customer_id] = [];
      }
      if (ca.areas) {
        customerAreasMap[ca.customer_id].push(ca.areas);
      }
    }

    return NextResponse.json({
      customers,
      customerAreasMap,
      crops: crops || [],
      permissions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
