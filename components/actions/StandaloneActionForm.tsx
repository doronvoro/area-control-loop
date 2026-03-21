'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSubAreaLabel } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { SearchableMaterialSelect } from '@/components/monitoring/SearchableMaterialSelect';
import { ENTIRE_AREA, ENTIRE_AREA_DISPLAY } from '@/lib/constants';
import { ACTION_TYPE_OPTIONS, ReportSeverity, SEVERITY_OPTIONS } from '@/types/database';
import { Check, Lock, LockOpen, Loader2, Trash2 } from 'lucide-react';

// Same severity config as MonitoringForm
const SEVERITY_CONFIG: Record<string, { label: string; dotClass: string; chipClass: string }> = {
  [ReportSeverity.LOW]: { label: 'נמוכה', dotClass: 'severity-dot-low', chipClass: 'severity-low' },
  [ReportSeverity.MEDIUM]: { label: 'בינונית', dotClass: 'severity-dot-medium', chipClass: 'severity-medium' },
  [ReportSeverity.HIGH]: { label: 'גבוהה', dotClass: 'severity-dot-high', chipClass: 'severity-high' },
  [ReportSeverity.CRITICAL]: { label: 'קריטית', dotClass: 'severity-dot-critical', chipClass: 'severity-critical' },
};

interface SubArea {
  id: string;
  name: string;
  display: string | null;
}

interface Finding {
  id: string;
  name: string;
  description?: string;
}

interface UnitType {
  id: string;
  name: string;
  description?: string;
}

export interface StandaloneActionData {
  sub_area_id: string | null;
  finding_id: string;
  severity?: string;
  action_type_id?: string;
  material_id?: string;
  dosage?: number;
  unit_type_id?: string;
  notes?: string;
}

interface StandaloneActionFormProps {
  areaId: string;
  cropId: string;
  subAreas: SubArea[];
  findings: Finding[];
  unitTypes: UnitType[];
  onSubmit: (data: StandaloneActionData) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function StandaloneActionForm({
  areaId,
  cropId,
  subAreas,
  findings,
  unitTypes,
  onSubmit,
  onCancel,
  disabled,
}: StandaloneActionFormProps) {
  const [subAreaId, setSubAreaId] = useState('');
  const [findingId, setFindingId] = useState('');
  const [severity, setSeverity] = useState<string | undefined>(undefined);
  const [actionTypeId, setActionTypeId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [dosage, setDosage] = useState('');
  const [unitTypeId, setUnitTypeId] = useState('');
  const [notes, setNotes] = useState('');

  // Cascade materials (filtered by crop/finding/actionType)
  const [cascadeMaterials, setCascadeMaterials] = useState<any[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  // Unlock: all materials vs cascade-filtered
  const [unlockedMaterials, setUnlockedMaterials] = useState(false);
  const [allMaterials, setAllMaterials] = useState<any[] | null>(null);

  // Dosage recommendation
  const [recommendedDosage, setRecommendedDosage] = useState('');

  // Crop-filtered findings + lock/unlock
  const [cropFindings, setCropFindings] = useState<Finding[] | null>(null);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [unlockedFindings, setUnlockedFindings] = useState(false);

  // Fetch crop-filtered findings when sub-area changes
  useEffect(() => {
    if (!subAreaId || !cropId) {
      setCropFindings(null);
      return;
    }

    const fetchCropFindings = async () => {
      setLoadingFindings(true);
      try {
        const res = await fetch(`/api/cascade?type=findings&cropId=${cropId}`);
        if (res.ok) {
          const data = await res.json();
          setCropFindings(Array.isArray(data) ? data : null);
        }
      } catch {
        // Non-critical — all findings still available
      } finally {
        setLoadingFindings(false);
      }
    };

    fetchCropFindings();
  }, [subAreaId, cropId]);

  // Reset finding when sub-area changes
  useEffect(() => {
    setFindingId('');
    setUnlockedFindings(false);
  }, [subAreaId]);

  const fetchAllMaterials = useCallback(async () => {
    if (allMaterials) return;
    try {
      const res = await fetch('/api/materials');
      if (res.ok) {
        const data = await res.json();
        setAllMaterials(data);
      }
    } catch {
      // Non-critical
    }
  }, [allMaterials]);

  // Fetch materials via cascade
  const fetchMaterials = useCallback(async (atId: string) => {
    if (!findingId) return;
    setLoadingMaterials(true);
    try {
      const params = new URLSearchParams({ type: 'materials', cropId: cropId || '', findingId });
      if (atId) params.set('actionTypeId', atId);
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
  }, [findingId, cropId]);

  // Fetch dosage recommendation when material changes
  const fetchDosage = useCallback(async (atId: string, matId: string) => {
    if (!findingId || !matId) return;
    try {
      const params = new URLSearchParams({ type: 'dosage', cropId: cropId || '', findingId, materialId: matId });
      if (atId) params.set('actionTypeId', atId);
      const res = await fetch(`/api/cascade?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setRecommendedDosage(data.dosage?.toString() || '');
          if (data.dosage) setDosage(data.dosage.toString());
          if (data.unit_type_id) setUnitTypeId(data.unit_type_id);
        }
      }
    } catch {
      // Non-critical
    }
  }, [findingId, cropId]);

  // Refetch materials when finding or action type changes
  useEffect(() => {
    if (!actionTypeId || !findingId) {
      setCascadeMaterials([]);
      return;
    }
    fetchMaterials(actionTypeId);
  }, [actionTypeId, findingId, fetchMaterials]);

  // Handle action type change — reset dependent fields
  const handleActionTypeChange = (value: string) => {
    setActionTypeId(value);
    setMaterialId('');
    setDosage('');
    setUnitTypeId('');
    setRecommendedDosage('');
    fetchMaterials(value);
  };

  // Handle material change — fetch dosage recommendation
  const handleMaterialChange = (value: string) => {
    setMaterialId(value);
    fetchDosage(actionTypeId, value);
  };

  const handleSubmit = () => {
    if (!subAreaId || !findingId) return;

    onSubmit({
      sub_area_id: subAreaId === ENTIRE_AREA ? null : subAreaId,
      finding_id: findingId,
      severity: severity || undefined,
      action_type_id: actionTypeId || undefined,
      material_id: materialId || undefined,
      dosage: dosage ? parseFloat(dosage) : undefined,
      unit_type_id: unitTypeId || undefined,
      notes: notes || undefined,
    });

    // Reset form
    setSubAreaId('');
    setFindingId('');
    setSeverity(undefined);
    setActionTypeId('');
    setMaterialId('');
    setDosage('');
    setUnitTypeId('');
    setNotes('');
    setCascadeMaterials([]);
    setRecommendedDosage('');
    setCropFindings(null);
    setUnlockedFindings(false);
  };

  const sortedUnitTypes = [...unitTypes].sort((a, b) =>
    (a.description || a.name || '').localeCompare(b.description || b.name || '', 'he')
  );

  const isValid = subAreaId && findingId;

  // Build sub-area options for SearchableSelect
  const subAreaOptions = [
    { value: ENTIRE_AREA, label: ENTIRE_AREA_DISPLAY },
    ...subAreas.map((sa) => ({
      value: sa.id,
      label: getSubAreaLabel(sa),
    })),
  ];

  // Build finding options — crop-filtered or all
  const displayFindings = unlockedFindings ? findings : (cropFindings || findings);
  const findingOptions = [...displayFindings]
    .sort((a, b) => (a.description || a.name || '').localeCompare(b.description || b.name || '', 'he'))
    .map((f) => ({
      value: f.id,
      label: f.description || f.name,
    }));

  return (
    <div className="actions-section section-tasks p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="action-treatment-number">1</span>
          <span className="text-xs font-semibold text-muted-foreground">פעולה עצמאית</span>
        </div>
        <button
          type="button"
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={onCancel}
          disabled={disabled}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Sub-area — searchable single select */}
      <div className="space-y-1">
        <label className="font-semibold text-xs text-muted-foreground">תת-שטח *</label>
        <SearchableSelect
          options={subAreaOptions}
          value={subAreaId}
          onValueChange={setSubAreaId}
          placeholder="בחר תת-שטח"
          searchPlaceholder="חיפוש תת-שטח..."
          disabled={disabled}
        />
      </div>

      {/* Finding — searchable single select with lock/unlock */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <label className="font-semibold text-xs text-muted-foreground">
            ממצא *
            {loadingFindings && <Loader2 className="inline h-3 w-3 animate-spin ms-1.5" />}
          </label>
          {cropFindings && cropFindings !== findings && (
            <button
              type="button"
              onClick={() => setUnlockedFindings(prev => !prev)}
              className="p-0.5 rounded hover:bg-accent text-muted-foreground transition-colors"
              title={unlockedFindings ? 'הצג רק ממצאים מומלצים' : 'הצג את כל הממצאים'}
            >
              {unlockedFindings
                ? <LockOpen className="h-3.5 w-3.5 text-orange-500" />
                : <Lock className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        <SearchableSelect
          options={findingOptions}
          value={findingId}
          onValueChange={setFindingId}
          placeholder={!subAreaId ? 'בחר תת-שטח תחילה' : 'בחר ממצא'}
          searchPlaceholder="חיפוש ממצא..."
          disabled={disabled || !subAreaId || loadingFindings}
        />
      </div>

      {/* Severity chips */}
      <div className="space-y-1">
        <label className="font-semibold text-xs text-muted-foreground">חומרה</label>
        <div className="severity-chips">
          {SEVERITY_OPTIONS.map((option) => {
            const config = SEVERITY_CONFIG[option.value];
            const isActive = severity === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`severity-chip ${config.chipClass} ${isActive ? 'severity-active' : ''}`}
                onClick={() => setSeverity(isActive ? undefined : option.value)}
                disabled={disabled}
              >
                <span className={`severity-dot ${config.dotClass}`} />
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Treatment fields — same layout as monitoring treatment card */}
      <div className="treatment-card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Material — searchable, with lock/unlock */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <label className="font-semibold text-xs text-muted-foreground">
                חומר מומלץ
                {loadingMaterials && <Loader2 className="inline h-3 w-3 animate-spin ms-1.5" />}
              </label>
              {cascadeMaterials.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (!unlockedMaterials) fetchAllMaterials();
                    setUnlockedMaterials(prev => !prev);
                  }}
                  className="p-0.5 rounded hover:bg-accent text-muted-foreground transition-colors"
                  title={unlockedMaterials ? 'הצג רק חומרים מומלצים' : 'הצג את כל החומרים'}
                >
                  {unlockedMaterials
                    ? <LockOpen className="h-3.5 w-3.5 text-orange-500" />
                    : <Lock className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
            <SearchableMaterialSelect
              materials={unlockedMaterials ? (allMaterials || []) : cascadeMaterials}
              value={materialId}
              onValueChange={handleMaterialChange}
              disabled={disabled || loadingMaterials}
              placeholder="בחר חומר"
            />
          </div>

          {/* Action Type */}
          <div className="space-y-1">
            <label className="font-semibold text-xs text-muted-foreground">סוג פעולה</label>
            <Select value={actionTypeId} onValueChange={handleActionTypeChange} disabled={disabled}>
              <SelectTrigger className="h-10 w-full monitoring-select-trigger">
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
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder={recommendedDosage ? `מומלץ: ${recommendedDosage}` : 'הזן מינון'}
              disabled={disabled}
              className="h-10 monitoring-select-trigger"
            />
          </div>

          {/* Unit Type */}
          <div className="space-y-1">
            <label className="font-semibold text-xs text-muted-foreground">יחידת מידה</label>
            <Select value={unitTypeId} onValueChange={setUnitTypeId} disabled={disabled}>
              <SelectTrigger className="h-10 w-full monitoring-select-trigger">
                <SelectValue placeholder="בחר יחידת מידה" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                {sortedUnitTypes.map((ut) => (
                  <SelectItem key={ut.id} value={ut.id}>
                    {ut.description || ut.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="font-semibold text-xs text-muted-foreground">הערות</label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות..."
            disabled={disabled}
            className="h-10 monitoring-select-trigger"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          className="action-btn-done"
          onClick={handleSubmit}
          disabled={disabled || !isValid}
        >
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            הוסף
          </span>
        </button>
        <button
          className="action-btn-edit"
          onClick={onCancel}
          disabled={disabled}
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
