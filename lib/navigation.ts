import {
  LayoutDashboard,
  Search,
  Zap,
  FileText,
  FileUp,
  Users,
  MapPin,
  Sprout,
  Bug,
  FlaskConical,
  Shield,
  ClipboardList,
  ListChecks,
  RefreshCw,
  Gauge,
  Tractor,
  Scale,
  CloudSun,
  CalendarRange,
  Building2,
  MapPinned,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Feature flags that gate a whole nav group, independent of role. */
export interface NavFeatures {
  /** Customer has at least one olive area. */
  olive?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  requiredRole?: 'customer_owner' | 'admin';
  /**
   * Gate on a capability rather than a role. Gating the olive module on crop
   * rather than on a specific customer means the next olive grower needs no
   * code change.
   */
  requiredFeature?: keyof NavFeatures;
  /**
   * The group header becomes an expand/collapse toggle. Off for olive: it leads
   * the menu and is the reason those tenants are here, so hiding it behind a
   * click would undo the ordering below.
   */
  collapsible?: boolean;
  /** Folded on a first visit, before the user has toggled anything. */
  defaultCollapsed?: boolean;
}

export const workflowGroup: NavGroup = {
  id: 'workflow',
  label: 'תהליך עבודה',
  collapsible: true,
  defaultCollapsed: true,
  items: [
    { href: '/dashboard', label: 'דשבורד', icon: LayoutDashboard },
    { href: '/monitoring', label: 'ניטור', icon: Search },
    { href: '/actions', label: 'פעולות', icon: Zap },
    { href: '/areas', label: 'שטחים', icon: MapPin },
    { href: '/reports', label: 'דוחות', icon: FileText },
  ],
};

export const oliveGroup: NavGroup = {
  id: 'olive',
  label: 'מסיק זית',
  requiredFeature: 'olive',
  items: [
    { href: '/olive', label: 'סטטוס מסיק', icon: Gauge },
    { href: '/olive/plots', label: 'חלקות זית', icon: MapPin },
    // Next to the plots rather than under ניהול: a grower exists to own plots,
    // and the two screens link to each other.
    { href: '/olive/growers', label: 'מגדלים', icon: Users },
    { href: '/olive/nir', label: 'בדיקות NIR', icon: FlaskConical },
    { href: '/olive/harvest', label: 'רישום מסיק', icon: Tractor },
    { href: '/olive/yield', label: 'הערכת יבול', icon: Scale },
    { href: '/olive/weather', label: 'מזג אוויר', icon: CloudSun },
    { href: '/olive/seasons', label: 'עונות', icon: CalendarRange },
  ],
};

export const managementGroup: NavGroup = {
  id: 'management',
  label: 'ניהול',
  requiredRole: 'customer_owner',
  collapsible: true,
  defaultCollapsed: true,
  items: [
    { href: '/admin/workers', label: 'ניהול עובדים', icon: Users },
    { href: '/admin/crops', label: 'ניהול גידולים', icon: Sprout },
    { href: '/admin/findings', label: 'ניהול ממצאים', icon: Bug },
    { href: '/admin/recommend-materials', label: 'המלצות חומרים', icon: FlaskConical },
    { href: '/admin/pesticide-registry', label: 'ייבוא מרשם הדברה', icon: FileUp },
    { href: '/admin/registry-sync', label: 'סנכרון מרשם', icon: RefreshCw },
  ],
};

export const adminGroup: NavGroup = {
  id: 'admin',
  label: 'מנהל מערכת',
  requiredRole: 'admin',
  collapsible: true,
  defaultCollapsed: true,
  items: [
    // Both of these existed and worked but were reachable only by typing the
    // URL. They are also the two halves of onboarding a tenant: create the
    // customer, then give them areas — without the second, selecting a newly
    // created customer shows an empty app and no way forward.
    { href: '/admin/customers', label: 'ניהול לקוחות', icon: Building2 },
    { href: '/admin/areas-management', label: 'שיוך שטחים ללקוחות', icon: MapPinned },
    // The third step of onboarding an olive tenant: load their data. Replaces
    // what is there, so it is an admin operation rather than a customer one.
    { href: '/admin/olive-import', label: 'ייבוא נתוני מסיק', icon: FileUp },
    { href: '/admin/roles', label: 'תפקידים והרשאות', icon: Shield },
    { href: '/admin/monitoring', label: 'ניטור - מנהל', icon: ClipboardList },
    { href: '/admin/actions', label: 'פעולות - מנהל', icon: ListChecks },
  ],
};

/**
 * Olive leads. For a grower with an olive licence the harvest module is the
 * job, and the generic workflow pages are the supporting cast. It is hidden
 * entirely for everyone else (requiredFeature), so this costs non-olive tenants
 * nothing.
 */
export const allNavGroups: NavGroup[] = [oliveGroup, workflowGroup, managementGroup, adminGroup];

export const bottomNavItems: NavItem[] = workflowGroup.items;

/**
 * Where a signed-in user lands when they ask for no page in particular.
 *
 * Derived from the group consts rather than hardcoded strings so it cannot
 * drift from the menu: whatever leads the olive group is what `/` resolves to.
 * Falls back to the dashboard when the olive module is off, which is also the
 * case for an admin who has selected no customer.
 */
export function getLandingPath(features: NavFeatures = {}): string {
  return features.olive ? oliveGroup.items[0].href : workflowGroup.items[0].href;
}

export function getVisibleNavGroups(
  isAdmin: boolean,
  isCustomerOwner: boolean,
  features: NavFeatures = {}
): NavGroup[] {
  return allNavGroups.filter((group) => {
    if (group.requiredFeature && !features[group.requiredFeature]) return false;
    if (!group.requiredRole) return true;
    if (group.requiredRole === 'admin') return isAdmin;
    if (group.requiredRole === 'customer_owner') return isAdmin || isCustomerOwner;
    return false;
  });
}
