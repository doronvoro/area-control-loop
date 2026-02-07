'use client';

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

interface ReportAreaData {
  id: string;
  name: string;
  area_type?: { id: string; name: string; display_name: string };
  description?: string;
  status: string;
  created_at: string;
  report_number?: number;
  area?: { id: string; name: string };
}

interface ReportsTableProps {
  reportAreas: ReportAreaData[];
}

const statusLabels: Record<string, string> = {
  pending: 'ממתין',
  in_progress: 'בביצוע',
  completed: 'הושלם',
};

export function ReportsTable({ reportAreas }: ReportsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>דוחות שטחים</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>מס׳ דוח</TableHead>
              <TableHead>תאריך</TableHead>
              <TableHead>שם הדוח</TableHead>
              <TableHead>שטח</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>סטטוס</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportAreas.map((reportArea) => (
              <TableRow key={reportArea.id}>
                <TableCell className="font-medium">{reportArea.report_number || '-'}</TableCell>
                <TableCell>
                  {new Date(reportArea.created_at).toLocaleDateString('he-IL')}
                </TableCell>
                <TableCell>{reportArea.name}</TableCell>
                <TableCell>{reportArea.area?.name || '-'}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {reportArea.area_type?.display_name ||
                      (reportArea.area_type?.name === 'monitoring' ? 'ניטור' : 'פעולה')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {statusLabels[reportArea.status] || reportArea.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {reportAreas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  אין דוחות
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
