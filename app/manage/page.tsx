import { requireAuth, getCurrentCustomer, getCurrentWorker } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, hasRole } from '@/lib/permissions';
import { ManagementDashboard } from '@/components/manage/ManagementDashboard';

interface CustomerWithAreas {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  areas: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
}

interface AreaWithOwner {
  id: string;
  name: string;
  description: string | null;
  crop_id?: string | null;
  customer?: {
    id: string;
    name: string;
  } | null;
}

interface Crop {
  id: string;
  name: string;
  description?: string | null;
}

export default async function ManagePage() {
  await requireAuth();
  const supabase = await createClient();

  // Check roles
  const isAdmin = await hasRole('admin');
  const isCustomerOwner = await hasRole('customer_owner');
  const isWorker = await hasRole('worker');

  // Check permissions
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
    canAddAreaToCustomer: await hasPermission('add_area_to_customer'),
    canRemoveAreaFromCustomer: await hasPermission('remove_area_from_customer'),
  };

  // Get current user data
  const customer = await getCurrentCustomer();
  const worker = await getCurrentWorker();

  let customersWithAreas: CustomerWithAreas[] = [];
  let areasWithOwners: AreaWithOwner[] = [];
  let unassignedAreas: AreaWithOwner[] = [];
  let ownCustomer: CustomerWithAreas | null = null;
  let ownAreas: AreaWithOwner[] = [];

  // Fetch all crops for selection
  const { data: allCrops } = await supabase
    .from('crops')
    .select('id, name, description')
    .order('name');
  const crops: Crop[] = allCrops || [];

  if (isAdmin) {
    // Admin: Fetch all customers with their areas
    const { data: allCustomers } = await supabase
      .from('customers')
      .select('id, name, description, created_at')
      .order('name');

    // Fetch all customer_areas relationships
    const { data: allCustomerAreas } = await (supabase
      .from('customer_areas') as any)
      .select('customer_id, area_id, areas(id, name, description, crop_id)');

    // Build customers with areas
    if (allCustomers) {
      customersWithAreas = allCustomers.map((c: any) => ({
        ...c,
        areas: (allCustomerAreas || [])
          .filter((ca: any) => ca.customer_id === c.id)
          .map((ca: any) => ca.areas)
          .filter(Boolean),
      }));
    }

    // Fetch all areas with their owners
    const { data: allAreas } = await supabase
      .from('areas')
      .select('id, name, description, crop_id')
      .order('name');

    if (allAreas) {
      // Build a map of area_id -> customer
      const areaToCustomer = new Map<string, { id: string; name: string }>();
      if (allCustomerAreas) {
        for (const ca of allCustomerAreas) {
          const cust = customersWithAreas.find((c) => c.id === ca.customer_id);
          if (cust) {
            areaToCustomer.set(ca.area_id, { id: cust.id, name: cust.name });
          }
        }
      }

      areasWithOwners = allAreas.map((area: any) => ({
        ...area,
        customer: areaToCustomer.get(area.id) || null,
      }));

      unassignedAreas = areasWithOwners.filter((a) => !a.customer);
    }
  } else if (isCustomerOwner && customer) {
    // Customer Owner: Fetch own customer and areas
    const customerId = (customer as any).id;

    // Fetch own customer details
    const { data: ownCustomerData } = await (supabase
      .from('customers') as any)
      .select('id, name, description, created_at')
      .eq('id', customerId)
      .single();

    // Fetch own areas via customer_areas
    const { data: customerAreas } = await (supabase
      .from('customer_areas') as any)
      .select('area_id, areas(id, name, description, crop_id)')
      .eq('customer_id', customerId);

    if (ownCustomerData) {
      ownCustomer = {
        ...ownCustomerData,
        areas: (customerAreas || []).map((ca: any) => ca.areas).filter(Boolean),
      };

      ownAreas = (customerAreas || [])
        .map((ca: any) => ({
          ...ca.areas,
          customer: { id: ownCustomerData.id, name: ownCustomerData.name },
        }))
        .filter((a: any) => a.id);
    }
  } else if (isWorker && worker) {
    // Worker: Fetch customer's areas (read-only)
    const customerId = (worker as any).customer_id;

    // Fetch customer details
    const { data: workerCustomer } = await (supabase
      .from('customers') as any)
      .select('id, name')
      .eq('id', customerId)
      .single();

    // Fetch customer's areas
    const { data: customerAreas } = await (supabase
      .from('customer_areas') as any)
      .select('area_id, areas(id, name, description, crop_id)')
      .eq('customer_id', customerId);

    if (workerCustomer) {
      ownAreas = (customerAreas || [])
        .map((ca: any) => ({
          ...ca.areas,
          customer: { id: workerCustomer.id, name: workerCustomer.name },
        }))
        .filter((a: any) => a.id);
    }
  }

  // Get all customers for admin's area assignment dropdown
  let allCustomersList: { id: string; name: string }[] = [];
  if (isAdmin) {
    const { data: customersList } = await supabase
      .from('customers')
      .select('id, name')
      .order('name');
    allCustomersList = customersList || [];
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">ניהול</h1>

        <ManagementDashboard
          isAdmin={isAdmin}
          isCustomerOwner={isCustomerOwner}
          isWorker={isWorker}
          permissions={permissions}
          customersWithAreas={customersWithAreas}
          areasWithOwners={areasWithOwners}
          unassignedAreas={unassignedAreas}
          ownCustomer={ownCustomer}
          ownAreas={ownAreas}
          allCustomers={allCustomersList}
          crops={crops}
        />
      </main>
    </div>
  );
}
