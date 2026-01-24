import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { MonitoringForm } from '@/components/monitoring/MonitoringForm';
import { createClient } from '@/lib/supabase/server';

export default async function MonitoringPage() {
  await requireAuth();
  const supabase = await createClient();

  // Fetch lookup data
  const { data: workerType } = await supabase
    .from('worker_types')
    .select('id')
    .eq('name', 'inspector')
    .single();

  const inspectorTypeId = (workerType as { id: string } | null)?.id;

  const [inspectors, areas, reportAreas, findings, actionTypes, unitTypes] = await Promise.all([
    inspectorTypeId
      ? supabase
          .from('workers')
          .select('*, worker_types(*)')
          .eq('type_id', inspectorTypeId)
      : { data: [] },
    supabase.from('areas').select('*').order('name'),
    supabase.from('report_areas').select('*').eq('type', 'monitoring').order('name'),
    supabase.from('findings').select('*').order('description'),
    supabase.from('action_types').select('*').order('description'),
    supabase.from('unit_types').select('*').order('description'),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">טופס ניטור</h1>
        <MonitoringForm
          inspectors={inspectors.data || []}
          areas={areas.data || []}
          reportAreas={reportAreas.data || []}
          findings={findings.data || []}
          actionTypes={actionTypes.data || []}
          unitTypes={unitTypes.data || []}
        />
      </main>
    </div>
  );
}
