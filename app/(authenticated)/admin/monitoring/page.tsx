import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { AdminMonitoringPageContent } from '@/components/admin/AdminMonitoringPageContent';

export default async function AdminMonitoringPage() {
  await requireAuth();

  // Only admins can access this page
  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">דוח ניטור - מנהל</h1>
      <AdminMonitoringPageContent />
    </>
  );
}
