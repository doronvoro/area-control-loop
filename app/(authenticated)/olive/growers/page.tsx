import { requireAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { GrowersPageContent } from '@/components/growers/GrowersPageContent';
import '../olive.css';

/**
 * The growers (מגדלים) of the selected tenant.
 *
 * Gated on the area permissions rather than the customer ones: a grower is olive
 * reference data belonging to a tenant, not a tenant itself, so a customer_owner
 * maintains their own growers while a worker only reads them. /api/growers makes
 * the same check.
 *
 * The PageHeader lives in the client component so its `children` slot can hold
 * the "מגדל חדש" button.
 */
export default async function GrowersPage() {
  await requireAuth();

  const [canCreate, canUpdate, canDelete] = await Promise.all([
    hasPermission('create_area'),
    hasPermission('update_area'),
    hasPermission('delete_area'),
  ]);

  return <GrowersPageContent canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} />;
}
