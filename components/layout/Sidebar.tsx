'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser } from '@/components/providers/UserProvider';
import { getVisibleNavGroups, type NavItem } from '@/lib/navigation';
import { getDirection } from '@/lib/rtl';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase/client';
import { PanelRightClose, PanelRightOpen, LogOut } from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
}

function NavItemLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      data-active={active}
      className={cn(
        'sidebar-nav-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
        active
          ? 'bg-sidebar-accent text-sidebar-primary'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className="size-5 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="left" className="font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const dir = getDirection();

  const navGroups = getVisibleNavGroups(
    user?.isAdmin ?? false,
    user?.isCustomerOwner ?? false,
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside
      dir={dir}
      className={cn(
        'sidebar-gradient sidebar-transition fixed inset-y-0 start-0 z-40 hidden flex-col border-e border-sidebar-border md:flex',
        collapsed ? 'w-[var(--sidebar-width-collapsed)]' : 'w-[var(--sidebar-width)]',
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center">
              <img
                src="/logo.svg"
                alt="Logo"
                width={28}
                height={28}
                className="size-7"
              />
            </div>
            <span className="text-base font-bold text-sidebar-accent-foreground tracking-tight">
              Area Control Loop
            </span>
          </Link>
        )}

        {collapsed && (
          <Link href="/dashboard" className="flex items-center justify-center">
            <img src="/logo.svg" alt="Logo" width={28} height={28} className="size-7" />
          </Link>
        )}

        <button
          onClick={onToggleCollapse}
          className={cn(
            'flex size-8 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            collapsed && 'hidden',
          )}
          aria-label={collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
        >
          <PanelRightOpen className="size-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')}>
        {navGroups.map((group, groupIdx) => (
          <div key={group.id}>
            {groupIdx > 0 && (
              <Separator className="my-3 bg-sidebar-border" />
            )}

            {!collapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {group.label}
              </p>
            )}

            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavItemLink
                  key={item.href}
                  item={item}
                  active={pathname === item.href}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle (when collapsed, show it here) */}
      {collapsed && (
        <div className="flex justify-center px-2 pb-2">
          <button
            onClick={onToggleCollapse}
            className="flex size-9 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="הרחב תפריט"
          >
            <PanelRightClose className="size-4" />
          </button>
        </div>
      )}

      {/* User section */}
      <div
        className={cn(
          'shrink-0 border-t border-sidebar-border',
          collapsed ? 'px-2 py-3' : 'px-4 py-3',
        )}
      >
        {user && (
          <div
            className={cn(
              'flex items-center',
              collapsed ? 'flex-col gap-2' : 'gap-3',
            )}
          >
            <Avatar className="size-9 shrink-0">
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>

            {!collapsed && (
              <div className="flex flex-1 flex-col truncate">
                <span className="truncate text-sm font-medium text-sidebar-accent-foreground">
                  {user.name}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {user.role}
                </span>
              </div>
            )}

            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="flex size-9 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-destructive/20 hover:text-destructive"
                    aria-label="התנתק"
                  >
                    <LogOut className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">התנתק</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={handleLogout}
                className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-destructive/20 hover:text-destructive"
                aria-label="התנתק"
              >
                <LogOut className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
