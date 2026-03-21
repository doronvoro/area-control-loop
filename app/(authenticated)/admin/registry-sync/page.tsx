import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { RegistrySyncManager } from '@/components/admin/RegistrySyncManager';
import { RefreshCw } from 'lucide-react';

export default async function RegistrySyncPage() {
  await requireAuth();

  const [isAdmin, isCustomerOwner] = await Promise.all([
    hasRole('admin'),
    hasRole('customer_owner'),
  ]);
  if (!isAdmin && !isCustomerOwner) {
    redirect('/dashboard');
  }

  return (
    <>
      <PageHeader
        icon={RefreshCw}
        title="סנכרון מרשם הדברה"
        description="בדיקת וסנכרון נתונים מטבלת מרשם ההדברה לטבלאות ממצאים, חומרים, קשרי גידול-ממצא והמלצות חומרים."
      />
      <RegistrySyncManager />
    </>
  );
}
