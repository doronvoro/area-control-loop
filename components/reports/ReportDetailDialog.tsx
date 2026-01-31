'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{reportArea.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Report Header Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
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
                        <h4 className="text-sm font-medium text-muted-foreground">דוחות ניטור</h4>
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
                            {report.recommend_action_type && (
                              <div>
                                <span className="text-muted-foreground">פעולה מומלצת: </span>
                                {report.recommend_action_type.description ||
                                  report.recommend_action_type.name}
                              </div>
                            )}
                            {report.recommend_material && (
                              <div>
                                <span className="text-muted-foreground">חומר: </span>
                                {report.recommend_material.description ||
                                  report.recommend_material.name}
                                {report.recommend_dosage && (
                                  <span>
                                    {' '}
                                    - {report.recommend_dosage}{' '}
                                    {report.recommend_unit_type?.description ||
                                      report.recommend_unit_type?.name ||
                                      ''}
                                  </span>
                                )}
                              </div>
                            )}
                            {report.notes && (
                              <div>
                                <span className="text-muted-foreground">הערות: </span>
                                {report.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Reports */}
                    {data.actions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">דוחות פעולה</h4>
                        {data.actions.map((report) => (
                          <div
                            key={report.id}
                            className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">
                                {report.action_type?.description || report.action_type?.name || '-'}
                              </span>
                              <Badge variant="outline">{statusLabel(report.status)}</Badge>
                            </div>
                            {report.finding && (
                              <div>
                                <span className="text-muted-foreground">ממצא: </span>
                                {report.finding.description || report.finding.name}
                              </div>
                            )}
                            {report.notes && (
                              <div>
                                <span className="text-muted-foreground">הערות: </span>
                                {report.notes}
                              </div>
                            )}
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
