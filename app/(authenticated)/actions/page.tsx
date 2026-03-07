import { requireAuth } from '@/lib/auth';
import { ActionTaskList } from '@/components/actions/ActionTaskList';
import './actions.css';

export default async function ActionsPage() {
  await requireAuth();

  return <ActionTaskList />;
}
