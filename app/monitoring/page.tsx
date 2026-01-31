import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { MonitoringForm } from '@/components/monitoring/MonitoringForm';
import { createClient } from '@/lib/supabase/server';

export default async function MonitoringPage() {
  await requireAuth();
  const supabase = await createClient();

  // Fetch lookup data - customers, findings, and unit types
  // Other data (inspectors, areas, sub-areas, action types, materials) are fetched dynamically based on selections
  const [customers, findings, unitTypes] = await Promise.all([
    supabase.from('customers').select('*').order('name'),
    supabase.from('findings').select('*').order('description'),
    supabase.from('unit_types').select('*').order('description'),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">טופס ניטור</h1>
        <MonitoringForm
          customers={customers.data || []}
          findings={findings.data || []}
          unitTypes={unitTypes.data || []}
        />
      </main>
    </div>
  );
}
