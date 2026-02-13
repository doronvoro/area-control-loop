import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasPermission, hasRole } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { WorkersPageContent } from '@/components/workers/WorkersPageContent';
import { Users } from 'lucide-react';

export default async function WorkersPage() {
  await requireAuth();

  const [isAdmin, isCustomerOwner] = await Promise.all([
    hasRole('admin'),
    hasRole('customer_owner'),
  ]);
  if (!isAdmin && !isCustomerOwner) {
    redirect('/dashboard');
  }

  const canCreateWorker = await hasPermission('create_worker');
  const canUpdateWorker = await hasPermission('update_worker');
  const canDeleteWorker = await hasPermission('delete_worker');

  return (
    <>
      <PageHeader
        icon={Users}
        title="ניהול עובדים"
        description="ניהול עובדי החברה, הקצאת תפקידים והרשאות"
      />
      <WorkersPageContent
        canCreate={canCreateWorker}
        canUpdate={canUpdateWorker}
        canDelete={canDeleteWorker}
      />
    </>
  );
}
