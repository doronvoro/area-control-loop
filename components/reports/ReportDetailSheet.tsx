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
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Calendar,
  MapPin,
  User,
  FileText,
  Clock,
  FlaskConical,
  Bug,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Beaker,
  ClipboardList,
} from 'lucide-react';
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

function getStatusColor(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
    case 'in_progress':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
    case 'pending':
      return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case 'in_progress':
      return <Timer className="h-3.5 w-3.5" />;
    default:
      return <Clock className="h-3.5 w-3.5" />;
  }
}

function getSeverityStyle(severity: ReportSeverity) {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800';
    case 'low':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600';
  }
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
      <SheetContent side="left" className="w-full sm:max-w-xl overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
          <SheetHeader className="p-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <SheetTitle className="text-xl font-bold tracking-tight">
                  {report ? `דוח מס׳ ${report.report_number}` : 'פרטי דוח'}
                </SheetTitle>
                {report && (
                  <SheetDescription className="mt-1 text-sm">
                    {report.area_type?.display_name} - {report.area?.name}
                  </SheetDescription>
                )}
              </div>
              {report && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusColor(report.status)}`}
                >
                  {getStatusIcon(report.status)}
                  {STATUS_LABELS[report.status] || report.status}
                </span>
              )}
            </div>
          </SheetHeader>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">טוען נתונים...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-destructive">
            <AlertTriangle className="h-8 w-8" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {report && !loading && (
          <div className="flex flex-col gap-0">
            {/* Report Meta Grid */}
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <MetaItem
                  icon={<Calendar className="h-4 w-4" />}
                  label="נוצר"
                  value={formatDate(report.created_at)}
                />
                <MetaItem
                  icon={<Clock className="h-4 w-4" />}
                  label="מועד"
                  value={report.report_date ? formatDate(report.report_date) : '-'}
                />
                <MetaItem
                  icon={<MapPin className="h-4 w-4" />}
                  label="שטח"
                  value={report.area?.name || '-'}
                />
                <MetaItem
                  icon={<User className="h-4 w-4" />}
                  label="עובד"
                  value={report.worker?.name || '-'}
                />
                <MetaItem
                  icon={<ClipboardList className="h-4 w-4" />}
                  label="סוג"
                  value={report.area_type?.display_name || '-'}
                />
              </div>

              {report.description && (
                <>
                  <Separator className="my-4" />
                  <div className="flex gap-2 items-start">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-medium text-muted-foreground block mb-1">תיאור</span>
                      <p className="text-sm leading-relaxed">{report.description}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <Separator />

            {/* Report Entries */}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                {isMonitoring ? (
                  <Bug className="h-4.5 w-4.5 text-muted-foreground" />
                ) : (
                  <FlaskConical className="h-4.5 w-4.5 text-muted-foreground" />
                )}
                <h3 className="font-semibold text-sm">
                  {isMonitoring ? 'ממצאים' : 'פעולות'}
                </h3>
                {entries.length > 0 && (
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {entries.length}
                  </span>
                )}
              </div>

              {entries.length > 0 ? (
                <div className="space-y-3">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border bg-card shadow-sm overflow-hidden"
                    >
                      {/* Entry Header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {entry.sub_area?.display || entry.sub_area?.name || 'כל השטח'}
                          </span>
                        </div>
                        {entry.severity && (
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getSeverityStyle(entry.severity)}`}
                          >
                            {SEVERITY_LABELS[entry.severity as ReportSeverity] || entry.severity}
                          </span>
                        )}
                      </div>

                      {/* Entry Body */}
                      <div className="px-4 py-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <Bug className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <span className="text-xs text-muted-foreground">ממצא</span>
                            <p className="text-sm font-medium">{entry.finding?.name || '-'}</p>
                          </div>
                        </div>
                        {entry.finding?.description && (
                          <p className="text-xs text-muted-foreground pr-5">
                            {entry.finding.description}
                          </p>
                        )}

                        {/* Treatments */}
                        {entry.treatments && entry.treatments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-dashed">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Beaker className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-semibold text-muted-foreground">
                                {isMonitoring ? 'המלצות' : 'טיפולים'}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {entry.treatments.map((treatment) => (
                                <TreatmentCard key={treatment.id} treatment={treatment} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">אין נתונים נוספים לדוח זה</p>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-[11px] font-medium text-muted-foreground block leading-tight">
          {label}
        </span>
        <span className="text-sm font-medium block truncate leading-snug mt-0.5">
          {value}
        </span>
      </div>
    </div>
  );
}

function TreatmentCard({ treatment }: { treatment: Treatment }) {
  const statusColor =
    treatment.status === 'completed'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
      : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700';

  return (
    <div className="rounded-md bg-muted/30 border border-border/50 p-2.5 text-xs space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {treatment.action_type_id
            ? ACTION_TYPE_LABELS[treatment.action_type_id as ActionTypeName] || treatment.action_type_id
            : 'סוג פעולה לא ידוע'}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusColor}`}
        >
          {treatment.status === 'completed' ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
          {TREATMENT_STATUS_LABELS[treatment.status] || treatment.status}
        </span>
      </div>
      {treatment.material && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <FlaskConical className="h-3 w-3 shrink-0" />
          <span>
            {treatment.material.name}
            {treatment.dosage && treatment.unit_type && (
              <span className="font-medium text-foreground">
                {' '}- {treatment.dosage} {treatment.unit_type.name}
              </span>
            )}
          </span>
        </div>
      )}
      {treatment.notes && (
        <p className="text-muted-foreground pr-0.5">{treatment.notes}</p>
      )}
      {treatment.action_time && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Timer className="h-3 w-3 shrink-0" />
          <span>{new Date(treatment.action_time).toLocaleString('he-IL')}</span>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}
