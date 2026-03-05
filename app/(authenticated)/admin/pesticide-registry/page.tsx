import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { PesticideRegistryImport } from '@/components/admin/PesticideRegistryImport';
import { FileUp } from 'lucide-react';

export default async function PesticideRegistryPage() {
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
        icon={FileUp}
        title="ייבוא מרשם הדברה"
        description="ייבוא נתוני מרשם ההדברה מקובץ CSV של משרד החקלאות. בחר גידולים לייבוא וצפה בניתוח השפעה לפני הייבוא."
      />
      <PesticideRegistryImport />
    </>
  );
}
