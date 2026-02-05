'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit, X, Filter, RotateCcw } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const dosageSchema = z.object({
  unit_type_id: z.string().min(1, 'סוג יחידה נדרש'),
  dosage: z.string().min(1, 'מינון נדרש').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'מינון חייב להיות מספר חיובי'
  ),
});

const recommendationSchema = z.object({
  crop_id: z.string().min(1, 'גידול נדרש'),
  action_type_id: z.string().min(1, 'סוג פעולה נדרש'),
  material_id: z.string().min(1, 'חומר נדרש'),
  dosages: z.array(dosageSchema).min(1, 'נדרש לפחות מינון אחד'),
});

type RecommendationFormData = z.infer<typeof recommendationSchema>;

interface Recommendation {
  key: {
    crop_id: string;
    action_type_id: string;
    material_id: string;
    crop?: { id: string; name: string; description?: string };
    action_type?: { id: string; name: string; description?: string };
    material?: { id: string; name: string; description?: string };
  };
  values: Array<{
    id: string;
    unit_type_id: string;
    unit_type?: { id: string; name: string; description?: string };
    dosage: number;
  }>;
}

export function RecommendMaterialsManager() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [actionTypes, setActionTypes] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [unitTypes, setUnitTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterCropId, setFilterCropId] = useState<string>('');
  const [filterActionTypeId, setFilterActionTypeId] = useState<string>('');
  const [filterMaterialId, setFilterMaterialId] = useState<string>('');

  const form = useForm<RecommendationFormData>({
    resolver: zodResolver(recommendationSchema),
    defaultValues: {
      crop_id: '',
      action_type_id: '',
      material_id: '',
      dosages: [{ unit_type_id: '', dosage: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'dosages',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recRes, cropsRes, actionTypesRes, materialsRes, unitTypesRes] = await Promise.all([
        fetch('/api/recommend-materials'),
        fetch('/api/crops'),
        fetch('/api/action-types'),
        fetch('/api/materials'),
        fetch('/api/unit-types'),
      ]);

      if (recRes.ok) {
        const recData = await recRes.json();
        setRecommendations(recData);
      }

      if (cropsRes.ok) {
        const cropsData = await cropsRes.json();
        setCrops(cropsData);
      }

      if (actionTypesRes.ok) {
        const actionTypesData = await actionTypesRes.json();
        setActionTypes(actionTypesData);
      }

      if (materialsRes.ok) {
        const materialsData = await materialsRes.json();
        setMaterials(materialsData);
      }

      if (unitTypesRes.ok) {
        const unitTypesData = await unitTypesRes.json();
        setUnitTypes(unitTypesData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (key?: string) => {
    if (key) {
      const rec = recommendations.find(
        (r) => `${r.key.crop_id}_${r.key.action_type_id}_${r.key.material_id}` === key
      );
      if (rec) {
        setEditingKey(key);
        form.reset({
          crop_id: rec.key.crop_id,
          action_type_id: rec.key.action_type_id,
          material_id: rec.key.material_id,
          dosages: rec.values.map((v) => ({
            unit_type_id: v.unit_type_id,
            dosage: v.dosage.toString(),
          })),
        });
      }
    } else {
      setEditingKey(null);
      form.reset({
        crop_id: '',
        action_type_id: '',
        material_id: '',
        dosages: [{ unit_type_id: '', dosage: '' }],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingKey(null);
    form.reset();
  };

  const onSubmit = async (data: RecommendationFormData) => {
    setError(null);
    try {
      const dosages = data.dosages.map((d) => ({
        unit_type_id: d.unit_type_id,
        dosage: parseFloat(d.dosage),
      }));

      if (editingKey) {
        // Delete old and create new
        const keyParts = editingKey.split('_');
        await fetch(`/api/recommend-materials?key=${editingKey}`, {
          method: 'DELETE',
        });
      }

      const response = await fetch('/api/recommend-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_id: data.crop_id,
          action_type_id: data.action_type_id,
          material_id: data.material_id,
          dosages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בשמירה');
      }

      handleCloseDialog();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את ההמלצה?')) return;

    try {
      const response = await fetch(`/api/recommend-materials?key=${key}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה במחיקה');
      }

      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Filter recommendations
  const filteredRecommendations = recommendations.filter((rec) => {
    if (filterCropId && rec.key.crop_id !== filterCropId) return false;
    if (filterActionTypeId && rec.key.action_type_id !== filterActionTypeId) return false;
    if (filterMaterialId && rec.key.material_id !== filterMaterialId) return false;
    return true;
  });

  const hasActiveFilters = filterCropId || filterActionTypeId || filterMaterialId;

  const clearFilters = () => {
    setFilterCropId('');
    setFilterActionTypeId('');
    setFilterMaterialId('');
  };

  if (loading) {
    return <div className="text-center py-8">טוען...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle className="text-lg">סינון</CardTitle>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="mr-auto"
              >
                <RotateCcw className="h-4 w-4 ml-1" />
                נקה סינון
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">גידול</Label>
              <Select
                value={filterCropId || '__all__'}
                onValueChange={(value) => setFilterCropId(value === '__all__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="כל הגידולים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">כל הגידולים</SelectItem>
                  {crops.map((crop) => (
                    <SelectItem key={crop.id} value={crop.id}>
                      {crop.description || crop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">סוג פעולה</Label>
              <Select
                value={filterActionTypeId || '__all__'}
                onValueChange={(value) => setFilterActionTypeId(value === '__all__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="כל סוגי הפעולות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">כל סוגי הפעולות</SelectItem>
                  {actionTypes.map((at) => (
                    <SelectItem key={at.id} value={at.id}>
                      {at.description || at.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">חומר</Label>
              <Select
                value={filterMaterialId || '__all__'}
                onValueChange={(value) => setFilterMaterialId(value === '__all__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="כל החומרים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">כל החומרים</SelectItem>
                  {materials.map((material) => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.description || material.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasActiveFilters && (
            <p className="text-sm text-muted-foreground mt-3">
              מציג {filteredRecommendations.length} מתוך {recommendations.length} המלצות
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 ml-2" />
          הוסף המלצה חדשה
        </Button>
      </div>

      <div className="grid gap-4">
        {filteredRecommendations.map((rec) => {
          const key = `${rec.key.crop_id}_${rec.key.action_type_id}_${rec.key.material_id}`;
          return (
            <Card key={key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {rec.key.crop?.name || 'גידול לא ידוע'} |{' '}
                    {rec.key.action_type?.description || rec.key.action_type?.name || 'סוג פעולה לא ידוע'} |{' '}
                    {rec.key.material?.name || 'חומר לא ידוע'}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(key)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rec.values.map((value) => (
                    <div
                      key={value.id}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <span>
                        {value.unit_type?.description || value.unit_type?.name || 'יחידה לא ידוע'}:{' '}
                        <strong>{value.dosage}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredRecommendations.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {hasActiveFilters
                ? 'לא נמצאו המלצות התואמות לסינון. נסה לשנות את הסינון.'
                : 'אין המלצות. לחץ על "הוסף המלצה חדשה" כדי להתחיל.'}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingKey ? 'עריכת המלצה' : 'המלצה חדשה'}
            </DialogTitle>
            <DialogDescription>
              בחר גידול, סוג פעולה וחומר, והוסף מינונים מומלצים
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>גידול</Label>
                <Select
                  value={form.watch('crop_id')}
                  onValueChange={(value) => form.setValue('crop_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר גידול" />
                  </SelectTrigger>
                  <SelectContent>
                    {crops.map((crop) => (
                      <SelectItem key={crop.id} value={crop.id}>
                        {crop.description || crop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.crop_id && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.crop_id.message}
                  </p>
                )}
              </div>

              <div>
                <Label>סוג פעולה</Label>
                <Select
                  value={form.watch('action_type_id')}
                  onValueChange={(value) => form.setValue('action_type_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר סוג פעולה" />
                  </SelectTrigger>
                  <SelectContent>
                    {actionTypes.map((at) => (
                      <SelectItem key={at.id} value={at.id}>
                        {at.description || at.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.action_type_id && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.action_type_id.message}
                  </p>
                )}
              </div>

              <div>
                <Label>חומר</Label>
                <Select
                  value={form.watch('material_id')}
                  onValueChange={(value) => form.setValue('material_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר חומר" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.description || material.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.material_id && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.material_id.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>מינונים מומלצים</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ unit_type_id: '', dosage: '' })}
                >
                  <Plus className="h-4 w-4 ml-2" />
                  הוסף מינון
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>סוג יחידה</Label>
                    <Select
                      value={form.watch(`dosages.${index}.unit_type_id`)}
                      onValueChange={(value) =>
                        form.setValue(`dosages.${index}.unit_type_id`, value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="בחר יחידה" />
                      </SelectTrigger>
                      <SelectContent>
                        {unitTypes.map((ut) => (
                          <SelectItem key={ut.id} value={ut.id}>
                            {ut.description || ut.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.dosages?.[index]?.unit_type_id && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.dosages[index]?.unit_type_id?.message}
                      </p>
                    )}
                  </div>

                  <div className="flex-1">
                    <Label>מינון</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="מינון"
                      {...form.register(`dosages.${index}.dosage`)}
                    />
                    {form.formState.errors.dosages?.[index]?.dosage && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.dosages[index]?.dosage?.message}
                      </p>
                    )}
                  </div>

                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              {form.formState.errors.dosages && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.dosages.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                ביטול
              </Button>
              <Button type="submit">שמור</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
