import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { AdminActionPageContent } from '@/components/admin/AdminActionPageContent';
import { ListChecks } from 'lucide-react';

export default async function AdminActionsPage() {
  await requireAuth();

  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  return (
    <>
      <PageHeader
        icon={ListChecks}
        title="דוח פעולה - מנהל"
        description="צפייה בכל דוחות הפעולות במערכת"
      />
      <AdminActionPageContent />
    </>
  );
}
