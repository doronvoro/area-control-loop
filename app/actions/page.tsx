import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { ActionForm } from '@/components/actions/ActionForm';
import { createClient } from '@/lib/supabase/server';

export default async function ActionsPage() {
  await requireAuth();
  const supabase = await createClient();

  // Fetch lookup data
  const { data: workerType } = await supabase
    .from('worker_types')
    .select('id')
    .eq('name', 'action_worker')
    .single();

  const actionWorkerTypeId = (workerType as { id: string } | null)?.id;

  const [actionWorkers, areas, findings, actionTypes, unitTypes] = await Promise.all([
    actionWorkerTypeId
      ? supabase
          .from('workers')
          .select('*, worker_types(*)')
          .eq('type_id', actionWorkerTypeId)
      : { data: [] },
    supabase.from('areas').select('*').order('name'),
    supabase.from('findings').select('*').order('description'),
    supabase.from('action_types').select('*').order('description'),
    supabase.from('unit_types').select('*').order('description'),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">טופס פעולה</h1>
        <ActionForm
          actionWorkers={actionWorkers.data || []}
          areas={areas.data || []}
          findings={findings.data || []}
          actionTypes={actionTypes.data || []}
          unitTypes={unitTypes.data || []}
        />
      </main>
    </div>
  );
}
