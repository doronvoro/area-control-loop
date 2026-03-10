import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { ApiChecker } from '@/components/admin/ApiChecker';
import { FlaskConical } from 'lucide-react';

export default async function ApiCheckerPage() {
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
        icon={FlaskConical}
        title="בדיקת Cascade API"
        description="בחר גידול, נגע וחומר — בדוק את תגובות ה-API בזמן אמת וודא שהשרשרת עובדת כראוי."
      />
      <ApiChecker />
    </>
  );
}
