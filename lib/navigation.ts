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
}

export const workflowGroup: NavGroup = {
  id: 'workflow',
  label: 'תהליך עבודה',
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
  items: [
    { href: '/admin/roles', label: 'תפקידים והרשאות', icon: Shield },
    { href: '/admin/monitoring', label: 'ניטור - מנהל', icon: ClipboardList },
    { href: '/admin/actions', label: 'פעולות - מנהל', icon: ListChecks },
  ],
};

export const allNavGroups: NavGroup[] = [workflowGroup, oliveGroup, managementGroup, adminGroup];

export const bottomNavItems: NavItem[] = workflowGroup.items;

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
