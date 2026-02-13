'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { UserProvider } from '@/components/providers/UserProvider';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <UserProvider>
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />

        {/* Main content */}
        <main
          className={cn(
            'min-h-screen sidebar-content-transition',
            // Desktop: offset by sidebar width on the start side
            sidebarCollapsed
              ? 'md:ms-[var(--sidebar-width-collapsed)]'
              : 'md:ms-[var(--sidebar-width)]',
            // Mobile: bottom padding for bottom nav
            'pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] md:pb-0',
          )}
        >
          <div className="page-enter container mx-auto px-4 py-6 md:py-8">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <BottomNav />
      </div>
    </UserProvider>
  );
}
