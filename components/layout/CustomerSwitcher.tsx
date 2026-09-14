'use client';

import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { useUser } from '@/components/providers/UserProvider';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
}

/**
 * Lets an admin scope the whole app to one customer.
 *
 * Admin-only by design: a customer owner or worker has exactly one tenancy, and
 * offering them a picker would imply a choice that does not exist.
 *
 * This is a focus control, not a security boundary — an admin may read every
 * tenant regardless of what is selected. See lib/api/customer-selection.ts.
 */
export function CustomerSwitcher({
  collapsed = false,
  variant = 'default',
}: {
  collapsed?: boolean;
  /**
   * 'sidebar' re-colours the control for the dark sidebar panel. The mobile
   * menu renders on the normal light sheet background and must NOT use it —
   * the same override that makes this readable there makes it unreadable here.
   */
  variant?: 'default' | 'sidebar';
}) {
  const { user, loading } = useUser();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [switching, setSwitching] = useState(false);

  const isAdmin = user?.isAdmin ?? false;
  const isSidebar = variant === 'sidebar';

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/customers')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => setCustomers([]));
  }, [isAdmin]);

  if (loading || !isAdmin) return null;

  const handleChange = async (customerId: string) => {
    setSwitching(true);
    try {
      const res = customerId
        ? await fetch('/api/admin/selected-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId }),
          })
        : await fetch('/api/admin/selected-customer', { method: 'DELETE' });

      if (!res.ok) {
        setSwitching(false);
        return;
      }

      // A full document load, deliberately — not router.refresh().
      //
      // Every page here is a thin server shell and all data is fetched
      // client-side, so refreshing server components leaves the client
      // components mounted with their effects already run: the admin would
      // switch tenant and keep seeing the previous one's rows. The sidebar is
      // affected too, since features.olive is derived from the selection and
      // UserProvider fetches once on mount.
      //
      // Switching tenant is a session-level event, not a navigation.
      window.location.assign(window.location.pathname);
    } catch {
      setSwitching(false);
    }
  };

  const selected = user?.selectedCustomer ?? null;

  // Collapsed sidebar has no room for a select; show the tenant initial so the
  // active scope is never completely hidden.
  if (collapsed) {
    return (
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-md border text-xs font-medium',
          isSidebar
            ? 'border-sidebar-border bg-sidebar-accent text-sidebar-foreground'
            : 'bg-muted/50'
        )}
        title={selected ? `לקוח נבחר: ${selected.name}` : 'לא נבחר לקוח'}
      >
        {selected ? selected.name.trim().charAt(0) : <Building2 className="h-4 w-4 opacity-60" />}
      </div>
    );
  }

  return (
    // .customer-switcher re-points SearchableSelect's trigger at the sidebar
    // palette; see the block at the end of app/globals.css.
    <div className={cn('space-y-1.5', isSidebar && 'customer-switcher')}>
      <div
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium',
          isSidebar ? 'text-sidebar-foreground/70' : 'text-muted-foreground'
        )}
      >
        <Building2 className="h-3.5 w-3.5" />
        <span>לקוח פעיל</span>
      </div>

      <SearchableSelect
        options={customers.map((c) => ({ value: c.id, label: c.name }))}
        value={selected?.id ?? ''}
        onValueChange={handleChange}
        placeholder="כל הלקוחות"
        searchPlaceholder="חיפוש לקוח..."
        emptyMessage="לא נמצאו לקוחות"
        disabled={switching}
        className={cn(switching && 'opacity-60')}
      />
    </div>
  );
}
