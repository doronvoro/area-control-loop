import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  await requireAuth();
  const supabase = await createClient();

  // Get statistics
  const [monitoringCount, actionsCount, pendingMonitoring] = await Promise.all([
    supabase
      .from('monitoring_area_report')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('actions_area_report')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('monitoring_area_report')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">דשבורד</h1>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>דוחות ניטור</CardTitle>
              <CardDescription>סה"כ דוחות ניטור</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {monitoringCount.count || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>דוחות פעולה</CardTitle>
              <CardDescription>סה"כ דוחות פעולה</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{actionsCount.count || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ניטור ממתין</CardTitle>
              <CardDescription>דוחות ניטור הממתינים לפעולה</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {pendingMonitoring.count || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
