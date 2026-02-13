import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasPermission, hasRole } from '@/lib/permissions';
import { CustomersPageContent } from '@/components/customers/CustomersPageContent';

export default async function CustomersPage() {
  await requireAuth();

  // Only admins can access this page
  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  // Check permissions
  const canCreateCustomer = await hasPermission('create_customer');
  const canUpdateCustomer = await hasPermission('update_customer');
  const canDeleteCustomer = await hasPermission('delete_customer');

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">ניהול לקוחות</h1>
      <CustomersPageContent
        canCreate={canCreateCustomer}
        canUpdate={canUpdateCustomer}
        canDelete={canDeleteCustomer}
      />
    </>
  );
}
