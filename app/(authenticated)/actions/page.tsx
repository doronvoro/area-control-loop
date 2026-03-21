import { requireAuth } from '@/lib/auth';
import { ActionTaskList } from '@/components/actions/ActionTaskList';
import './actions.css';
import '../monitoring/monitoring.css';

export default async function ActionsPage() {
  await requireAuth();

  return <ActionTaskList />;
}
