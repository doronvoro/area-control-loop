import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, hasRole } from '@/lib/permissions';
import { CustomersList } from '@/components/customers/CustomersList';

export default async function CustomersPage() {
  await requireAuth();

  // Only admins can access this page
  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // Check permissions
  const canCreateCustomer = await hasPermission('create_customer');
  const canUpdateCustomer = await hasPermission('update_customer');
  const canDeleteCustomer = await hasPermission('delete_customer');

  // Get all customers
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('name');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">ניהול לקוחות</h1>

        <CustomersList
          customers={customers || []}
          canCreate={canCreateCustomer}
          canUpdate={canUpdateCustomer}
          canDelete={canDeleteCustomer}
        />
      </main>
    </div>
  );
}
