import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { LayoutDashboard } from 'lucide-react';

export default async function DashboardPage() {
  await requireAuth();

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="דשבורד"
        description="סקירה כללית של פעילות המערכת"
      />
      <DashboardContent />
    </>
  );
}
