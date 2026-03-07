'use client';

import { useState, useEffect } from 'react';
import { getSubAreaLabel } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { ENTIRE_AREA, ENTIRE_AREA_DISPLAY } from '@/lib/constants';
import { ACTION_TYPE_OPTIONS } from '@/types/database';

interface SubArea {
  id: string;
  name: string;
  display: string | null;
}

interface Finding {
  id: string;
  name: string;
}

interface Material {
  id: string;
  name: string;
}

interface UnitType {
  id: string;
  name: string;
}

export interface StandaloneActionData {
  sub_area_id: string | null;
  finding_id: string;
  action_type_id?: string;
  material_id?: string;
  dosage?: number;
  unit_type_id?: string;
  notes?: string;
}

interface StandaloneActionFormProps {
  areaId: string;
  subAreas: SubArea[];
  findings: Finding[];
  unitTypes: UnitType[];
  onSubmit: (data: StandaloneActionData) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function StandaloneActionForm({
  areaId,
  subAreas,
  findings,
  unitTypes,
  onSubmit,
  onCancel,
  disabled,
}: StandaloneActionFormProps) {
  const [subAreaId, setSubAreaId] = useState('');
  const [findingId, setFindingId] = useState('');
  const [actionTypeId, setActionTypeId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [dosage, setDosage] = useState('');
  const [unitTypeId, setUnitTypeId] = useState('');
  const [notes, setNotes] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  // Fetch materials when action type changes (using cascade API)
  useEffect(() => {
    if (!actionTypeId || !findingId) {
      setMaterials([]);
      return;
    }

    const fetchMaterials = async () => {
      setLoadingMaterials(true);
      try {
        // Find the crop_id from the selected sub-area
        const subArea = subAreas.find(sa => sa.id === subAreaId);
        // Use cascade API
        const params = new URLSearchParams({
          type: 'materials',
          cropId: '', // Will need crop from area
          findingId,
          actionTypeId,
        });

        const res = await fetch(`/api/cascade?${params}`);
        if (res.ok) {
          const data = await res.json();
          setMaterials(Array.isArray(data) ? data : []);
        }
      } catch {
        // Silently handle - user can still type
      } finally {
        setLoadingMaterials(false);
      }
    };

    fetchMaterials();
  }, [actionTypeId, findingId, subAreaId, subAreas]);

  const handleSubmit = () => {
    if (!subAreaId || !findingId) return;

    onSubmit({
      sub_area_id: subAreaId === ENTIRE_AREA ? null : subAreaId,
      finding_id: findingId,
      action_type_id: actionTypeId || undefined,
      material_id: materialId || undefined,
      dosage: dosage ? parseFloat(dosage) : undefined,
      unit_type_id: unitTypeId || undefined,
      notes: notes || undefined,
    });

    // Reset form
    setSubAreaId('');
    setFindingId('');
    setActionTypeId('');
    setMaterialId('');
    setDosage('');
    setUnitTypeId('');
    setNotes('');
  };

  const isValid = subAreaId && findingId;

  return (
    <Card className="border-dashed py-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">פעולה נוספת</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">תת-שטח *</Label>
            <Select value={subAreaId} onValueChange={setSubAreaId} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="בחר תת-שטח" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ENTIRE_AREA}>
                  {ENTIRE_AREA_DISPLAY}
                </SelectItem>
                {subAreas.map((sa) => (
                  <SelectItem key={sa.id} value={sa.id}>
                    {getSubAreaLabel(sa)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">ממצא *</Label>
            <Select value={findingId} onValueChange={setFindingId} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="בחר ממצא" />
              </SelectTrigger>
              <SelectContent>
                {[...findings].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he')).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">סוג פעולה</Label>
            <Select value={actionTypeId} onValueChange={setActionTypeId} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="בחר סוג" />
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
            <Label className="text-xs">חומר</Label>
            <Select
              value={materialId}
              onValueChange={setMaterialId}
              disabled={disabled || loadingMaterials}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingMaterials ? 'טוען...' : 'בחר חומר'} />
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
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="כמות"
              disabled={disabled}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">יחידה</Label>
            <Select value={unitTypeId} onValueChange={setUnitTypeId} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="בחר יחידה" />
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
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות נוספות..."
            rows={2}
            disabled={disabled}
          />
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={disabled || !isValid}
          >
            הוסף
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={disabled}
          >
            ביטול
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
