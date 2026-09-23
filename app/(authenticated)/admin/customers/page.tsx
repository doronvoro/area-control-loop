import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasPermission, hasRole } from '@/lib/permissions';
import { CustomersPageContent } from '@/components/customers/CustomersPageContent';

/**
 * The PageHeader lives in the client component rather than here: its `children`
 * slot holds the "לקוח חדש" button, which needs the drawer state.
 */
export default async function CustomersPage() {
  await requireAuth();

  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  const [canCreateCustomer, canUpdateCustomer, canDeleteCustomer] = await Promise.all([
    hasPermission('create_customer'),
    hasPermission('update_customer'),
    hasPermission('delete_customer'),
  ]);

  return (
    <CustomersPageContent
      canCreate={canCreateCustomer}
      canUpdate={canUpdateCustomer}
      canDelete={canDeleteCustomer}
    />
  );
}
