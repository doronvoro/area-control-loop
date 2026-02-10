'use client';

import { useState } from 'react';
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
import { ReportDetailSheet } from './ReportDetailSheet';

interface ReportAreaData {
  id: string;
  name: string;
  area_type?: { id: string; name: string; display_name: string };
  description?: string;
  status: string;
  created_at: string;
  report_number?: number;
  area?: { id: string; name: string };
  worker?: { id: string; name: string };
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
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function handleRowClick(reportId: string) {
    setSelectedReportId(reportId);
    setSheetOpen(true);
  }

  return (
    <>
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
                <TableHead>שטח</TableHead>
                <TableHead>עובד</TableHead>
                <TableHead>סוג</TableHead>
                <TableHead>סטטוס</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportAreas.map((reportArea) => (
                <TableRow
                  key={reportArea.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(reportArea.id)}
                >
                  <TableCell className="font-medium">{reportArea.report_number || '-'}</TableCell>
                  <TableCell>
                    {new Date(reportArea.created_at).toLocaleDateString('he-IL')}{' '}
                    {new Date(reportArea.created_at).toLocaleTimeString('he-IL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell>{reportArea.area?.name || '-'}</TableCell>
                  <TableCell>{reportArea.worker?.name || '-'}</TableCell>
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

      <ReportDetailSheet
        reportId={selectedReportId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
