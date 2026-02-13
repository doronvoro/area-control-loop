import { requireAuth } from '@/lib/auth';
import { MonitoringPageContent } from '@/components/monitoring/MonitoringPageContent';
import './monitoring.css';

export default async function MonitoringPage() {
  await requireAuth();

  return <MonitoringPageContent />;
}
