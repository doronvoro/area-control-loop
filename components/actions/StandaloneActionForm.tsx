'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSubAreaLabel } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { SearchableMaterialSelect } from '@/components/monitoring/SearchableMaterialSelect';
import { ENTIRE_AREA } from '@/lib/constants';
import { ACTION_TYPE_OPTIONS, ActionTypeName, ReportSeverity, SEVERITY_OPTIONS } from '@/types/database';
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
  parent_sub_area_id?: string | null;
  level?: number;
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
  onSubmit: (data: StandaloneActionData[]) => void;
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
  const [subAreaIds, setSubAreaIds] = useState<string[]>([]);
  const [findingIds, setFindingIds] = useState<string[]>([]);
  const [severity, setSeverity] = useState<string | undefined>(undefined);
  const [actionTypeId, setActionTypeId] = useState<string>(ActionTypeName.SPRAY);
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

  // Build parentMap / levelMap for sub-area tree hierarchy
  const subAreaParentMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const sa of subAreas) {
      map[sa.id] = sa.parent_sub_area_id || null;
    }
    return map;
  }, [subAreas]);

  const subAreaLevelMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sa of subAreas) {
      map[sa.id] = (sa.level || 1) - 1;
    }
    return map;
  }, [subAreas]);

  // Sub-area options for MultiSelect
  const subAreaOptions = useMemo(() =>
    subAreas.map((sa) => ({
      value: sa.id,
      label: getSubAreaLabel(sa),
      shortLabel: sa.name,
    })),
    [subAreas]
  );

  // Fetch crop-filtered findings when sub-areas change
  useEffect(() => {
    if (subAreaIds.length === 0 || !cropId) {
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
        // Non-critical
      } finally {
        setLoadingFindings(false);
      }
    };

    fetchCropFindings();
  }, [subAreaIds.length > 0, cropId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset findings when sub-areas change
  const handleSubAreaIdsChange = (ids: string[]) => {
    setSubAreaIds(ids);
    setFindingIds([]);
    setUnlockedFindings(false);
  };

  // Finding options — crop-filtered or all
  const findingOptions = useMemo(() => {
    const displayFindings = unlockedFindings ? findings : (cropFindings || findings);
    return [...displayFindings]
      .sort((a, b) => (a.description || a.name || '').localeCompare(b.description || b.name || '', 'he'))
      .map((f) => ({
        value: f.id,
        label: f.description || f.name,
      }));
  }, [unlockedFindings, findings, cropFindings]);

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

  // Fetch materials via cascade using all selected findings (union)
  const fetchMaterials = useCallback(async (atId: string) => {
    if (findingIds.length === 0) return;
    setLoadingMaterials(true);
    try {
      if (!cropId) {
        // No crop — fetch all materials directly
        const res = await fetch('/api/materials');
        if (res.ok) {
          const data = await res.json();
          setCascadeMaterials(Array.isArray(data) ? data : []);
        }
      } else {
        const params = new URLSearchParams({ type: 'materials', cropId });
        params.set('findingIds', findingIds.join(','));
        if (atId) params.set('actionTypeId', atId);
        const res = await fetch(`/api/cascade?${params}`);
        if (res.ok) {
          const data = await res.json();
          setCascadeMaterials(Array.isArray(data) ? data : []);
        }
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingMaterials(false);
    }
  }, [findingIds, cropId]);

  // Fetch dosage recommendation when material changes
  const primaryFindingId = findingIds[0] || '';
  const fetchDosage = useCallback(async (atId: string, matId: string) => {
    if (!primaryFindingId || !matId) return;
    try {
      const params = new URLSearchParams({ type: 'dosage', cropId: cropId || '', findingId: primaryFindingId, materialId: matId });
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
  }, [primaryFindingId, cropId]);

  // Refetch materials when findings or action type changes
  useEffect(() => {
    if (findingIds.length === 0) {
      setCascadeMaterials([]);
      return;
    }
    fetchMaterials(actionTypeId);
  }, [actionTypeId, findingIds, fetchMaterials]);

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
    if (subAreaIds.length === 0 || findingIds.length === 0) return;

    // Expand multi-selections into individual actions
    const actions: StandaloneActionData[] = [];
    for (const saId of subAreaIds) {
      for (const fId of findingIds) {
        actions.push({
          sub_area_id: saId === ENTIRE_AREA ? null : saId,
          finding_id: fId,
          severity: severity || undefined,
          action_type_id: actionTypeId || undefined,
          material_id: materialId || undefined,
          dosage: dosage ? parseFloat(dosage) : undefined,
          unit_type_id: unitTypeId || undefined,
          notes: notes || undefined,
        });
      }
    }

    onSubmit(actions);

    // Reset form
    setSubAreaIds([]);
    setFindingIds([]);
    setSeverity(undefined);
    setActionTypeId(ActionTypeName.SPRAY);
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

  const isValid = subAreaIds.length > 0 && findingIds.length > 0;

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

      {/* Sub-areas — MultiSelect (same as monitoring) */}
      <div className="space-y-1">
        <label className="font-semibold text-xs text-muted-foreground">תתי-שטח *</label>
        <MultiSelect
          options={subAreaOptions}
          value={subAreaIds}
          onValueChange={handleSubAreaIdsChange}
          placeholder="בחר תתי-שטח"
          selectAllLabel="בחר את כל השטח"
          parentMap={subAreaParentMap}
          levelMap={subAreaLevelMap}
          disabled={disabled}
          className="monitoring-select-trigger"
        />
      </div>

      {/* Findings — MultiSelect with lock/unlock (same as monitoring) */}
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
        <MultiSelect
          options={findingOptions}
          value={findingIds}
          onValueChange={setFindingIds}
          placeholder={subAreaIds.length === 0 ? 'בחר תתי-שטח תחילה' : 'בחר ממצאים'}
          showSelectAll={false}
          disabled={disabled || subAreaIds.length === 0 || loadingFindings}
          className="monitoring-select-trigger"
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
