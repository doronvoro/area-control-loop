import { requireAuth } from '@/lib/auth';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

export default async function DashboardPage() {
  await requireAuth();

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">דשבורד</h1>
      <DashboardContent />
    </>
  );
}
