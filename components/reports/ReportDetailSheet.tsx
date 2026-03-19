'use client';

import { useState, useEffect } from 'react';
import { ACTION_TYPE_LABELS, ActionTypeName } from '@/types/database';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { SEVERITY_LABELS, ReportSeverity } from '@/types/database';
import { STATUS_LABELS, TREATMENT_STATUS_LABELS } from '@/lib/reports/labels';

interface ReportDetailSheetProps {
  reportId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Treatment {
  id: string;
  dosage: number | null;
  notes: string | null;
  status: string;
  action_time?: string | null;
  material: { id: string; name: string } | null;
  unit_type: { id: string; name: string } | null;
  action_type_id: string | null;
}

interface RecommendedTreatment {
  id: string;
  dosage: number;
  action_type_id: string | null;
  material: { id: string; name: string } | null;
  unit_type: { id: string; name: string } | null;
}

interface ReportEntry {
  id: string;
  severity: ReportSeverity | null;
  created_at: string;
  sub_area: { id: string; name: string; display: string | null } | null;
  finding: { id: string; name: string; description: string | null } | null;
  treatments: Treatment[];
  recommendedTreatments?: RecommendedTreatment[];
}

interface ReportDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  report_date: string | null;
  report_number: number;
  area_type_id: string;
  area_type: { name: string; display_name: string } | null;
  area: { id: string; name: string; description: string | null } | null;
  worker: { id: string; name: string } | null;
  monitoringEntries: ReportEntry[] | null;
  actionEntries: ReportEntry[] | null;
}

export function ReportDetailSheet({
  reportId,
  open,
  onOpenChange,
}: ReportDetailSheetProps) {
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId || !open) {
      setReport(null);
      return;
    }

    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/reports/${reportId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'שגיאה בטעינת הדוח');
        }

        const data = await response.json();
        setReport(data);
      } catch (err: any) {
        setError(err.message || 'שגיאה בטעינת הדוח');
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [reportId, open]);

  const isMonitoring = report?.area_type_id === 'monitoring';
  const entries = isMonitoring
    ? report?.monitoringEntries || []
    : report?.actionEntries || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {report ? `דוח מס׳ ${report.report_number}` : 'פרטי דוח'}
          </SheetTitle>
          {report && (
            <SheetDescription>
              {report.area_type?.display_name} - {report.area?.name}
            </SheetDescription>
          )}
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="mr-2 text-muted-foreground">טוען נתונים...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-destructive">
            <p>{error}</p>
          </div>
        )}

        {report && !loading && (
          <div className="flex flex-col gap-4 py-4">
            {/* Report Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">פרטי דוח</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">נוצר:</span>
                  <span>
                    {new Date(report.created_at).toLocaleDateString('he-IL')}{' '}
                    {new Date(report.created_at).toLocaleTimeString('he-IL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">מועד:</span>
                  <span>
                    {report.report_date ? (
                      <>
                        {new Date(report.report_date).toLocaleDateString('he-IL')}{' '}
                        {new Date(report.report_date).toLocaleTimeString('he-IL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </>
                    ) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">שטח:</span>
                  <span>{report.area?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">עובד:</span>
                  <span>{report.worker?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">סוג:</span>
                  <Badge variant="secondary">
                    {report.area_type?.display_name || '-'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">סטטוס:</span>
                  <Badge variant="outline">
                    {STATUS_LABELS[report.status] || report.status}
                  </Badge>
                </div>
                {report.description && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground block mb-1">תיאור:</span>
                    <span>{report.description}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Report Entries */}
            {entries.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {isMonitoring ? 'ממצאים' : 'פעולות'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {entries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={index > 0 ? 'border-t pt-4' : ''}
                    >
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-start">
                          <span className="font-medium">
                            {entry.sub_area?.display || entry.sub_area?.name || 'כל השטח'}
                          </span>
                          {entry.severity && (
                            <Badge
                              variant={
                                entry.severity === 'critical' || entry.severity === 'high'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {SEVERITY_LABELS[entry.severity as ReportSeverity] || entry.severity}
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground">
                          ממצא: {entry.finding?.name || '-'}
                        </div>
                        {entry.finding?.description && (
                          <div className="text-xs text-muted-foreground">
                            {entry.finding.description}
                          </div>
                        )}

                        {/* Treatments */}
                        {entry.treatments && entry.treatments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              {isMonitoring ? 'המלצות:' : 'טיפולים:'}
                            </span>
                            {entry.treatments.map((treatment) => (
                              <div
                                key={treatment.id}
                                className="bg-muted/50 rounded-md p-2 text-xs space-y-1"
                              >
                                <div className="flex justify-between">
                                  <span>
                                    {treatment.action_type_id ? (ACTION_TYPE_LABELS[treatment.action_type_id as ActionTypeName] || treatment.action_type_id) : 'סוג פעולה לא ידוע'}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {TREATMENT_STATUS_LABELS[treatment.status] || treatment.status}
                                  </Badge>
                                </div>
                                {treatment.material && (
                                  <div className="text-muted-foreground">
                                    חומר: {treatment.material.name}
                                    {treatment.dosage && treatment.unit_type && (
                                      <> - {treatment.dosage} {treatment.unit_type.name}</>
                                    )}
                                  </div>
                                )}
                                {treatment.notes && (
                                  <div className="text-muted-foreground">
                                    הערות: {treatment.notes}
                                  </div>
                                )}
                                {treatment.action_time && (
                                  <div className="text-muted-foreground">
                                    זמן ביצוע:{' '}
                                    {new Date(treatment.action_time).toLocaleString('he-IL')}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {entries.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                אין נתונים נוספים לדוח זה
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
