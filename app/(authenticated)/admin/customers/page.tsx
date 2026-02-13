import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasPermission, hasRole } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { CustomersPageContent } from '@/components/customers/CustomersPageContent';
import { Building2 } from 'lucide-react';

export default async function CustomersPage() {
  await requireAuth();

  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  const canCreateCustomer = await hasPermission('create_customer');
  const canUpdateCustomer = await hasPermission('update_customer');
  const canDeleteCustomer = await hasPermission('delete_customer');

  return (
    <>
      <PageHeader
        icon={Building2}
        title="ניהול לקוחות"
        description="ניהול חשבונות לקוחות והגדרות גישה"
      />
      <CustomersPageContent
        canCreate={canCreateCustomer}
        canUpdate={canUpdateCustomer}
        canDelete={canDeleteCustomer}
      />
    </>
  );
}
