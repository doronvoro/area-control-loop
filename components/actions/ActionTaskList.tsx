'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TaskCard, ActionTask, CompletedTaskData } from './TaskCard';
import { StandaloneActionForm, StandaloneActionData } from './StandaloneActionForm';
import { ReportDetailSheet } from '@/components/reports/ReportDetailSheet';
import {
  Zap,
  Filter,
  ClipboardCheck,
  Plus,
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  RefreshCw,
  X,
  Loader2,
  User,
  MapPin,
  Check,
} from 'lucide-react';

interface Area {
  id: string;
  name: string;
}

interface Worker {
  id: string;
  name: string;
}

interface FormData {
  isAdmin: boolean;
  customers: any[];
  currentWorkerId: string | null;
  initialWorkers: Worker[];
  findings: any[];
  unitTypes: any[];
}

export function ActionTaskList() {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>(searchParams.get('areaId') || 'all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savedReportAreaId, setSavedReportAreaId] = useState<string | null>(null);
  const [showReportDetail, setShowReportDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showStandaloneForm, setShowStandaloneForm] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<CompletedTaskData[]>([]);
  const [standaloneActions, setStandaloneActions] = useState<StandaloneActionData[]>([]);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [subAreas, setSubAreas] = useState<any[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = selectedAreaId !== 'all' ? `?areaId=${selectedAreaId}` : '';
      const res = await fetch(`/api/action-tasks${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch tasks');
      }
      const data = await res.json();
      setTasks(data.tasks || []);
      // Only update the full areas list when fetching all (no filter)
      if (selectedAreaId === 'all') {
        setAreas(data.areas || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת משימות');
    } finally {
      setLoading(false);
    }
  }, [selectedAreaId]);

  // Fetch form reference data (for standalone form + task edit)
  const fetchFormData = useCallback(async () => {
    try {
      const [formRes, matRes] = await Promise.all([
        fetch('/api/actions/form-data'),
        fetch('/api/materials'),
      ]);
      if (formRes.ok) {
        const data = await formRes.json();
        setFormData(data);
      }
      if (matRes.ok) {
        const data = await matRes.json();
        setMaterials(data || []);
      }
    } catch {
      // Non-critical — standalone form won't work but tasks still do
    }
  }, []);

  // Fetch sub-areas when area changes (for standalone form)
  useEffect(() => {
    if (selectedAreaId === 'all' || !selectedAreaId) {
      setSubAreas([]);
      return;
    }

    const fetchSubAreas = async () => {
      try {
        const res = await fetch(`/api/sub-areas?areaId=${selectedAreaId}`);
        if (res.ok) {
          const data = await res.json();
          setSubAreas(data || []);
        }
      } catch {
        // Non-critical
      }
    };

    fetchSubAreas();
  }, [selectedAreaId]);

  useEffect(() => {
    fetchTasks();
    fetchFormData();
  }, [fetchTasks, fetchFormData]);

  // Clear success banner and report detail state
  const clearSuccessBanner = () => {
    setSuccess(null);
    setSavedReportAreaId(null);
  };

  // Dismiss success banner when area or worker changes
  useEffect(() => {
    if (success) clearSuccessBanner();
  }, [selectedAreaId, selectedWorkerId]);

  // Group tasks by area
  const tasksByArea = tasks.reduce<Record<string, ActionTask[]>>((acc, task) => {
    const key = task.area_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  // Handle marking a task as complete (add to batch)
  const handleTaskComplete = (data: CompletedTaskData) => {
    // Ensure area_id is set (fallback: look up from tasks array before removal)
    const areaId = data.area_id || tasks.find(
      (t) => t.monitoring_treatment_id === data.monitoring_treatment_id
    )?.area_id || '';
    const enrichedData = { ...data, area_id: areaId };

    setCompletedTasks((prev) => [...prev, enrichedData]);
    // Remove from visible tasks
    setTasks((prev) =>
      prev.filter((t) => t.monitoring_treatment_id !== data.monitoring_treatment_id)
    );
    clearSuccessBanner();
  };

  // Handle adding a standalone action (add to batch)
  const handleStandaloneSubmit = (data: StandaloneActionData) => {
    setStandaloneActions((prev) => [...prev, data]);
    setShowStandaloneForm(false);
    clearSuccessBanner();
  };

  // Whether worker selection is required (customer owner or admin, not a worker)
  const needsWorkerSelection = formData != null && !formData.currentWorkerId;

  // Submit all pending actions
  const handleSubmitAll = async () => {
    if (completedTasks.length === 0 && standaloneActions.length === 0) return;

    if (needsWorkerSelection && !selectedWorkerId) {
      setError('יש לבחור עובד מבצע לפני שמירה');
      return;
    }

    // Group completed tasks by area_id (each task carries its own area_id)
    const tasksByAreaId: Record<string, CompletedTaskData[]> = {};
    for (const ct of completedTasks) {
      const id = ct.area_id;
      if (!tasksByAreaId[id]) tasksByAreaId[id] = [];
      tasksByAreaId[id].push(ct);
    }

    // Determine area_id for standalone actions
    const standaloneAreaId = selectedAreaId !== 'all' ? selectedAreaId : '';

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Get unique area IDs from completed tasks
      const areaIdsFromTasks = Object.keys(tasksByAreaId);
      // If standalone actions exist, they use the selected area
      if (standaloneActions.length > 0 && standaloneAreaId) {
        if (!areaIdsFromTasks.includes(standaloneAreaId)) {
          areaIdsFromTasks.push(standaloneAreaId);
        }
      }

      let totalCompleted = 0;
      const reportNumbers: number[] = [];
      let lastReportAreaId: string | null = null;

      // Submit per area_id (the API expects a single area_id per request)
      for (const aId of areaIdsFromTasks) {
        const tasksForArea = tasksByAreaId[aId] || [];
        const standaloneForArea = aId === standaloneAreaId ? standaloneActions : [];

        if (tasksForArea.length === 0 && standaloneForArea.length === 0) continue;

        const res = await fetch('/api/action-tasks/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            area_id: aId,
            worker_id: selectedWorkerId || undefined,
            completed_tasks: tasksForArea,
            standalone_actions: standaloneForArea,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to submit actions');
        }

        totalCompleted += data.results?.length || 0;
        if (data.report_number) {
          reportNumbers.push(data.report_number);
        }
        if (data.report_area_id) {
          lastReportAreaId = data.report_area_id;
        }
      }

      const reportLabel = reportNumbers.length > 0
        ? ` (דוח מס׳ ${reportNumbers.join(', ')})`
        : '';
      setSuccess(`דוח פעולה נשמר בהצלחה — ${totalCompleted} פעולות${reportLabel}`);
      setSavedReportAreaId(lastReportAreaId);
      setCompletedTasks([]);
      setStandaloneActions([]);

      // Refresh tasks
      await fetchTasks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת פעולות');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel all pending
  const handleCancelAll = () => {
    setCompletedTasks([]);
    setStandaloneActions([]);
    fetchTasks(); // Restore removed tasks
  };

  const pendingCount = completedTasks.length + standaloneActions.length;
  const areaList = areas.length > 0 ? areas : Object.keys(tasksByArea).map((id) => ({
    id,
    name: tasksByArea[id][0]?.area_name || id,
  }));

  const workers = formData?.initialWorkers || [];

  // Loading state with hero
  if (loading && tasks.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="actions-form-container">
          <div className="actions-hero px-6 py-8 md:px-8 md:py-10">
            <div className="hero-pattern" />
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  משימות פעולה
                </h2>
              </div>
            </div>
          </div>
          <div className="actions-loading">
            <div className="actions-loading-spinner" />
            <span className="text-sm text-muted-foreground font-medium">טוען משימות...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="actions-form-container">
        {/* Hero Header */}
        <div className="actions-hero px-6 py-8 md:px-8 md:py-10">
          <div className="hero-pattern" />
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                משימות פעולה
              </h2>
            </div>
            {tasks.length > 0 && (
              <div className="flex justify-center mt-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white/90 text-xs font-semibold">
                  {tasks.length} משימות ממתינות
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="p-4 md:p-6 space-y-4">
          {/* Worker Section (only for admin/customer who needs to pick a worker) */}
          {needsWorkerSelection && workers.length > 0 && (
            <div className="actions-section section-worker px-5 py-3.5">
              <div className="actions-section-header-inline">
                <div className="actions-section-icon section-icon-worker shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-base shrink-0">מבצע</h3>
                <div className="flex items-center shrink-0">
                  <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
                    <SelectTrigger className="h-11 w-56 actions-select-trigger">
                      <SelectValue placeholder="בחר" />
                    </SelectTrigger>
                    <SelectContent>
                      {workers.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedWorkerId && (
                    <span className="actions-field-check"><Check className="h-2.5 w-2.5" /></span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Area Section */}
          <div className="actions-section section-area-select px-5 py-3.5">
            <div className="actions-section-header-inline">
              <div className="actions-section-icon section-icon-area-select shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-base shrink-0">שטח</h3>
              <div className="flex items-center shrink-0">
                <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
                  <SelectTrigger className="h-11 w-56 actions-select-trigger">
                    <SelectValue placeholder="כל השטחים" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל השטחים</SelectItem>
                    {areaList.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAreaId !== 'all' && (
                  <span className="actions-field-check"><Check className="h-2.5 w-2.5" /></span>
                )}
              </div>
              <button
                className="action-btn-edit mr-auto"
                onClick={fetchTasks}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'טוען...' : 'רענן'}
              </button>
            </div>
          </div>

          {/* Error/Success messages */}
          {error && (
            <div className="actions-error-banner flex items-center gap-3 p-4">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm font-medium flex-1">{error}</p>
              <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 transition-opacity">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {success && (
            <div className="actions-success-banner flex items-center gap-3 p-4">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm font-bold flex-1">{success}</p>
              {savedReportAreaId && (
                <button
                  className="flex-shrink-0 text-sm font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
                  onClick={() => setShowReportDetail(true)}
                >
                  צפה בדוח
                </button>
              )}
              <button onClick={() => setSuccess(null)} className="opacity-60 hover:opacity-100 transition-opacity">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Report Detail Sheet */}
          <ReportDetailSheet
            reportId={savedReportAreaId}
            open={showReportDetail}
            onOpenChange={setShowReportDetail}
          />

          {/* Pending actions bar */}
          {pendingCount > 0 && (
            <div className="pending-bar p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="pending-count-badge">{pendingCount}</div>
                  <div>
                    <span className="text-sm font-semibold">
                      פעולות מוכנות לשמירה
                    </span>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {completedTasks.length > 0 && (
                        <span>{completedTasks.length} מניטור</span>
                      )}
                      {completedTasks.length > 0 && standaloneActions.length > 0 && (
                        <span> / </span>
                      )}
                      {standaloneActions.length > 0 && (
                        <span>{standaloneActions.length} עצמאיות</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="actions-submit px-5 py-2.5 text-sm"
                    onClick={handleSubmitAll}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        שומר...
                      </span>
                    ) : (
                      'שמור דוח פעולה'
                    )}
                  </button>
                  <button
                    className="action-btn-edit"
                    onClick={handleCancelAll}
                    disabled={submitting}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Task lists grouped by area */}
          {tasks.length === 0 && pendingCount === 0 ? (
            <div className="actions-empty-state">
              <div className="actions-empty-icon">
                <PackageCheck className="h-6 w-6" />
              </div>
              <div className="text-base font-semibold text-foreground">אין משימות ממתינות</div>
              <div className="text-sm text-muted-foreground max-w-sm">
                כל המלצות הניטור טופלו, או שאין דוחות ניטור פעילים
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(tasksByArea).map(([areaId, areaTasks]) => (
                <div key={areaId} className="actions-section section-tasks p-4">
                  <div className="area-group-header mb-3">
                    <div className="actions-section-icon section-icon-tasks">
                      <ClipboardCheck className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">
                      {areaTasks[0]?.area_name || 'שטח'}
                    </h3>
                    <span className="area-group-badge">
                      {areaTasks.length} משימות
                    </span>
                  </div>

                  <div className="space-y-3">
                    {areaTasks.map((task) => (
                      <TaskCard
                        key={task.monitoring_treatment_id}
                        task={task}
                        onComplete={handleTaskComplete}
                        disabled={submitting}
                        materials={materials}
                        unitTypes={formData?.unitTypes || []}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Standalone action */}
          {showStandaloneForm && selectedAreaId !== 'all' && formData ? (
            <StandaloneActionForm
              areaId={selectedAreaId}
              subAreas={subAreas}
              findings={formData.findings || []}
              unitTypes={formData.unitTypes || []}
              onSubmit={handleStandaloneSubmit}
              onCancel={() => setShowStandaloneForm(false)}
              disabled={submitting}
            />
          ) : null}

          {/* Add standalone action button */}
          {!showStandaloneForm && (
            <button
              className="actions-add-button w-full justify-center py-3"
              onClick={() => {
                if (selectedAreaId === 'all') {
                  setError('יש לבחור שטח ספציפי כדי להוסיף פעולה עצמאית');
                  return;
                }
                setShowStandaloneForm(true);
              }}
            >
              <Plus className="h-4 w-4" />
              הוסף פעולה שאינה קשורה לניטור
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
