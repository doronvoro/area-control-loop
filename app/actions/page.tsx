import { requireAuth, getCurrentWorker } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { ActionForm } from '@/components/actions/ActionForm';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/permissions';

export default async function ActionsPage() {
  await requireAuth();
  const supabase = await createClient();
  const isAdmin = await hasRole('admin');
  const currentWorker = await getCurrentWorker() as { id: string; customer_id: string } | null;

  // Fetch lookup data
  const [customersResult, findingsResult, actionTypesResult, unitTypesResult] = await Promise.all([
    isAdmin ? supabase.from('customers').select('*').order('name') : { data: [] },
    supabase.from('findings').select('*').order('name'),
    supabase.from('action_types').select('*').order('name'),
    supabase.from('unit_types').select('*').order('name'),
  ]);

  // For non-admin users, get their customer's areas and action workers
  let initialAreas: any[] = [];
  let initialWorkers: any[] = [];

  if (!isAdmin && currentWorker?.customer_id) {
    const [areasRes, workersRes] = await Promise.all([
      supabase
        .from('customer_areas')
        .select('areas(*)')
        .eq('customer_id', currentWorker.customer_id),
      supabase
        .from('workers')
        .select('*, worker_types!inner(*)')
        .eq('customer_id', currentWorker.customer_id)
        .eq('worker_types.name', 'action_worker'),
    ]);

    initialAreas = (areasRes.data || []).map((ca: any) => ca.areas).filter(Boolean);
    initialWorkers = workersRes.data || [];
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">טופס פעולה</h1>
        <ActionForm
          isAdmin={isAdmin}
          customers={customersResult.data || []}
          initialAreas={initialAreas}
          initialWorkers={initialWorkers}
          findings={findingsResult.data || []}
          actionTypes={actionTypesResult.data || []}
          unitTypes={unitTypesResult.data || []}
          currentWorkerId={currentWorker?.id}
        />
      </main>
    </div>
  );
}
