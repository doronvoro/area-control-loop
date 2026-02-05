'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface ActionTreatment {
  id: string;
  dosage?: number | null;
  status: string;
  notes?: string | null;
  action_time?: string | null;
  material?: { id: string; name: string; description?: string | null } | null;
  action_type?: { id: string; name: string; description?: string | null } | null;
  unit_type?: { id: string; name: string; description?: string | null } | null;
}

interface Treatment {
  id: string;
  dosage?: number | null;
  status: string;
  notes?: string | null;
  action_time?: string | null;
  material?: { id?: string; name: string; description?: string | null } | null;
  action_type?: { id?: string; name: string; description?: string | null } | null;
  unit_type?: { id?: string; name: string; description?: string | null } | null;
  action_treatment_id?: string | null;
  action_treatment?: ActionTreatment | null;
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

interface ReportDetailDialogProps {
  reportArea: ReportAreaData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDetailDialog({ reportArea, open, onOpenChange }: ReportDetailDialogProps) {
  if (!reportArea) return null;

  const statusLabel = (status: string) => {
    return status === 'pending'
      ? 'ממתין'
      : status === 'planned'
        ? 'מתוכנן'
        : status === 'in_progress'
          ? 'בביצוע'
          : status === 'completed'
            ? 'הושלם'
            : status;
  };

  // Group reports by sub_area
  const subAreaMap = new Map<
    string,
    { name: string; monitoring: SubAreaReport[]; actions: SubAreaReport[] }
  >();

  reportArea.monitoring_reports?.forEach((report) => {
    const subAreaId = report.sub_area?.id || 'unknown';
    const subAreaName = report.sub_area?.name || 'לא ידוע';
    if (!subAreaMap.has(subAreaId)) {
      subAreaMap.set(subAreaId, { name: subAreaName, monitoring: [], actions: [] });
    }
    subAreaMap.get(subAreaId)!.monitoring.push(report);
  });

  reportArea.action_reports?.forEach((report) => {
    const subAreaId = report.sub_area?.id || 'unknown';
    const subAreaName = report.sub_area?.name || 'לא ידוע';
    if (!subAreaMap.has(subAreaId)) {
      subAreaMap.set(subAreaId, { name: subAreaName, monitoring: [], actions: [] });
    }
    subAreaMap.get(subAreaId)!.actions.push(report);
  });

  const subAreas = Array.from(subAreaMap.entries());

  const renderTreatments = (treatments: Treatment[] | undefined, isAction: boolean = false) => {
    if (!treatments || treatments.length === 0) return null;

    return (
      <div className="mt-2 space-y-1">
        <span className="text-xs text-muted-foreground">טיפולים ({treatments.length}):</span>
        {treatments.map((treatment) => (
          <div
            key={treatment.id}
            className="bg-background/50 rounded p-2 text-xs border border-border/50"
          >
            <div className="flex justify-between items-center">
              <span>
                {treatment.action_type?.description || treatment.action_type?.name || 'לא צוין'}
              </span>
              <Badge variant="outline" className="text-xs">
                {statusLabel(treatment.status)}
              </Badge>
            </div>
            {treatment.material && (
              <div className="text-muted-foreground">
                {treatment.material.description || treatment.material.name}
                {treatment.dosage != null && (
                  <span>
                    {' '}
                    - {treatment.dosage} {treatment.unit_type?.description || treatment.unit_type?.name || ''}
                  </span>
                )}
              </div>
            )}
            {isAction && treatment.action_time && (
              <div className="text-muted-foreground">
                בוצע: {new Date(treatment.action_time).toLocaleDateString('he-IL')}
              </div>
            )}
            {treatment.notes && (
              <div className="text-muted-foreground">הערה: {treatment.notes}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render monitoring treatment with linked action treatment comparison
  const renderMonitoringTreatmentWithComparison = (treatment: Treatment) => {
    const actionTreatment = treatment.action_treatment;
    const hasAction = !!actionTreatment;

    // Check for differences
    const materialChanged = hasAction &&
      treatment.material?.id !== actionTreatment?.material?.id;
    const dosageChanged = hasAction &&
      treatment.dosage !== actionTreatment?.dosage;

    return (
      <div
        key={treatment.id}
        className={`bg-background/50 rounded p-2 text-xs border ${hasAction ? 'border-green-500/30' : 'border-border/50'}`}
      >
        {/* Recommended (Monitoring) */}
        <div className="mb-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-[10px]">המלצה:</span>
            <Badge variant="outline" className="text-xs">
              {statusLabel(treatment.status)}
            </Badge>
          </div>
          <div className="font-medium">
            {treatment.action_type?.description || treatment.action_type?.name || 'לא צוין'}
          </div>
          {treatment.material && (
            <div className="text-muted-foreground">
              {treatment.material.description || treatment.material.name}
              {treatment.dosage != null && (
                <span>
                  {' '}
                  - {treatment.dosage} {treatment.unit_type?.description || treatment.unit_type?.name || ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actual (Action) - if linked */}
        {hasAction && actionTreatment && (
          <>
            <Separator className="my-2" />
            <div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-[10px]">בוצע:</span>
                <Badge
                  variant={actionTreatment.status === 'completed' ? 'default' : 'outline'}
                  className="text-xs"
                >
                  {statusLabel(actionTreatment.status)}
                </Badge>
              </div>
              <div className="font-medium">
                {actionTreatment.action_type?.description || actionTreatment.action_type?.name || 'לא צוין'}
              </div>
              {actionTreatment.material && (
                <div className={materialChanged ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                  {actionTreatment.material.description || actionTreatment.material.name}
                  {materialChanged && <span className="text-[10px]"> (שונה)</span>}
                  {actionTreatment.dosage != null && (
                    <span className={dosageChanged ? 'text-amber-600' : ''}>
                      {' '}
                      - {actionTreatment.dosage} {actionTreatment.unit_type?.description || actionTreatment.unit_type?.name || ''}
                      {dosageChanged && <span className="text-[10px]"> (שונה)</span>}
                    </span>
                  )}
                </div>
              )}
              {actionTreatment.action_time && (
                <div className="text-muted-foreground">
                  בוצע: {new Date(actionTreatment.action_time).toLocaleDateString('he-IL')}
                </div>
              )}
              {actionTreatment.notes && (
                <div className="text-muted-foreground">הערה: {actionTreatment.notes}</div>
              )}
            </div>
          </>
        )}

        {/* Not yet executed */}
        {!hasAction && (
          <div className="text-amber-600 text-[10px] mt-1">
            טרם בוצע
          </div>
        )}
      </div>
    );
  };

  // Render monitoring treatments with comparison view
  const renderMonitoringTreatmentsWithComparison = (treatments: Treatment[] | undefined) => {
    if (!treatments || treatments.length === 0) return null;

    return (
      <div className="mt-2 space-y-2">
        <span className="text-xs text-muted-foreground">טיפולים מומלצים ({treatments.length}):</span>
        {treatments.map((treatment) => renderMonitoringTreatmentWithComparison(treatment))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {reportArea.report_number ? `דוח #${reportArea.report_number}` : reportArea.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Report Header Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">שם: </span>
              <span className="font-medium">{reportArea.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">שטח: </span>
              <span className="font-medium">{reportArea.area?.name || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">תאריך: </span>
              <span className="font-medium">
                {new Date(reportArea.created_at).toLocaleDateString('he-IL')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">סוג: </span>
              <Badge variant="secondary">
                {reportArea.type === 'monitoring' ? 'ניטור' : 'פעולה'}
              </Badge>
            </div>
            {reportArea.description && (
              <div className="col-span-2">
                <span className="text-muted-foreground">תיאור: </span>
                <span>{reportArea.description}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Sub Areas */}
          <div className="space-y-4">
            <h3 className="font-semibold">תתי-שטחים ({subAreas.length})</h3>

            {subAreas.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">אין תתי-שטחים</p>
            ) : (
              subAreas.map(([subAreaId, data]) => (
                <Card key={subAreaId}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">{data.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 space-y-3">
                    {/* Monitoring Reports */}
                    {data.monitoring.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">ממצאי ניטור</h4>
                        {data.monitoring.map((report) => (
                          <div
                            key={report.id}
                            className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">
                                {report.finding?.description || report.finding?.name || '-'}
                              </span>
                              <Badge variant="outline">{statusLabel(report.status)}</Badge>
                            </div>
                            {renderMonitoringTreatmentsWithComparison(report.treatments)}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Reports */}
                    {data.actions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">פעולות</h4>
                        {data.actions.map((report) => (
                          <div
                            key={report.id}
                            className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">
                                {report.finding?.description || report.finding?.name || '-'}
                              </span>
                              <Badge variant="outline">{statusLabel(report.status)}</Badge>
                            </div>
                            {renderTreatments(report.treatments, true)}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
