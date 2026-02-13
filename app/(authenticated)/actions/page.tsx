import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActionTaskList } from '@/components/actions/ActionTaskList';
import { Zap } from 'lucide-react';

export default async function ActionsPage() {
  await requireAuth();

  return (
    <>
      <PageHeader
        icon={Zap}
        title="משימות פעולה"
        description="ביצוע פעולות על סמך המלצות ניטור"
      />
      <ActionTaskList />
    </>
  );
}
