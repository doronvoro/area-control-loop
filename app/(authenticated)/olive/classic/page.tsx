import { requireAuth } from '@/lib/auth';
import { OliveDashboardClassicContent } from '@/components/olive/OliveDashboardClassicContent';
import '../olive.css';

/**
 * The dashboard as it was before the urgent-first layout at /olive, kept so the
 * two can be compared. Delete this route and its component once one is chosen.
 */
export default async function OliveClassicPage() {
  await requireAuth();

  return <OliveDashboardClassicContent />;
}
