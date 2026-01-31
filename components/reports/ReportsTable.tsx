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

interface SubAreaReport {
  id: string;
  action_time?: string;
  created_at: string;
  status: string;
  notes?: string;
  recommend_dosage?: number;
  sub_area?: { id: string; name: string };
  finding?: { name: string; description?: string };
  action_type?: { name: string; description?: string };
  recommend_action_type?: { name: string; description?: string };
  recommend_material?: { name: string; description?: string };
  recommend_unit_type?: { name: string; description?: string };
}

interface ReportAreaData {
  id: string;
  name: string;
  type: string;
  description?: string;
  created_at: string;
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
                  <TableCell>
                    {new Date(reportArea.created_at).toLocaleDateString('he-IL')}
                  </TableCell>
                  <TableCell className="font-medium">{reportArea.name}</TableCell>
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
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
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
