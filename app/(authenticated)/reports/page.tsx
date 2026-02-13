import { requireAuth } from '@/lib/auth';
import { ReportsPageContent } from '@/components/reports/ReportsPageContent';

export default async function ReportsPage() {
  await requireAuth();

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">דוחות</h1>
      <ReportsPageContent />
    </>
  );
}
