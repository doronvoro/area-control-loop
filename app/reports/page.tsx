import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/server';
import { ReportsTable } from '@/components/reports/ReportsTable';

export default async function ReportsPage() {
  await requireAuth();
  const supabase = await createClient();

  // Fetch report_areas with their monitoring and action reports including treatments
  const { data: reportAreas } = await supabase
    .from('report_areas')
    .select(
      `id, name, type, description, created_at, report_number,
      area:areas(id, name),
      monitoring_reports:monitoring_area_report(
        id, status, created_at,
        sub_area:sub_areas(id, name),
        finding:findings(name, description),
        treatments:monitoring_treatments(
          id, dosage, status, notes,
          material:materials(name, description),
          action_type:action_types(name, description),
          unit_type:unit_types(name, description)
        )
      ),
      action_reports:actions_area_report(
        id, status, created_at,
        sub_area:sub_areas(id, name),
        finding:findings(name, description),
        treatments:action_treatments(
          id, dosage, status, notes, action_time,
          material:materials(name, description),
          action_type:action_types(name, description),
          unit_type:unit_types(name, description)
        )
      )`
    )
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">דוחות</h1>
        <ReportsTable reportAreas={reportAreas || []} />
      </main>
    </div>
  );
}
