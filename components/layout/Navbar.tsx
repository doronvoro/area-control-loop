'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/lib/supabase/client';
import { getDirection } from '@/lib/rtl';
import { Menu } from 'lucide-react';
import { Logo } from './Logo';

const menuItems = [
  { href: '/dashboard', label: 'דשבורד' },
  { href: '/monitoring', label: 'ניטור' },
  { href: '/actions', label: 'פעולות' },
  { href: '/reports', label: 'דוחות' },
  { href: '/areas', label: 'שטחים' },
];

const adminMenuItems = [
  { href: '/admin/customers', label: 'לקוחות' },
  { href: '/admin/recommend-materials', label: 'המלצות חומרים' },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const pathname = usePathname();
  const router = useRouter();
  const dir = getDirection();

  useEffect(() => {
    const loadUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get user name from metadata or from customer/worker table
        const nameFromMetadata = user.user_metadata?.name || user.email?.split('@')[0] || '';
        
        // Try to get name from customer or worker table
        const [customerResult, workerResult, rolesResult] = await Promise.all([
          supabase
            .from('customers')
            .select('name')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('workers')
            .select('name')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('user_roles')
            .select('roles(name, display_name)')
            .eq('user_id', user.id),
        ]);

        // Determine the best name to display
        let displayName = nameFromMetadata;
        if (customerResult.data?.name) {
          displayName = customerResult.data.name;
        } else if (workerResult.data?.name) {
          displayName = workerResult.data.name;
        }
        setUserName(displayName);

        // Get role information
        const roles = rolesResult.data || [];
        const roleNames = roles
          .map((ur: any) => ur.roles?.display_name || ur.roles?.name)
          .filter(Boolean);
        
        if (roleNames.length > 0) {
          setUserRole(roleNames.join(', '));
        } else {
          setUserRole('ללא תפקיד');
        }

        // Check if admin
        const hasAdminRole = roles.some((ur: any) => ur.roles?.name === 'admin');
        setIsAdmin(hasAdminRole || false);
      }
    };
    loadUserInfo();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const allMenuItems = isAdmin ? [...menuItems, ...adminMenuItems] : menuItems;

  return (
    <nav dir={dir} className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">תפריט</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" dir={dir}>
                <nav className="flex flex-col gap-4 mt-8">
                  {userName && (
                    <div className="flex flex-col items-end px-3 py-2 border-b border-border mb-2">
                      <span className="text-base font-medium text-foreground">{userName}</span>
                      {userRole && (
                        <span className="text-sm text-muted-foreground">{userRole}</span>
                      )}
                    </div>
                  )}
                  {allMenuItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`text-lg ${
                        pathname === item.href
                          ? 'font-bold text-primary'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="mt-4"
                  >
                    התנתק
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>

            <Logo size="md" />
          </div>

          <div className="hidden md:flex items-center gap-4">
            {allMenuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {userName && (
              <div className="flex flex-col items-end px-3 py-1 border-r border-border mr-2">
                <span className="text-sm font-medium text-foreground">{userName}</span>
                {userRole && (
                  <span className="text-xs text-muted-foreground">{userRole}</span>
                )}
              </div>
            )}
            <Button variant="outline" onClick={handleLogout} size="sm">
              התנתק
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
