import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, hasRole } from '@/lib/permissions';
import { AreasList } from '@/components/areas/AreasList';

export default async function AreasPage() {
  await requireAuth();
  const supabase = await createClient();

  // Check permissions and role
  const canCreateArea = await hasPermission('create_area');
  const canUpdateArea = await hasPermission('update_area');
  const canDeleteArea = await hasPermission('delete_area');
  const canCreateSubArea = await hasPermission('create_sub_area');
  const canUpdateSubArea = await hasPermission('update_sub_area');
  const canDeleteSubArea = await hasPermission('delete_sub_area');
  const isAdmin = await hasRole('admin');

  // Get all areas (admin can see all, others see their customer's areas)
  const { data: user } = await supabase.auth.getUser();
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', user?.user?.id || '')
    .single();

  let areas;
  let customers: { id: string; name: string }[] = [];

  if (isAdmin) {
    // Admin - get all areas and all customers
    const { data: allAreas } = await supabase
      .from('areas')
      .select('*')
      .order('name');

    areas = allAreas || [];

    // Fetch all customers for admin to choose from
    const { data: allCustomers } = await supabase
      .from('customers')
      .select('id, name')
      .order('name');

    customers = allCustomers || [];
  } else if (customer && (customer as any).id) {
    // Get areas for customer
    const { data: customerAreas } = await supabase
      .from('customer_areas')
      .select('area_id, areas(*)')
      .eq('customer_id', (customer as any).id);

    areas = customerAreas?.map((ca: any) => ca.areas).filter(Boolean) || [];
  } else {
    // No customer - empty areas
    areas = [];
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">שטחים</h1>

        <AreasList
          areas={areas || []}
          customerId={(customer as any)?.id || null}
          customers={customers}
          isAdmin={isAdmin}
          canCreateArea={canCreateArea}
          canUpdateArea={canUpdateArea}
          canDeleteArea={canDeleteArea}
          canCreateSubArea={canCreateSubArea}
          canUpdateSubArea={canUpdateSubArea}
          canDeleteSubArea={canDeleteSubArea}
        />
      </main>
    </div>
  );
}
