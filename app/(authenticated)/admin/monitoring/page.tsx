import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { AdminMonitoringPageContent } from '@/components/admin/AdminMonitoringPageContent';
import { ClipboardList } from 'lucide-react';

export default async function AdminMonitoringPage() {
  await requireAuth();

  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        title="דוח ניטור - מנהל"
        description="צפייה בכל דוחות הניטור במערכת"
      />
      <AdminMonitoringPageContent />
    </>
  );
}
