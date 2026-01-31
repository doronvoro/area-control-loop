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
import { ReportDetailDialog } from './ReportDetailDialog';

interface Treatment {
  id: string;
  dosage?: number | null;
  status: string;
  notes?: string | null;
  action_time?: string | null;
  material?: { name: string; description?: string | null } | null;
  action_type?: { name: string; description?: string | null } | null;
  unit_type?: { name: string; description?: string | null } | null;
}

interface SubAreaReport {
  id: string;
  created_at: string;
  status: string;
  sub_area?: { id: string; name: string } | null;
  finding?: { name: string; description?: string | null } | null;
  treatments?: Treatment[];
}

interface ReportAreaData {
  id: string;
  name: string;
  type: string;
  description?: string;
  created_at: string;
  report_number?: number;
  area?: { id: string; name: string };
  monitoring_reports?: SubAreaReport[];
  action_reports?: SubAreaReport[];
}

interface ReportsTableProps {
  reportAreas: ReportAreaData[];
}

export function ReportsTable({ reportAreas }: ReportsTableProps) {
  const [selectedReport, setSelectedReport] = useState<ReportAreaData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleRowClick = (reportArea: ReportAreaData) => {
    setSelectedReport(reportArea);
    setDialogOpen(true);
  };

  const getReportStatus = (reportArea: ReportAreaData): string => {
    const allReports = [
      ...(reportArea.monitoring_reports || []),
      ...(reportArea.action_reports || []),
    ];

    if (allReports.length === 0) return 'ריק';

    const statuses = allReports.map((r) => r.status);
    if (statuses.every((s) => s === 'completed')) return 'הושלם';
    if (statuses.some((s) => s === 'in_progress')) return 'בביצוע';
    return 'ממתין';
  };

  const getSubAreasCount = (reportArea: ReportAreaData): number => {
    const subAreaIds = new Set<string>();
    reportArea.monitoring_reports?.forEach((r) => {
      if (r.sub_area?.id) subAreaIds.add(r.sub_area.id);
    });
    reportArea.action_reports?.forEach((r) => {
      if (r.sub_area?.id) subAreaIds.add(r.sub_area.id);
    });
    return subAreaIds.size;
  };

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
                <TableHead>שם הדוח</TableHead>
                <TableHead>שטח</TableHead>
                <TableHead>סוג</TableHead>
                <TableHead>תתי-שטחים</TableHead>
                <TableHead>סטטוס</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportAreas.map((reportArea) => (
                <TableRow
                  key={reportArea.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(reportArea)}
                >
                  <TableCell className="font-medium">{reportArea.report_number || '-'}</TableCell>
                  <TableCell>
                    {new Date(reportArea.created_at).toLocaleDateString('he-IL')}
                  </TableCell>
                  <TableCell>{reportArea.name}</TableCell>
                  <TableCell>{reportArea.area?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {reportArea.type === 'monitoring' ? 'ניטור' : 'פעולה'}
                    </Badge>
                  </TableCell>
                  <TableCell>{getSubAreasCount(reportArea)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getReportStatus(reportArea)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {reportAreas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    אין דוחות
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ReportDetailDialog
        reportArea={selectedReport}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
