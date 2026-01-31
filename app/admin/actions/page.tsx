import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/permissions';
import { AdminActionForm } from '@/components/admin/AdminActionForm';

export default async function AdminActionsPage() {
  await requireAuth();

  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  const [customersResult, findingsResult, actionTypesResult, unitTypesResult] = await Promise.all([
    supabase.from('customers').select('*').order('name'),
    supabase.from('findings').select('*').order('name'),
    supabase.from('action_types').select('*').order('name'),
    supabase.from('unit_types').select('*').order('name'),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">דוח פעולה - מנהל</h1>
        <AdminActionForm
          customers={customersResult.data || []}
          findings={findingsResult.data || []}
          actionTypes={actionTypesResult.data || []}
          unitTypes={unitTypesResult.data || []}
        />
      </main>
    </div>
  );
}
