import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { ReportsPageContent } from '@/components/reports/ReportsPageContent';
import { FileText } from 'lucide-react';

export default async function ReportsPage() {
  await requireAuth();

  return (
    <>
      <PageHeader
        icon={FileText}
        title="דוחות"
        description="צפייה בדוחות ניטור ופעולות"
      />
      <ReportsPageContent />
    </>
  );
}
