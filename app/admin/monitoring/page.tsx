import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/permissions';
import { AdminMonitoringForm } from '@/components/admin/AdminMonitoringForm';

export default async function AdminMonitoringPage() {
  await requireAuth();

  // Only admins can access this page
  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // Load all customers for dropdown
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('name');

  // Load all unit types for the form
  const { data: unitTypes } = await supabase
    .from('unit_types')
    .select('*')
    .order('name');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">דוח ניטור - מנהל</h1>

        <AdminMonitoringForm
          customers={customers || []}
          unitTypes={unitTypes || []}
        />
      </main>
    </div>
  );
}
