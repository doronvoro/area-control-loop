import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { hasRole } from '@/lib/permissions';
import { AdminActionPageContent } from '@/components/admin/AdminActionPageContent';

export default async function AdminActionsPage() {
  await requireAuth();

  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">דוח פעולה - מנהל</h1>
        <AdminActionPageContent />
      </main>
    </div>
  );
}
