import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { OliveBackupImport } from '@/components/admin/OliveBackupImport';
import { FileUp } from 'lucide-react';

export default async function OliveImportPage() {
  await requireAuth();

  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  return (
    <>
      <PageHeader
        icon={FileUp}
        title="ייבוא נתוני מסיק"
        description="טעינת קובץ גיבוי מדשבורד המסיק. הנתונים הקיימים של הלקוח יימחקו ויוחלפו."
      />
      <OliveBackupImport />
    </>
  );
}
