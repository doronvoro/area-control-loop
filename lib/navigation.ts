import {
  LayoutDashboard,
  Search,
  Zap,
  FileText,
  Users,
  MapPin,
  Sprout,
  Bug,
  FlaskConical,
  Shield,
  ClipboardList,
  ListChecks,
  Map,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  requiredRole?: 'customer_owner' | 'admin';
}

export const workflowGroup: NavGroup = {
  id: 'workflow',
  label: 'תהליך עבודה',
  items: [
    { href: '/dashboard', label: 'דשבורד', icon: LayoutDashboard },
    { href: '/monitoring', label: 'ניטור', icon: Search },
    { href: '/actions', label: 'פעולות', icon: Zap },
    { href: '/area-map', label: 'מפת שטחים', icon: Map },
    { href: '/reports', label: 'דוחות', icon: FileText },
  ],
};

export const managementGroup: NavGroup = {
  id: 'management',
  label: 'ניהול',
  requiredRole: 'customer_owner',
  items: [
    { href: '/admin/workers', label: 'ניהול עובדים', icon: Users },
    { href: '/admin/areas-management', label: 'ניהול שטחים', icon: MapPin },
    { href: '/admin/crops', label: 'ניהול גידולים', icon: Sprout },
    { href: '/admin/findings', label: 'ניהול ממצאים', icon: Bug },
    { href: '/admin/recommend-materials', label: 'המלצות חומרים', icon: FlaskConical },
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

export const allNavGroups: NavGroup[] = [workflowGroup, managementGroup, adminGroup];

export const bottomNavItems: NavItem[] = workflowGroup.items;

export function getVisibleNavGroups(
  isAdmin: boolean,
  isCustomerOwner: boolean,
): NavGroup[] {
  return allNavGroups.filter((group) => {
    if (!group.requiredRole) return true;
    if (group.requiredRole === 'admin') return isAdmin;
    if (group.requiredRole === 'customer_owner') return isAdmin || isCustomerOwner;
    return false;
  });
}
