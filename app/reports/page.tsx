import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/server';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ReportsPage() {
  await requireAuth();
  const supabase = await createClient();

  const [monitoringReports, actionReports] = await Promise.all([
    supabase
      .from('monitoring_area_report')
      .select(
        '*, area_report:report_areas(name), sub_area:sub_areas(name), finding:findings(name, description)'
      )
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('actions_area_report')
      .select(
        '*, area_report:report_areas(name), sub_area:sub_areas(name), finding:findings(name, description), action_type:action_types(name, description)'
      )
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">דוחות</h1>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>דוחות ניטור</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>תאריך</TableHead>
                    <TableHead>שטח דוח</TableHead>
                    <TableHead>תת-שטח</TableHead>
                    <TableHead>ממצא</TableHead>
                    <TableHead>סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monitoringReports.data?.map((report: any) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        {new Date(report.action_time || report.created_at).toLocaleDateString('he-IL')}
                      </TableCell>
                      <TableCell>{report.area_report?.name || '-'}</TableCell>
                      <TableCell>{report.sub_area?.name || '-'}</TableCell>
                      <TableCell>{report.finding?.description || report.finding?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {report.status === 'pending' ? 'ממתין' :
                           report.status === 'in_progress' ? 'בביצוע' :
                           report.status === 'completed' ? 'הושלם' : report.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>דוחות פעולה</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>תאריך</TableHead>
                    <TableHead>שטח דוח</TableHead>
                    <TableHead>תת-שטח</TableHead>
                    <TableHead>ממצא</TableHead>
                    <TableHead>סוג פעולה</TableHead>
                    <TableHead>סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actionReports.data?.map((report: any) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        {new Date(report.action_time || report.created_at).toLocaleDateString('he-IL')}
                      </TableCell>
                      <TableCell>{report.area_report?.name || '-'}</TableCell>
                      <TableCell>{report.sub_area?.name || '-'}</TableCell>
                      <TableCell>{report.finding?.description || report.finding?.name || '-'}</TableCell>
                      <TableCell>{report.action_type?.description || report.action_type?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {report.status === 'planned' ? 'מתוכנן' :
                           report.status === 'in_progress' ? 'בביצוע' :
                           report.status === 'completed' ? 'הושלם' : report.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
