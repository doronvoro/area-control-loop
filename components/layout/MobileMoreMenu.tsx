'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser } from '@/components/providers/UserProvider';
import { getVisibleNavGroups } from '@/lib/navigation';
import { useCollapsedNavGroups } from '@/hooks/useCollapsedNavGroups';
import { getDirection } from '@/lib/rtl';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { CustomerSwitcher } from './CustomerSwitcher';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { supabase } from '@/lib/supabase/client';
import { LogOut, ChevronLeft, ChevronDown } from 'lucide-react';

interface MobileMoreMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
}

export function MobileMoreMenu({ open, onOpenChange }: MobileMoreMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const dir = getDirection();

  const navGroups = getVisibleNavGroups(
    user?.isAdmin ?? false,
    user?.isCustomerOwner ?? false,
    user?.features ?? {},
  );

  // Filter out the workflow group since those are already in the bottom nav
  const menuGroups = navGroups.filter((g) => g.id !== 'workflow');

  // Same key as the sidebar: sharing the preference across form factors is the
  // point, and only one of the two is ever mounted visibly.
  const { collapsedGroupIds, setGroupOpen } = useCollapsedNavGroups();

  const handleLogout = async () => {
    onOpenChange(false);
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        dir={dir}
        showCloseButton={false}
        className="rounded-t-2xl px-0 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))]"
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <SheetHeader className="px-5 pb-2">
          <SheetTitle className="sr-only">תפריט נוסף</SheetTitle>
        </SheetHeader>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-3 px-5 pb-4">
            <Avatar className="size-11">
              <AvatarFallback className="bg-primary text-primary-foreground text-base">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-base font-semibold text-foreground">
                {user.name}
              </span>
              <span className="text-sm text-muted-foreground">{user.role}</span>
            </div>
          </div>
        )}

        <div className="px-5 pb-3">
          <CustomerSwitcher />
        </div>

        <Separator />

        {/* Menu groups */}
        <div className="max-h-[50vh] overflow-y-auto">
          {menuGroups.map((group) => {
            const isGroupOpen = !group.collapsible || !collapsedGroupIds.includes(group.id);
            const hasActiveItem = group.items.some((item) => pathname === item.href);

            return (
              <Collapsible
                key={group.id}
                open={isGroupOpen}
                onOpenChange={(open) => setGroupOpen(group.id, open)}
              >
                <div className="py-2">
                  {group.collapsible ? (
                    <CollapsibleTrigger
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-5 py-2',
                        'text-xs font-semibold uppercase tracking-wider transition-colors active:bg-muted',
                        !isGroupOpen && hasActiveItem ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      <span className="truncate">{group.label}</span>
                      {/* Vertical, unlike the per-item ChevronLeft below: that
                          one means "forward", which is leftward in RTL. */}
                      <ChevronDown
                        className={cn(
                          'size-4 shrink-0 transition-transform duration-200',
                          isGroupOpen && 'rotate-180',
                        )}
                        aria-hidden="true"
                      />
                    </CollapsibleTrigger>
                  ) : (
                    <p className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </p>
                  )}

                  <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href;
                      const className = cn(
                        'flex items-center gap-3 px-5 py-3 transition-colors',
                        active
                          ? 'bg-accent text-primary font-medium'
                          : 'text-foreground active:bg-muted',
                      );
                      const body = (
                        <>
                          <Icon className="size-5 shrink-0" />
                          <span className="flex-1 text-sm">{item.label}</span>
                          <ChevronLeft className="size-4 text-muted-foreground" />
                        </>
                      );

                      // A document rather than a screen — see NavItem.external.
                      if (item.external) {
                        return (
                          <a
                            key={item.href}
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => onOpenChange(false)}
                            className={className}
                          >
                            {body}
                          </a>
                        );
                      }

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => onOpenChange(false)}
                          className={className}
                        >
                          {body}
                        </Link>
                      );
                    })}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}

          {menuGroups.length === 0 && (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">
              אין אפשרויות נוספות
            </div>
          )}
        </div>

        <Separator />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-5 py-3 text-destructive transition-colors active:bg-destructive/10"
        >
          <LogOut className="size-5" />
          <span className="text-sm font-medium">התנתק</span>
        </button>
      </SheetContent>
    </Sheet>
  );
}
