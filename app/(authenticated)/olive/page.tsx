import { requireAuth } from '@/lib/auth';
import { OliveDashboardContent } from '@/components/olive/OliveDashboardContent';
import './olive.css';

/**
 * The header lives in OliveDashboardContent rather than here, the way
 * /olive/nir already does it: its action slot holds the thresholds gear, which
 * needs the loaded payload to seed the dialog and `refetch` to refresh the
 * cards after a save. Neither is reachable from a server component.
 */
export default async function OlivePage() {
  await requireAuth();

  return <OliveDashboardContent />;
}
