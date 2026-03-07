'use client';

import { useState } from 'react';
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
import { Check, Edit3, Calendar } from 'lucide-react';

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

export function TaskCard({ task, onComplete, disabled, materials = [], unitTypes = [] }: TaskCardProps) {
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

  const rec = task.recommendation;
  const subAreaDisplay = task.sub_area.display || task.sub_area.name;

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

  return (
    <div className="task-card p-4">
      {/* Header: sub-area + finding + severity */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="space-y-1">
          <div className="font-semibold text-base text-foreground">
            {subAreaDisplay} / {task.finding.name}
          </div>
          {task.finding.description && (
            <div className="text-sm text-muted-foreground">
              {task.finding.description}
            </div>
          )}
        </div>
        {task.severity && (
          <span className={`action-severity-chip ${severityClasses[task.severity] || ''}`}>
            <span className={`action-severity-dot ${severityDotClasses[task.severity] || ''}`} />
            {SEVERITY_LABELS[task.severity] || task.severity}
          </span>
        )}
      </div>

      {/* Recommendation details */}
      <div className="recommendation-block p-3 space-y-1.5 text-sm mb-3">
        {rec.action_type_id && (
          <div className="flex gap-2">
            <span className="text-muted-foreground">סוג פעולה:</span>
            <span className="font-medium">{ACTION_TYPE_LABELS[rec.action_type_id as ActionTypeName] || rec.action_type_id}</span>
          </div>
        )}
        {rec.material && (
          <div className="flex gap-2">
            <span className="text-muted-foreground">חומר:</span>
            <span className="font-medium">{rec.material.name}</span>
          </div>
        )}
        {rec.dosage != null && (
          <div className="flex gap-2">
            <span className="text-muted-foreground">מינון:</span>
            <span className="font-medium">
              {rec.dosage} {rec.unit_type?.name || ''}
            </span>
          </div>
        )}
        {task.notes && (
          <div className="flex gap-2">
            <span className="text-muted-foreground">הערות:</span>
            <span>{task.notes}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs pt-1">
          <Calendar className="h-3 w-3" />
          <span>ניטור: {formatDate(task.monitoring_date)}</span>
        </div>
      </div>

      {/* Action buttons or Edit form */}
      {!showEdit ? (
        <div className="flex gap-2">
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
            בוצע עם שינויים
          </button>
        </div>
      ) : (
        /* Edit form for "done with changes" */
        <div className="edit-form-block p-3 space-y-3">
          <div className="text-sm font-semibold text-foreground">שינויים מהמלצה</div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">סוג פעולה</label>
              <Select value={editActionTypeId} onValueChange={setEditActionTypeId}>
                <SelectTrigger className="actions-select-trigger">
                  <SelectValue placeholder={rec.action_type_id ? (ACTION_TYPE_LABELS[rec.action_type_id as ActionTypeName] || rec.action_type_id) : 'בחר סוג פעולה'} />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">חומר</label>
              <Select value={editMaterialId} onValueChange={setEditMaterialId}>
                <SelectTrigger className="actions-select-trigger">
                  <SelectValue placeholder={rec.material?.name || 'בחר חומר'} />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">מינון</label>
              <Input
                type="number"
                step="any"
                value={editDosage}
                onChange={(e) => setEditDosage(e.target.value)}
                placeholder={rec.dosage?.toString() || ''}
                className="actions-select-trigger"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">יחידה</label>
              <Select value={editUnitTypeId} onValueChange={setEditUnitTypeId}>
                <SelectTrigger className="actions-select-trigger">
                  <SelectValue placeholder={rec.unit_type?.name || 'בחר יחידה'} />
                </SelectTrigger>
                <SelectContent>
                  {unitTypes.map((ut) => (
                    <SelectItem key={ut.id} value={ut.id}>
                      {ut.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">הערות</label>
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="סיבת השינוי..."
              rows={2}
            />
          </div>

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
        </div>
      )}
    </div>
  );
}
