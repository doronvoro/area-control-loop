'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { bottomNavItems } from '@/lib/navigation';
import { MoreHorizontal } from 'lucide-react';
import { MobileMoreMenu } from './MobileMoreMenu';

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-background/95 backdrop-blur-sm safe-bottom md:hidden"
        role="navigation"
        aria-label="ניווט ראשי"
      >
        <div className="flex w-full items-stretch">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground active:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  className={cn('size-5', active && 'stroke-[2.5]')}
                />
                <span className="text-[10px] font-medium leading-tight">
                  {item.label}
                </span>
                <div
                  className="bottom-nav-dot"
                  data-active={active}
                  aria-hidden="true"
                />
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors',
              moreOpen
                ? 'text-primary'
                : 'text-muted-foreground active:text-foreground',
            )}
            aria-label="עוד אפשרויות"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal className="size-5" />
            <span className="text-[10px] font-medium leading-tight">עוד</span>
            <div className="bottom-nav-dot" data-active="false" aria-hidden="true" />
          </button>
        </div>
      </nav>

      <MobileMoreMenu open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
