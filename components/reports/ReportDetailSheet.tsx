'use client';

import { useState, useEffect } from 'react';
import { ACTION_TYPE_LABELS, ActionTypeName } from '@/types/database';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Calendar,
  MapPin,
  User,
  Clock,
  FlaskConical,
  Bug,
  AlertTriangle,
  CheckCircle2,
  Timer,
  ClipboardList,
  Trash2,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { SEVERITY_LABELS, ReportSeverity } from '@/types/database';
import { STATUS_LABELS, TREATMENT_STATUS_LABELS } from '@/lib/reports/labels';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { showToast } from '@/lib/toast';

interface ReportDetailSheetProps {
  reportId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  reportIds?: string[];
  onNavigate?: (reportId: string) => void;
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
  linked_action?: { area_report_id: string } | null;
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
  hasLinkedActions: boolean;
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
  onDeleted,
  reportIds,
  onNavigate,
}: ReportDetailSheetProps) {
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Internal navigation override (for linked report navigation within the sheet)
  const [navigatedReportId, setNavigatedReportId] = useState<string | null>(null);

  // Reset internal navigation when the prop changes or sheet closes
  useEffect(() => {
    setNavigatedReportId(null);
  }, [reportId, open]);

  const activeReportId = navigatedReportId || reportId;

  useEffect(() => {
    if (!activeReportId || !open) {
      setReport(null);
      return;
    }

    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/reports/${activeReportId}`);
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
  }, [activeReportId, open]);

  const canDelete = report
    ? report.area_type_id === 'action' || !report.hasLinkedActions
    : false;

  async function handleDelete() {
    if (!reportId) return;
    try {
      setDeleting(true);
      const response = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה במחיקת הדוח');
      }
      showToast.success('הדוח נמחק בהצלחה');
      onOpenChange(false);
      onDeleted?.();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה במחיקת הדוח');
    } finally {
      setDeleting(false);
    }
  }

  // Navigation between reports
  const currentIndex = reportIds && activeReportId ? reportIds.indexOf(activeReportId) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = reportIds ? currentIndex < reportIds.length - 1 && currentIndex >= 0 : false;

  function goToPrev() {
    if (hasPrev && reportIds && onNavigate) {
      const prevId = reportIds[currentIndex - 1];
      onNavigate(prevId);
      setNavigatedReportId(null);
    }
  }

  function goToNext() {
    if (hasNext && reportIds && onNavigate) {
      const nextId = reportIds[currentIndex + 1];
      onNavigate(nextId);
      setNavigatedReportId(null);
    }
  }

  const isMonitoring = report?.area_type_id === 'monitoring';
  const entries = isMonitoring
    ? report?.monitoringEntries || []
    : report?.actionEntries || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent dir="rtl" side="left" className="w-full sm:max-w-xl overflow-y-auto p-0" showCloseButton={false}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
          <SheetHeader className="p-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SheetTitle className="text-xl font-bold tracking-tight">
                  {report ? `דוח מס׳ ${report.report_number}` : 'פרטי דוח'}
                </SheetTitle>
                {report && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusColor(report.status)}`}
                  >
                    {getStatusIcon(report.status)}
                    {STATUS_LABELS[report.status] || report.status}
                  </span>
                )}
              </div>
              {reportIds && reportIds.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={goToNext}
                    disabled={!hasNext}
                    className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={goToPrev}
                    disabled={!hasPrev}
                    className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              )}
              <SheetClose className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <X className="h-4 w-4" />
                <span className="sr-only">סגור</span>
              </SheetClose>
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
                  icon={<MapPin className="h-4 w-4 text-emerald-600" />}
                  label="שטח"
                  value={report.area?.name || '-'}
                />
                <MetaItem
                  icon={<ClipboardList className="h-4 w-4 text-violet-600" />}
                  label="סוג"
                  value={report.area_type?.display_name || '-'}
                />
                <MetaItem
                  icon={<User className="h-4 w-4 text-blue-600" />}
                  label="עובד"
                  value={report.worker?.name || '-'}
                />
                <MetaItem
                  icon={<Clock className="h-4 w-4 text-amber-600" />}
                  label="מועד"
                  value={report.report_date ? formatDate(report.report_date) : '-'}
                />
                <MetaItem
                  icon={<Calendar className="h-4 w-4 text-rose-600" />}
                  label="נוצר"
                  value={formatDate(report.created_at)}
                />
              </div>

            </div>

            <Separator />

            {/* Report Entries */}
            <div className="p-5">
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
                        <div className="flex items-center gap-2">
                          <Bug className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium">{entry.finding?.name || '-'}</span>
                        </div>
                        {entry.finding?.description && entry.finding.description !== entry.finding.name && (
                          <p className="text-xs text-muted-foreground pr-5">
                            {entry.finding.description}
                          </p>
                        )}

                        {/* Treatments */}
                        {entry.treatments && entry.treatments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-dashed">
                            <div className="space-y-2">
                              {entry.treatments.map((treatment) => (
                                <TreatmentCard
                                  key={treatment.id}
                                  treatment={treatment}
                                  linkedActionReportId={entry.linked_action?.area_report_id}
                                  onNavigate={setNavigatedReportId}
                                />
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

            {/* Delete Button */}
            <Separator />
            <div className="p-5">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    disabled={!canDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                    {canDelete ? 'מחק דוח' : 'לא ניתן למחוק - מקושר לדוח פעולה'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>מחיקת דוח</AlertDialogTitle>
                    <AlertDialogDescription>
                      האם למחוק את דוח מס׳ {report.report_number}? פעולה זו אינה ניתנת לביטול.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'מחק'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
    <div dir="rtl" className="flex flex-col gap-1 rounded-xl bg-white shadow-sm border border-border/50 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <span className="shrink-0">{icon}</span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <span className="text-base font-semibold block truncate w-full">
        {value}
      </span>
    </div>
  );
}

function TreatmentCard({ treatment, linkedActionReportId, onNavigate }: { treatment: Treatment; linkedActionReportId?: string; onNavigate?: (reportId: string) => void }) {
  const statusColor =
    treatment.status === 'completed'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
      : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700';

  const statusBadge = (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusColor} ${linkedActionReportId ? 'cursor-pointer hover:opacity-80' : ''}`}
    >
      {treatment.status === 'completed' ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Clock className="h-3.5 w-3.5" />
      )}
      {TREATMENT_STATUS_LABELS[treatment.status] || treatment.status}
    </span>
  );

  return (
    <div className="rounded-lg bg-muted/30 border border-border/50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <FlaskConical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-semibold">
            {treatment.action_type_id
              ? ACTION_TYPE_LABELS[treatment.action_type_id as ActionTypeName] || treatment.action_type_id
              : 'סוג פעולה לא ידוע'}
          </span>
          {treatment.material && (
            <span className="text-muted-foreground">
              {treatment.material.name}
              {treatment.dosage && treatment.unit_type && (
                <span className="font-semibold text-foreground">
                  {' '}- {treatment.dosage} {treatment.unit_type.name}
                </span>
              )}
            </span>
          )}
        </div>
        {linkedActionReportId && onNavigate ? (
          <button type="button" onClick={() => onNavigate(linkedActionReportId)}>
            {statusBadge}
          </button>
        ) : (
          statusBadge
        )}
      </div>
      {treatment.notes && (
        <p className="text-xs text-muted-foreground pr-0.5">{treatment.notes}</p>
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
