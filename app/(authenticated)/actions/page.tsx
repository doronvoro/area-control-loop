import { requireAuth } from '@/lib/auth';
import { ActionTaskList } from '@/components/actions/ActionTaskList';

export default async function ActionsPage() {
  await requireAuth();

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">משימות פעולה</h1>
      <ActionTaskList />
    </>
  );
}
