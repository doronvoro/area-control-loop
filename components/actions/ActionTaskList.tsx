'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TaskCard, ActionTask, CompletedTaskData } from './TaskCard';
import { StandaloneActionForm, StandaloneActionData } from './StandaloneActionForm';

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
  actionTypes: any[];
  unitTypes: any[];
}

export function ActionTaskList() {
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
    setSuccess(null);
  };

  // Handle adding a standalone action (add to batch)
  const handleStandaloneSubmit = (data: StandaloneActionData) => {
    setStandaloneActions((prev) => [...prev, data]);
    setShowStandaloneForm(false);
    setSuccess(null);
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
      }

      setSuccess(`${totalCompleted} פעולות נשמרו בהצלחה`);
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

  return (
    <div className="space-y-6">
      {/* Header with area filter */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
            <SelectTrigger className="w-[200px]">
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

          {needsWorkerSelection && workers.length > 0 && (
            <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="בחר עובד מבצע" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={fetchTasks}
            disabled={loading}
          >
            {loading ? 'טוען...' : 'רענן'}
          </Button>
        </div>

        {tasks.length > 0 && (
          <Badge variant="secondary" className="text-sm">
            {tasks.length} משימות ממתינות
          </Badge>
        )}
      </div>

      {/* Error/Success messages */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Pending actions bar */}
      {pendingCount > 0 && (
        <Card className="border-primary/50 bg-primary/5 py-3">
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge>{pendingCount}</Badge>
              <span className="text-sm font-medium">
                פעולות מוכנות לשמירה
                {completedTasks.length > 0 && (
                  <span className="text-muted-foreground">
                    {' '}({completedTasks.length} מניטור)
                  </span>
                )}
                {standaloneActions.length > 0 && (
                  <span className="text-muted-foreground">
                    {' '}({standaloneActions.length} עצמאיות)
                  </span>
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSubmitAll}
                disabled={submitting}
              >
                {submitting ? 'שומר...' : 'שמור הכל'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelAll}
                disabled={submitting}
              >
                ביטול
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task lists grouped by area */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">טוען משימות...</div>
      ) : tasks.length === 0 && pendingCount === 0 ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground text-lg mb-2">אין משימות ממתינות</div>
          <div className="text-sm text-muted-foreground">
            כל המלצות הניטור טופלו, או שאין דוחות ניטור פעילים
          </div>
        </div>
      ) : (
        Object.entries(tasksByArea).map(([areaId, areaTasks]) => (
          <div key={areaId} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {areaTasks[0]?.area_name || 'שטח'}
              </h3>
              <Badge variant="outline">{areaTasks.length} משימות</Badge>
            </div>

            <div className="space-y-2">
              {areaTasks.map((task) => (
                <TaskCard
                  key={task.monitoring_treatment_id}
                  task={task}
                  onComplete={handleTaskComplete}
                  disabled={submitting}
                  actionTypes={formData?.actionTypes || []}
                  materials={materials}
                  unitTypes={formData?.unitTypes || []}
                />
              ))}
            </div>

            <Separator />
          </div>
        ))
      )}

      {/* Standalone action */}
      {showStandaloneForm && selectedAreaId !== 'all' && formData ? (
        <StandaloneActionForm
          areaId={selectedAreaId}
          subAreas={subAreas}
          findings={formData.findings || []}
          actionTypes={formData.actionTypes || []}
          unitTypes={formData.unitTypes || []}
          onSubmit={handleStandaloneSubmit}
          onCancel={() => setShowStandaloneForm(false)}
          disabled={submitting}
        />
      ) : null}

      {/* Add standalone action button */}
      {!showStandaloneForm && (
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => {
            if (selectedAreaId === 'all') {
              setError('יש לבחור שטח ספציפי כדי להוסיף פעולה עצמאית');
              return;
            }
            setShowStandaloneForm(true);
          }}
        >
          + הוסף פעולה שאינה קשורה לניטור
        </Button>
      )}
    </div>
  );
}
