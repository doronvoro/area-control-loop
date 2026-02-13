import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasPermission, hasRole } from '@/lib/permissions';
import { WorkersPageContent } from '@/components/workers/WorkersPageContent';

export default async function WorkersPage() {
  await requireAuth();

  // Admins and customer owners can access this page
  const [isAdmin, isCustomerOwner] = await Promise.all([
    hasRole('admin'),
    hasRole('customer_owner'),
  ]);
  if (!isAdmin && !isCustomerOwner) {
    redirect('/dashboard');
  }

  // Check permissions
  const canCreateWorker = await hasPermission('create_worker');
  const canUpdateWorker = await hasPermission('update_worker');
  const canDeleteWorker = await hasPermission('delete_worker');

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">ניהול עובדים</h1>
      <WorkersPageContent
        canCreate={canCreateWorker}
        canUpdate={canUpdateWorker}
        canDelete={canDeleteWorker}
      />
    </>
  );
}
