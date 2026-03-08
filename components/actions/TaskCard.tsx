'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ACTION_TYPE_OPTIONS, ACTION_TYPE_LABELS, ActionTypeName } from '@/types/database';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SEVERITY_LABELS, ReportSeverity } from '@/types/database';
import { SearchableMaterialSelect } from '@/components/monitoring/SearchableMaterialSelect';
import { Check, Edit3, Calendar, Sparkles, Loader2 } from 'lucide-react';

export interface ActionTask {
  monitoring_treatment_id: string;
  monitoring_report_id: string;
  area_id: string;
  area_name: string;
  sub_area: {
    id: string;
    name: string;
    display: string | null;
  };
  finding: {
    id: string;
    name: string;
    description: string | null;
  };
  severity: ReportSeverity | null;
  recommendation: {
    action_type_id: string | null;
    material: { id: string; name: string; description: string | null } | null;
    dosage: number | null;
    unit_type: { id: string; name: string; description: string | null } | null;
  };
  notes: string | null;
  monitoring_date: string;
  effective_crop_id: string | null;
}

export interface CompletedTaskData {
  monitoring_treatment_id: string;
  monitoring_report_id: string;
  area_id: string;
  as_recommended: boolean;
  material_id?: string;
  dosage?: number;
  unit_type_id?: string;
  action_type_id?: string;
  notes?: string;
}

interface RefItem {
  id: string;
  name: string;
}

interface TaskCardProps {
  task: ActionTask;
  onComplete: (data: CompletedTaskData) => void;
  disabled?: boolean;
  materials?: RefItem[];
  unitTypes?: RefItem[];
}

const severityClasses: Record<string, string> = {
  low: 'action-severity-low',
  medium: 'action-severity-medium',
  high: 'action-severity-high',
  critical: 'action-severity-critical',
};

const severityDotClasses: Record<string, string> = {
  low: 'action-severity-dot-low',
  medium: 'action-severity-dot-medium',
  high: 'action-severity-dot-high',
  critical: 'action-severity-dot-critical',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function TaskCard({ task, onComplete, disabled, unitTypes = [] }: TaskCardProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [editActionTypeId, setEditActionTypeId] = useState(
    task.recommendation.action_type_id || ''
  );
  const [editMaterialId, setEditMaterialId] = useState(
    task.recommendation.material?.id || ''
  );
  const [editDosage, setEditDosage] = useState(
    task.recommendation.dosage?.toString() || ''
  );
  const [editUnitTypeId, setEditUnitTypeId] = useState(
    task.recommendation.unit_type?.id || ''
  );
  const [editNotes, setEditNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  // Cascade-fetched materials and dosage recommendation
  const [cascadeMaterials, setCascadeMaterials] = useState<any[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [recommendedDosage, setRecommendedDosage] = useState<string>('');
  const [recommendedUnitTypeId, setRecommendedUnitTypeId] = useState<string>('');

  const rec = task.recommendation;
  const subAreaDisplay = task.sub_area.display || task.sub_area.name;
  const cropId = task.effective_crop_id || '';
  const findingId = task.finding.id;

  // Fetch materials via cascade when edit opens or action type changes
  const fetchMaterials = useCallback(async (actionTypeId: string) => {
    if (!findingId) return;
    setLoadingMaterials(true);
    try {
      const params = new URLSearchParams({ type: 'materials', cropId, findingId });
      if (actionTypeId) params.set('actionTypeId', actionTypeId);
      const res = await fetch(`/api/cascade?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCascadeMaterials(Array.isArray(data) ? data : []);
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingMaterials(false);
    }
  }, [cropId, findingId]);

  // Fetch dosage recommendation when material changes
  const fetchDosage = useCallback(async (actionTypeId: string, materialId: string) => {
    if (!findingId || !materialId) return;
    try {
      const params = new URLSearchParams({ type: 'dosage', cropId, findingId, materialId });
      if (actionTypeId) params.set('actionTypeId', actionTypeId);
      const res = await fetch(`/api/cascade?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setRecommendedDosage(data.dosage?.toString() || '');
          setRecommendedUnitTypeId(data.unit_type_id || '');
          if (data.dosage) setEditDosage(data.dosage.toString());
          if (data.unit_type_id) setEditUnitTypeId(data.unit_type_id);
        }
      }
    } catch {
      // Non-critical
    }
  }, [cropId, findingId]);

  // Fetch materials when edit mode opens
  useEffect(() => {
    if (showEdit) {
      fetchMaterials(editActionTypeId);
    }
  }, [showEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle action type change — refetch materials, reset material/dosage
  const handleActionTypeChange = (value: string) => {
    setEditActionTypeId(value);
    setEditMaterialId('');
    setEditDosage('');
    setEditUnitTypeId('');
    setRecommendedDosage('');
    setRecommendedUnitTypeId('');
    fetchMaterials(value);
  };

  // Handle material change — fetch dosage recommendation
  const handleMaterialChange = (value: string) => {
    setEditMaterialId(value);
    fetchDosage(editActionTypeId, value);
  };

  const handleDone = async () => {
    setIsCompleting(true);
    try {
      onComplete({
        monitoring_treatment_id: task.monitoring_treatment_id,
        monitoring_report_id: task.monitoring_report_id,
        area_id: task.area_id,
        as_recommended: true,
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleDoneWithChanges = () => {
    const dosageNum = editDosage ? parseFloat(editDosage) : undefined;
    onComplete({
      monitoring_treatment_id: task.monitoring_treatment_id,
      monitoring_report_id: task.monitoring_report_id,
      area_id: task.area_id,
      as_recommended: false,
      action_type_id: editActionTypeId || rec.action_type_id || undefined,
      material_id: editMaterialId || rec.material?.id,
      dosage: dosageNum,
      unit_type_id: editUnitTypeId || rec.unit_type?.id,
      notes: editNotes || undefined,
    });
    setShowEdit(false);
  };

  const sortedUnitTypes = [...unitTypes].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'he')
  );

  return (
    <div className="action-treatment-card p-4 space-y-3">
      {/* Header: finding info + severity */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.severity && (
            <span className={`action-severity-chip ${severityClasses[task.severity] || ''}`}>
              <span className={`action-severity-dot ${severityDotClasses[task.severity] || ''}`} />
              {SEVERITY_LABELS[task.severity] || task.severity}
            </span>
          )}
          <span className="text-sm font-semibold text-foreground">
            {subAreaDisplay} / {task.finding.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(task.monitoring_date)}</span>
        </div>
      </div>

      {task.finding.description && (
        <div className="text-xs text-muted-foreground -mt-1">
          {task.finding.description}
        </div>
      )}

      {/* Treatment fields — monitoring card style */}
      {!showEdit ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-xs text-muted-foreground">חומר מומלץ</label>
              <div className="action-field-value">
                {rec.material?.name || '—'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-xs text-muted-foreground">סוג פעולה</label>
              <div className="action-field-value">
                {rec.action_type_id ? (ACTION_TYPE_LABELS[rec.action_type_id as ActionTypeName] || rec.action_type_id) : '—'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-xs text-muted-foreground">מינון</label>
              <div className="action-field-value">
                {rec.dosage != null ? `${rec.dosage} ${rec.unit_type?.name || ''}` : '—'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-xs text-muted-foreground">יחידת מידה</label>
              <div className="action-field-value">
                {rec.unit_type?.name || '—'}
              </div>
            </div>
          </div>

          {task.notes && (
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold">הערות:</span> {task.notes}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              className="action-btn-done"
              onClick={handleDone}
              disabled={disabled || isCompleting}
            >
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" />
                {isCompleting ? '...' : 'בוצע'}
              </span>
            </button>
            <button
              className="action-btn-edit"
              onClick={() => setShowEdit(true)}
              disabled={disabled}
            >
              <Edit3 className="h-3.5 w-3.5" />
              שינוי
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 pt-1">
            <span className="action-treatment-number">
              <Sparkles className="h-2.5 w-2.5" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">שינויים מהמלצה</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Material — searchable */}
            <div className="space-y-1">
              <label className="font-semibold text-xs text-muted-foreground">
                חומר
                {loadingMaterials && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}
              </label>
              <SearchableMaterialSelect
                materials={cascadeMaterials}
                value={editMaterialId}
                onValueChange={handleMaterialChange}
                disabled={loadingMaterials}
                placeholder={rec.material?.name || 'בחר חומר'}
                className="actions-select-trigger"
              />
            </div>

            {/* Action Type */}
            <div className="space-y-1">
              <label className="font-semibold text-xs text-muted-foreground">סוג פעולה</label>
              <Select value={editActionTypeId} onValueChange={handleActionTypeChange}>
                <SelectTrigger className="h-10 w-full actions-select-trigger">
                  <SelectValue placeholder="בחר סוג פעולה" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {ACTION_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dosage */}
            <div className="space-y-1">
              <label className="font-semibold text-xs text-muted-foreground">מינון</label>
              <Input
                type="number"
                step="any"
                value={editDosage}
                onChange={(e) => setEditDosage(e.target.value)}
                placeholder={
                  recommendedDosage
                    ? `מומלץ: ${recommendedDosage}`
                    : rec.dosage != null
                      ? `מומלץ: ${rec.dosage}`
                      : 'הזן מינון'
                }
                className="h-10 actions-select-trigger"
              />
            </div>

            {/* Unit Type — sorted */}
            <div className="space-y-1">
              <label className="font-semibold text-xs text-muted-foreground">יחידת מידה</label>
              <Select value={editUnitTypeId} onValueChange={setEditUnitTypeId}>
                <SelectTrigger className="h-10 w-full actions-select-trigger">
                  <SelectValue placeholder={rec.unit_type?.name || 'בחר יחידה'} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {sortedUnitTypes.map((ut) => (
                    <SelectItem key={ut.id} value={ut.id}>
                      {ut.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="font-semibold text-xs text-muted-foreground">הערות</label>
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="סיבת השינוי..."
              rows={2}
              className="actions-select-trigger"
            />
          </div>

          {/* Confirm / Cancel */}
          <div className="flex gap-2">
            <button className="action-btn-done" onClick={handleDoneWithChanges} disabled={disabled}>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" />
                אישור
              </span>
            </button>
            <button
              className="action-btn-edit"
              onClick={() => setShowEdit(false)}
            >
              ביטול
            </button>
          </div>
        </>
      )}
    </div>
  );
}
