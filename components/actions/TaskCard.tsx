'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SEVERITY_LABELS, ReportSeverity } from '@/types/database';

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
    action_type: { id: string; name: string; description: string | null } | null;
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
  actionTypes?: RefItem[];
  materials?: RefItem[];
  unitTypes?: RefItem[];
}

const severityColors: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function TaskCard({ task, onComplete, disabled, actionTypes = [], materials = [], unitTypes = [] }: TaskCardProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [editActionTypeId, setEditActionTypeId] = useState(
    task.recommendation.action_type?.id || ''
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
      action_type_id: editActionTypeId || rec.action_type?.id,
      material_id: editMaterialId || rec.material?.id,
      dosage: dosageNum,
      unit_type_id: editUnitTypeId || rec.unit_type?.id,
      notes: editNotes || undefined,
    });
    setShowEdit(false);
  };

  return (
    <Card className="py-4">
      <CardContent className="space-y-3">
        {/* Header: sub-area + finding + severity */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="font-medium text-base">
              {subAreaDisplay} / {task.finding.name}
            </div>
            {task.finding.description && (
              <div className="text-sm text-muted-foreground">
                {task.finding.description}
              </div>
            )}
          </div>
          {task.severity && (
            <Badge
              className={severityColors[task.severity] || ''}
              variant="outline"
            >
              {SEVERITY_LABELS[task.severity] || task.severity}
            </Badge>
          )}
        </div>

        {/* Recommendation details */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
          {rec.action_type && (
            <div className="flex gap-2">
              <span className="text-muted-foreground">סוג פעולה:</span>
              <span className="font-medium">{rec.action_type.name}</span>
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
          <div className="flex gap-2 text-muted-foreground text-xs pt-1">
            <span>ניטור: {formatDate(task.monitoring_date)}</span>
          </div>
        </div>

        {/* Action buttons */}
        {!showEdit ? (
          <div className="flex gap-2">
            <Button
              onClick={handleDone}
              disabled={disabled || isCompleting}
              size="sm"
            >
              {isCompleting ? '...' : 'בוצע'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEdit(true)}
              disabled={disabled}
            >
              בוצע עם שינויים
            </Button>
          </div>
        ) : (
          /* Edit form for "done with changes" */
          <div className="border rounded-lg p-3 space-y-3 bg-background">
            <div className="text-sm font-medium">שינויים מהמלצה</div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">סוג פעולה</Label>
                <Select value={editActionTypeId} onValueChange={setEditActionTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder={rec.action_type?.name || 'בחר סוג פעולה'} />
                  </SelectTrigger>
                  <SelectContent>
                    {actionTypes.map((at) => (
                      <SelectItem key={at.id} value={at.id}>
                        {at.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">חומר</Label>
                <Select value={editMaterialId} onValueChange={setEditMaterialId}>
                  <SelectTrigger>
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
                <Label className="text-xs">מינון</Label>
                <Input
                  type="number"
                  step="any"
                  value={editDosage}
                  onChange={(e) => setEditDosage(e.target.value)}
                  placeholder={rec.dosage?.toString() || ''}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">יחידה</Label>
                <Select value={editUnitTypeId} onValueChange={setEditUnitTypeId}>
                  <SelectTrigger>
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
              <Label className="text-xs">הערות</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="סיבת השינוי..."
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleDoneWithChanges} disabled={disabled}>
                אישור
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEdit(false)}
              >
                ביטול
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
