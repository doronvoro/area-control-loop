'use client';

import { usePathname } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { useUser } from '@/components/providers/UserProvider';

/**
 * Tells an admin why every screen is empty.
 *
 * An admin with no customer selected is scoped to nothing, so lists, counts and
 * the map all come back empty. Without this the app looks broken rather than
 * un-chosen — and the failure is silent, because empty is a legitimate state
 * for each of those screens on its own.
 *
 * Rendered once in the shell instead of adding an empty state to fifteen pages:
 * the cause is global, so the explanation should be too.
 */

/**
 * Pages that are ABOUT tenants rather than scoped by one, and are therefore
 * perfectly usable with nothing selected. Showing the banner on these would be
 * telling an admin to choose a customer on the very screen where they create
 * one.
 */
const CROSS_TENANT_PREFIXES = [
  '/admin/customers',
  '/admin/areas-management',
  '/admin/roles',
  '/admin/crops',
  '/admin/findings',
  '/admin/recommend-materials',
  '/admin/pesticide-registry',
  '/admin/registry-sync',
  '/admin/api-checker',
  '/admin/olive-import',
];

export function SelectCustomerBanner() {
  const { user, loading } = useUser();
  const pathname = usePathname();

  if (loading || !user?.isAdmin) return null;
  if (user.selectedCustomer) return null;
  if (CROSS_TENANT_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">לא נבחר לקוח</p>
        <p className="mt-0.5 text-amber-800 dark:text-amber-200/90">
          בחר לקוח בתפריט הצדדי כדי להציג את הנתונים שלו. עד אז מסכי הנתונים יופיעו ריקים.
        </p>
      </div>
    </div>
  );
}
