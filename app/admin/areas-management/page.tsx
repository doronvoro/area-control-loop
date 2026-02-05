import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole, hasPermission } from '@/lib/permissions';
import { Navbar } from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/server';
import { AreaManagementLayout } from '@/components/area-management/AreaManagementLayout';

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

interface Crop {
  id: string;
  name: string;
  description: string | null;
}

export default async function AreasManagementPage() {
  await requireAuth();

  // Check if user is admin
  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // Fetch all customers
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, description')
    .order('name');

  // Fetch customer_areas relationships with area data
  const { data: customerAreas } = await (supabase
    .from('customer_areas') as any)
    .select('customer_id, area_id, areas(id, name, description, crop_id)');

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
    canCreateArea: await hasPermission('create_area'),
    canUpdateArea: await hasPermission('update_area'),
    canDeleteArea: await hasPermission('delete_area'),
    canCreateSubArea: await hasPermission('create_sub_area'),
    canUpdateSubArea: await hasPermission('update_sub_area'),
    canDeleteSubArea: await hasPermission('delete_sub_area'),
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">ניהול שטחים</h1>
        <AreaManagementLayout
          customers={customers || []}
          initialCustomerAreasMap={customerAreasMap}
          crops={crops || []}
          permissions={permissions}
        />
      </main>
    </div>
  );
}
