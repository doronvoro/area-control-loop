'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useUser } from '@/components/providers/UserProvider';
import { allNavGroups, getLandingPath, getVisibleNavGroups, type NavItem } from '@/lib/navigation';
import { useCollapsedNavGroups } from '@/hooks/useCollapsedNavGroups';
import { getDirection } from '@/lib/rtl';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { CustomerSwitcher } from './CustomerSwitcher';
import { supabase } from '@/lib/supabase/client';
import { PanelRightClose, PanelRightOpen, LogOut, ChevronDown } from 'lucide-react';

interface SidebarProps {
  /**
   * The whole sidebar is reduced to an icon rail. Unrelated to per-group
   * folding, which is owned by useCollapsedNavGroups.
   */
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

  const className = cn(
    'sidebar-nav-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
    active
      ? 'bg-sidebar-accent text-sidebar-primary'
      : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
    collapsed && 'justify-center px-0',
  );

  const body = (
    <>
      <Icon className="size-5 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </>
  );

  // An external item is a document, not a screen: a plain anchor to a new tab,
  // so the client router is never asked for a route that does not exist and
  // the user does not lose the screen they were on.
  const link = item.external ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <Link href={item.href} data-active={active} className={className}>
      {body}
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
    user?.features ?? {},
  );

  const { collapsedGroupIds, setGroupOpen, openGroup } = useCollapsedNavGroups();
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    // Once per page load: a reload or a typed URL must never leave the current
    // page hidden inside a folded group. Never fires on an olive page, since
    // that group is not collapsible — so an olive tenant always sees the plain
    // default view. After this the user's own toggles rule until the next load.
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;

    const activeGroup = allNavGroups.find((g) => g.items.some((i) => i.href === pathname));
    if (activeGroup) openGroup(activeGroup.id);
  }, [pathname, openGroup]);

  const landingPath = getLandingPath(user?.features);

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
          <Link href={landingPath} className="flex items-center gap-2.5">
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
          <Link href={landingPath} className="flex items-center justify-center">
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

      {/* Active customer (admins only; renders nothing for everyone else) */}
      <div className={cn('pb-2', collapsed ? 'flex justify-center px-2' : 'px-3')}>
        <CustomerSwitcher collapsed={collapsed} variant="sidebar" />
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')}>
        {navGroups.map((group, groupIdx) => {
          // The icon rail has no group headers, so a folded group there would be
          // items hidden behind a control that is not on screen. Force open.
          const isGroupOpen =
            collapsed || !group.collapsible || !collapsedGroupIds.includes(group.id);
          const hasActiveItem = group.items.some((item) => pathname === item.href);

          return (
            <Collapsible
              key={group.id}
              open={isGroupOpen}
              onOpenChange={(open) => setGroupOpen(group.id, open)}
            >
              {groupIdx > 0 && (
                <Separator className="my-3 bg-sidebar-border" />
              )}

              {!collapsed &&
                (group.collapsible ? (
                  <CollapsibleTrigger
                    className={cn(
                      'mb-2 flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5',
                      'text-xs font-semibold uppercase tracking-wider transition-colors',
                      'hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                      // A folded group still shows that you are somewhere inside it.
                      !isGroupOpen && hasActiveItem
                        ? 'text-sidebar-primary'
                        : 'text-sidebar-foreground/50 hover:text-sidebar-accent-foreground',
                    )}
                  >
                    <span className="truncate">{group.label}</span>
                    {/* Vertical only: a down chevron rotated 180deg reads the
                        same in RTL and LTR, where a start/end one would need
                        mirroring. */}
                    <ChevronDown
                      className={cn(
                        'size-4 shrink-0 transition-transform duration-200',
                        isGroupOpen && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                  </CollapsibleTrigger>
                ) : (
                  <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                    {group.label}
                  </p>
                ))}

              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
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
              </CollapsibleContent>
            </Collapsible>
          );
        })}
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
