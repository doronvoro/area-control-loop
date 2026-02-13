import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { AreaStatusBoard } from '@/components/dashboard/AreaStatusBoard';
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
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">סטטוס שטחות</h2>
        <AreaStatusBoard />
      </div>
    </>
  );
}
