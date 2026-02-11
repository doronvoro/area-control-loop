import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { Navbar } from '@/components/layout/Navbar';
import { CropsManager } from '@/components/admin/CropsManager';

export default async function CropsPage() {
  await requireAuth();

  // Admins and customer owners can access this page
  const [isAdmin, isCustomerOwner] = await Promise.all([
    hasRole('admin'),
    hasRole('customer_owner'),
  ]);
  if (!isAdmin && !isCustomerOwner) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">ניהול גידולים</h1>
        <p className="text-muted-foreground mb-6">
          ניהול רשימת הגידולים במערכת. גידולים משמשים לסיווג שטחים ותתי-שטחים ולהמלצות חומרים.
        </p>
        <CropsManager />
      </main>
    </div>
  );
}
