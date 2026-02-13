import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { FindingsManager } from '@/components/admin/FindingsManager';
import { Bug } from 'lucide-react';

export default async function FindingsPage() {
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
        icon={Bug}
        title="ניהול ממצאים"
        description="ניהול רשימת הממצאים במערכת. ממצאים משמשים לתיעוד בדוחות ניטור ופעולות."
      />
      <FindingsManager />
    </>
  );
}
