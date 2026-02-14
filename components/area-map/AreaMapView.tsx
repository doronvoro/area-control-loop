'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { AreaMapCard, flattenTree } from './AreaMapCard';
import { AreaMapSubmitBar } from './AreaMapSubmitBar';
import type {
  AreaStatusData,
  SubAreaTreeNode,
  ActionTask,
  CompletedTaskData,
  AreaMapFormData,
  RefItem,
} from './types';

export function AreaMapView() {
  // Data state
  const [areaStatuses, setAreaStatuses] = useState<AreaStatusData[]>([]);
  const [allTasks, setAllTasks] = useState<ActionTask[]>([]);
  const [subAreaTrees, setSubAreaTrees] = useState<Record<string, SubAreaTreeNode[]>>({});
  const [formData, setFormData] = useState<AreaMapFormData | null>(null);
  const [materials, setMaterials] = useState<RefItem[]>([]);

  // UI state
  const [expandedSubAreas, setExpandedSubAreas] = useState<Set<string>>(new Set());
  const [completedTasks, setCompletedTasks] = useState<CompletedTaskData[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');

  // Loading / feedback
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Group tasks by sub_area.id
  const tasksBySubAreaId = useMemo(() => {
    return allTasks.reduce<Record<string, ActionTask[]>>((acc, task) => {
      const key = task.sub_area.id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});
  }, [allTasks]);

  // Flatten sub-area trees per area (with task counts)
  const flatSubAreasByArea = useMemo(() => {
    const result: Record<string, ReturnType<typeof flattenTree>> = {};
    for (const [areaId, tree] of Object.entries(subAreaTrees)) {
      result[areaId] = flattenTree(tree, 0, tasksBySubAreaId);
    }
    return result;
  }, [subAreaTrees, tasksBySubAreaId]);

  // Fetch all initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, tasksRes, formRes, matRes] = await Promise.all([
        fetch('/api/areas/status'),
        fetch('/api/action-tasks'),
        fetch('/api/actions/form-data'),
        fetch('/api/materials'),
      ]);

      if (!statusRes.ok) throw new Error('שגיאה בטעינת סטטוס שטחים');
      if (!tasksRes.ok) throw new Error('שגיאה בטעינת משימות');

      const [statusData, tasksData] = await Promise.all([
        statusRes.json(),
        tasksRes.json(),
      ]);

      setAreaStatuses(statusData.areas || []);
      setAllTasks(tasksData.tasks || []);

      if (formRes.ok) {
        const fd = await formRes.json();
        setFormData(fd);
      }
      if (matRes.ok) {
        const md = await matRes.json();
        setMaterials(md || []);
      }

      // Fetch sub-area trees for each area
      const areas: AreaStatusData[] = statusData.areas || [];
      if (areas.length > 0) {
        const treeResults = await Promise.all(
          areas.map(async (area) => {
            try {
              const res = await fetch(`/api/sub-areas/tree?areaId=${area.id}`);
              if (res.ok) {
                const data = await res.json();
                return { areaId: area.id, tree: data || [] };
              }
            } catch {
              // Non-critical
            }
            return { areaId: area.id, tree: [] };
          }),
        );

        const trees: Record<string, SubAreaTreeNode[]> = {};
        for (const r of treeResults) {
          trees[r.areaId] = r.tree;
        }
        setSubAreaTrees(trees);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle sub-area expand/collapse
  const toggleSubArea = (subAreaId: string) => {
    setExpandedSubAreas((prev) => {
      const next = new Set(prev);
      if (next.has(subAreaId)) {
        next.delete(subAreaId);
      } else {
        next.add(subAreaId);
      }
      return next;
    });
  };

  // Handle task completion (add to batch)
  const handleTaskComplete = (data: CompletedTaskData) => {
    const areaId = data.area_id || allTasks.find(
      (t) => t.monitoring_treatment_id === data.monitoring_treatment_id,
    )?.area_id || '';
    const enrichedData = { ...data, area_id: areaId };

    setCompletedTasks((prev) => [...prev, enrichedData]);
    setAllTasks((prev) =>
      prev.filter((t) => t.monitoring_treatment_id !== data.monitoring_treatment_id),
    );
    setSuccess(null);
  };

  // Whether worker selection is required
  const needsWorkerSelection = formData != null && !formData.currentWorkerId;
  const workers = formData?.initialWorkers || [];

  // Submit all completed tasks
  const handleSubmitAll = async () => {
    if (completedTasks.length === 0) return;

    if (needsWorkerSelection && !selectedWorkerId) {
      setError('יש לבחור עובד מבצע לפני שמירה');
      return;
    }

    // Group by area_id
    const tasksByAreaId: Record<string, CompletedTaskData[]> = {};
    for (const ct of completedTasks) {
      const id = ct.area_id;
      if (!tasksByAreaId[id]) tasksByAreaId[id] = [];
      tasksByAreaId[id].push(ct);
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      let totalCompleted = 0;

      for (const aId of Object.keys(tasksByAreaId)) {
        const tasksForArea = tasksByAreaId[aId];
        if (tasksForArea.length === 0) continue;

        const res = await fetch('/api/action-tasks/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            area_id: aId,
            worker_id: selectedWorkerId || undefined,
            completed_tasks: tasksForArea,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'שגיאה בשמירת פעולות');
        }
        totalCompleted += data.results?.length || 0;
      }

      setSuccess(`${totalCompleted} פעולות נשמרו בהצלחה`);
      setCompletedTasks([]);
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת פעולות');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel all pending
  const handleCancelAll = () => {
    setCompletedTasks([]);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary me-2" />
        <span className="text-muted-foreground">טוען מפת שטחים...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center gap-3 flex-wrap">
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

        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          {loading ? 'טוען...' : 'רענן'}
        </Button>
      </div>

      {/* Error / Success */}
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

      {/* Area cards */}
      {areaStatuses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">אין שטחים להצגה</p>
          <p className="text-sm text-muted-foreground mt-1">
            לא נמצאו שטחים משויכים לחשבון שלך
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {areaStatuses.map((area) => (
            <AreaMapCard
              key={area.id}
              area={area}
              subAreas={flatSubAreasByArea[area.id] || []}
              tasksBySubAreaId={tasksBySubAreaId}
              expandedSubAreas={expandedSubAreas}
              onToggleSubArea={toggleSubArea}
              onTaskComplete={handleTaskComplete}
              disabled={submitting}
              actionTypes={formData?.actionTypes || []}
              materials={materials}
              unitTypes={formData?.unitTypes || []}
            />
          ))}
        </div>
      )}

      {/* Submit bar */}
      {completedTasks.length > 0 && (
        <AreaMapSubmitBar
          count={completedTasks.length}
          onSubmit={handleSubmitAll}
          onCancel={handleCancelAll}
          submitting={submitting}
        />
      )}
    </div>
  );
}
