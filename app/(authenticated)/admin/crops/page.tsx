import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { CropsManager } from '@/components/admin/CropsManager';
import { Sprout } from 'lucide-react';

export default async function CropsPage() {
  await requireAuth();

  const [isAdmin, isCustomerOwner] = await Promise.all([
    hasRole('admin'),
    hasRole('customer_owner'),
  ]);
  if (!isAdmin && !isCustomerOwner) {
    redirect('/dashboard');
  }

  return (
    <>
      <PageHeader
        icon={Sprout}
        title="ניהול גידולים"
        description="ניהול רשימת הגידולים במערכת. גידולים משמשים לסיווג שטחים ותתי-שטחים ולהמלצות חומרים."
      />
      <CropsManager />
    </>
  );
}
