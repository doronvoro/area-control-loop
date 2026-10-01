import { requireAuth } from '@/lib/auth';
import { VarietiesPageContent } from '@/components/varieties/VarietiesPageContent';
import '../olive.css';

/**
 * Olive varieties (זנים). A global list — who may edit it is decided in the
 * client from the user's roles and enforced again by /api/varieties.
 */
export default async function VarietiesPage() {
  await requireAuth();
  return <VarietiesPageContent />;
}
