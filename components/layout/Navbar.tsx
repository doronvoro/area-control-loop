'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/lib/supabase/client';
import { getDirection } from '@/lib/rtl';
import { Menu } from 'lucide-react';

const menuItems = [
  { href: '/dashboard', label: 'דשבורד' },
  { href: '/monitoring', label: 'ניטור' },
  { href: '/actions', label: 'פעולות' },
  { href: '/reports', label: 'דוחות' },
  { href: '/areas', label: 'שטחים' },
];

const adminMenuItems = [
  { href: '/admin/recommend-materials', label: 'המלצות חומרים' },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const dir = getDirection();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_roles')
          .select('roles(name)')
          .eq('user_id', user.id);
        const hasAdminRole = data?.some((ur: any) => ur.roles?.name === 'admin');
        setIsAdmin(hasAdminRole || false);
      }
    };
    checkAdmin();
  }, [supabase]);

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

            <Link href="/dashboard" className="text-xl font-bold">
              Area Control Loop
            </Link>
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
            <Button variant="outline" onClick={handleLogout} size="sm">
              התנתק
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
