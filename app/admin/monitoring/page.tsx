import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
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
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">דוח ניטור - מנהל</h1>
        <AdminMonitoringPageContent />
      </main>
    </div>
  );
}
