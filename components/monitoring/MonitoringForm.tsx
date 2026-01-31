'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Trash2 } from 'lucide-react';

const subAreaEntrySchema = z.object({
  sub_area_id: z.string().min(1, 'נדרש לבחור תת-שטח'),
  finding_id: z.string().min(1, 'נדרש לבחור ממצא'),
  recommend_action_type_id: z.string().optional(),
  recommend_material_id: z.string().optional(),
  recommend_dosage: z.string().optional(),
  recommend_unit_type_id: z.string().optional(),
});

const monitoringSchema = z.object({
  customer_id: z.string().min(1, 'נדרש לבחור לקוח'),
  inspector_id: z.string().min(1, 'נדרש לבחור פקח'),
  area_id: z.string().min(1, 'נדרש לבחור אזור'),
  entries: z.array(subAreaEntrySchema).min(1, 'נדרשת לפחות רשומה אחת'),
});

type MonitoringFormData = z.infer<typeof monitoringSchema>;

interface MonitoringFormProps {
  customers: any[];
  findings: any[];
  unitTypes: any[];
}

export function MonitoringForm({
  customers,
  findings,
  unitTypes,
}: MonitoringFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Dynamic data states
  const [inspectors, setInspectors] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [subAreas, setSubAreas] = useState<any[]>([]);

  // Per-entry indexed state for cascade data
  const [entryActionTypes, setEntryActionTypes] = useState<Record<number, any[]>>({});
  const [entryMaterials, setEntryMaterials] = useState<Record<number, any[]>>({});
  const [entryCropIds, setEntryCropIds] = useState<Record<number, string | null>>({});
  const [entryRecommendedDosage, setEntryRecommendedDosage] = useState<Record<number, string>>({});
  const [entryRecommendedUnitTypeId, setEntryRecommendedUnitTypeId] = useState<Record<number, string>>({});

  // Per-entry loading states
  const [entryLoadingActionTypes, setEntryLoadingActionTypes] = useState<Record<number, boolean>>({});
  const [entryLoadingMaterials, setEntryLoadingMaterials] = useState<Record<number, boolean>>({});

  // Loading states
  const [loadingInspectors, setLoadingInspectors] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingSubAreas, setLoadingSubAreas] = useState(false);

  const form = useForm<MonitoringFormData>({
    resolver: zodResolver(monitoringSchema),
    defaultValues: {
      customer_id: '',
      inspector_id: '',
      area_id: '',
      entries: [{
        sub_area_id: '',
        finding_id: '',
        recommend_action_type_id: '',
        recommend_material_id: '',
        recommend_dosage: '',
        recommend_unit_type_id: '',
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'entries',
  });

  const watchedCustomerId = form.watch('customer_id');
  const watchedAreaId = form.watch('area_id');

  // Fetch inspectors and areas when customer changes
  useEffect(() => {
    if (watchedCustomerId) {
      fetchInspectorsAndAreas(watchedCustomerId);
      // Reset dependent fields
      form.setValue('inspector_id', '');
      form.setValue('area_id', '');
      form.setValue('entries', [{
        sub_area_id: '',
        finding_id: '',
        recommend_action_type_id: '',
        recommend_material_id: '',
        recommend_dosage: '',
        recommend_unit_type_id: '',
      }]);
      setSubAreas([]);
      resetAllEntryState();
    } else {
      setInspectors([]);
      setAreas([]);
    }
  }, [watchedCustomerId]);

  // Fetch sub-areas when area changes
  useEffect(() => {
    if (watchedAreaId) {
      fetchSubAreas(watchedAreaId);
      // Reset all entries when area changes
      form.setValue('entries', [{
        sub_area_id: '',
        finding_id: '',
        recommend_action_type_id: '',
        recommend_material_id: '',
        recommend_dosage: '',
        recommend_unit_type_id: '',
      }]);
      resetAllEntryState();
    } else {
      setSubAreas([]);
      resetAllEntryState();
    }
  }, [watchedAreaId]);

  const resetAllEntryState = () => {
    setEntryCropIds({});
    setEntryActionTypes({});
    setEntryMaterials({});
    setEntryRecommendedDosage({});
    setEntryRecommendedUnitTypeId({});
    setEntryLoadingActionTypes({});
    setEntryLoadingMaterials({});
  };

  const fetchInspectorsAndAreas = async (customerId: string) => {
    setLoadingInspectors(true);
    setLoadingAreas(true);
    try {
      const [inspectorsRes, areasRes] = await Promise.all([
        fetch(`/api/workers?customerId=${customerId}&type=inspector`),
        fetch(`/api/customer-areas?customerId=${customerId}`),
      ]);

      if (inspectorsRes.ok) {
        const data = await inspectorsRes.json();
        setInspectors(data);
      }
      if (areasRes.ok) {
        const data = await areasRes.json();
        // customer-areas returns { customer_id, area_id, areas: {...} }
        const areasList = data.map((ca: any) => ca.areas || ca).filter(Boolean);
        setAreas(areasList);
      }
    } catch (err) {
      console.error('Error fetching inspectors/areas:', err);
    } finally {
      setLoadingInspectors(false);
      setLoadingAreas(false);
    }
  };

  const fetchSubAreas = async (areaId: string) => {
    setLoadingSubAreas(true);
    try {
      const res = await fetch(`/api/sub-areas?areaId=${areaId}`);
      if (res.ok) {
        const data = await res.json();
        setSubAreas(data);
      }
    } catch (err) {
      console.error('Error fetching sub-areas:', err);
    } finally {
      setLoadingSubAreas(false);
    }
  };

  const fetchActionTypesForEntry = async (cropId: string, index: number) => {
    setEntryLoadingActionTypes(prev => ({ ...prev, [index]: true }));
    try {
      const res = await fetch(`/api/cascade?type=action_types&cropId=${cropId}`);
      if (res.ok) {
        const data = await res.json();
        setEntryActionTypes(prev => ({ ...prev, [index]: data }));
      }
    } catch (err) {
      console.error('Error fetching action types:', err);
    } finally {
      setEntryLoadingActionTypes(prev => ({ ...prev, [index]: false }));
    }
  };

  const fetchMaterialsForEntry = async (cropId: string, actionTypeId: string, index: number) => {
    setEntryLoadingMaterials(prev => ({ ...prev, [index]: true }));
    try {
      const res = await fetch(`/api/cascade?type=materials&cropId=${cropId}&actionTypeId=${actionTypeId}`);
      if (res.ok) {
        const data = await res.json();
        setEntryMaterials(prev => ({ ...prev, [index]: data }));
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
    } finally {
      setEntryLoadingMaterials(prev => ({ ...prev, [index]: false }));
    }
  };

  const fetchDosageForEntry = async (cropId: string, actionTypeId: string, materialId: string, index: number) => {
    try {
      const res = await fetch(`/api/cascade?type=dosage&cropId=${cropId}&actionTypeId=${actionTypeId}&materialId=${materialId}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setEntryRecommendedDosage(prev => ({ ...prev, [index]: data.dosage?.toString() || '' }));
          setEntryRecommendedUnitTypeId(prev => ({ ...prev, [index]: data.unit_type_id || '' }));
          form.setValue(`entries.${index}.recommend_dosage`, data.dosage?.toString() || '');
          form.setValue(`entries.${index}.recommend_unit_type_id`, data.unit_type_id || '');
        }
      }
    } catch (err) {
      console.error('Error fetching dosage:', err);
    }
  };

  // Entry-specific handlers
  const handleSubAreaChange = (subAreaId: string, index: number) => {
    const subArea = subAreas.find(sa => sa.id === subAreaId);
    const selectedArea = areas.find(a => a.id === watchedAreaId);
    const cropId = subArea?.crop_id || selectedArea?.crop_id;

    form.setValue(`entries.${index}.sub_area_id`, subAreaId);
    setEntryCropIds(prev => ({ ...prev, [index]: cropId || null }));

    // Reset dependent fields for this entry
    form.setValue(`entries.${index}.finding_id`, '');
    form.setValue(`entries.${index}.recommend_action_type_id`, '');
    form.setValue(`entries.${index}.recommend_material_id`, '');
    form.setValue(`entries.${index}.recommend_dosage`, '');
    form.setValue(`entries.${index}.recommend_unit_type_id`, '');

    setEntryActionTypes(prev => ({ ...prev, [index]: [] }));
    setEntryMaterials(prev => ({ ...prev, [index]: [] }));
    setEntryRecommendedDosage(prev => ({ ...prev, [index]: '' }));
    setEntryRecommendedUnitTypeId(prev => ({ ...prev, [index]: '' }));
  };

  const handleFindingChange = (findingId: string, index: number) => {
    form.setValue(`entries.${index}.finding_id`, findingId);
    const cropId = entryCropIds[index];

    // Reset dependent fields
    form.setValue(`entries.${index}.recommend_action_type_id`, '');
    form.setValue(`entries.${index}.recommend_material_id`, '');
    form.setValue(`entries.${index}.recommend_dosage`, '');
    form.setValue(`entries.${index}.recommend_unit_type_id`, '');
    setEntryMaterials(prev => ({ ...prev, [index]: [] }));
    setEntryRecommendedDosage(prev => ({ ...prev, [index]: '' }));
    setEntryRecommendedUnitTypeId(prev => ({ ...prev, [index]: '' }));

    if (findingId && cropId) {
      fetchActionTypesForEntry(cropId, index);
    } else {
      setEntryActionTypes(prev => ({ ...prev, [index]: [] }));
    }
  };

  const handleActionTypeChange = (actionTypeId: string, index: number) => {
    form.setValue(`entries.${index}.recommend_action_type_id`, actionTypeId);
    const cropId = entryCropIds[index];

    // Reset dependent fields
    form.setValue(`entries.${index}.recommend_material_id`, '');
    form.setValue(`entries.${index}.recommend_dosage`, '');
    form.setValue(`entries.${index}.recommend_unit_type_id`, '');
    setEntryRecommendedDosage(prev => ({ ...prev, [index]: '' }));
    setEntryRecommendedUnitTypeId(prev => ({ ...prev, [index]: '' }));

    if (cropId && actionTypeId) {
      fetchMaterialsForEntry(cropId, actionTypeId, index);
    } else {
      setEntryMaterials(prev => ({ ...prev, [index]: [] }));
    }
  };

  const handleMaterialChange = (materialId: string, index: number) => {
    form.setValue(`entries.${index}.recommend_material_id`, materialId);
    const cropId = entryCropIds[index];
    const actionTypeId = form.getValues(`entries.${index}.recommend_action_type_id`);

    if (cropId && actionTypeId && materialId) {
      fetchDosageForEntry(cropId, actionTypeId, materialId, index);
    }
  };

  const addEntry = () => {
    append({
      sub_area_id: '',
      finding_id: '',
      recommend_action_type_id: '',
      recommend_material_id: '',
      recommend_dosage: '',
      recommend_unit_type_id: '',
    });
  };

  const removeEntry = (index: number) => {
    remove(index);
    // Cleanup indexed state - rebuild without the removed index
    const rebuildState = <T,>(state: Record<number, T>): Record<number, T> => {
      const newState: Record<number, T> = {};
      Object.keys(state).forEach(key => {
        const keyNum = parseInt(key);
        if (keyNum < index) {
          newState[keyNum] = state[keyNum];
        } else if (keyNum > index) {
          newState[keyNum - 1] = state[keyNum];
        }
      });
      return newState;
    };

    setEntryCropIds(rebuildState);
    setEntryActionTypes(rebuildState);
    setEntryMaterials(rebuildState);
    setEntryRecommendedDosage(rebuildState);
    setEntryRecommendedUnitTypeId(rebuildState);
    setEntryLoadingActionTypes(rebuildState);
    setEntryLoadingMaterials(rebuildState);
  };

  const onSubmit = async (data: MonitoringFormData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: data.customer_id,
          inspector_id: data.inspector_id,
          area_id: data.area_id,
          entries: data.entries,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בשמירת הדוח');
      }

      setSuccess(true);
      form.reset();
      setInspectors([]);
      setAreas([]);
      setSubAreas([]);
      resetAllEntryState();

      setTimeout(() => {
        setSuccess(false);
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const LoadingSpinner = () => <Loader2 className="h-4 w-4 animate-spin inline ms-2" />;

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader className="border-b bg-muted/50">
        <CardTitle className="text-2xl">טופס ניטור חדש</CardTitle>
        <CardDescription>מלא את פרטי הניטור עבור האזור הנבחר</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-500 bg-green-50 text-green-700">
                <AlertDescription>הדוח נשמר בהצלחה!</AlertDescription>
              </Alert>
            )}

            {/* Section 1: Customer & Inspector Selection */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <h3 className="font-semibold text-lg border-b pb-2">פרטי לקוח ופקח</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">לקוח *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="בחר לקוח" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="inspector_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        פקח *
                        {loadingInspectors && <LoadingSpinner />}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!watchedCustomerId || loadingInspectors}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={
                              !watchedCustomerId ? 'בחר לקוח תחילה' : 'בחר פקח'
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {inspectors.map((inspector) => (
                            <SelectItem key={inspector.id} value={inspector.id}>
                              {inspector.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section 2: Area Selection */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <h3 className="font-semibold text-lg border-b pb-2">אזור</h3>
              <FormField
                control={form.control}
                name="area_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">
                      אזור *
                      {loadingAreas && <LoadingSpinner />}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!watchedCustomerId || loadingAreas}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder={
                            !watchedCustomerId ? 'בחר לקוח תחילה' : 'בחר אזור'
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {areas.map((area) => (
                          <SelectItem key={area.id} value={area.id}>
                            {area.name}
                            {area.crops?.name && ` (${area.crops.description || area.crops.name})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Section 3: Sub-Area Entries */}
            {watchedAreaId && (
              <div className="space-y-4 p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-semibold text-lg">רשומות תת-שטח</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addEntry}>
                    <Plus className="h-4 w-4 me-2" />
                    הוסף רשומה
                  </Button>
                </div>

                {fields.map((field, index) => {
                  const entrySubAreaId = form.watch(`entries.${index}.sub_area_id`);
                  const entryFindingId = form.watch(`entries.${index}.finding_id`);
                  const entryActionTypeId = form.watch(`entries.${index}.recommend_action_type_id`);
                  const cropId = entryCropIds[index];

                  return (
                    <Card key={field.id} className="p-4 space-y-4 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-muted-foreground">רשומה {index + 1}</span>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEntry(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Sub-area select */}
                        <FormField
                          control={form.control}
                          name={`entries.${index}.sub_area_id`}
                          render={({ field: subField }) => (
                            <FormItem>
                              <FormLabel className="font-medium">
                                תת-שטח *
                                {loadingSubAreas && <LoadingSpinner />}
                              </FormLabel>
                              <Select
                                onValueChange={(v) => handleSubAreaChange(v, index)}
                                value={subField.value}
                                disabled={loadingSubAreas}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder="בחר תת-שטח" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {subAreas.map((subArea) => (
                                    <SelectItem key={subArea.id} value={subArea.id}>
                                      {subArea.display || subArea.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Finding select */}
                        <FormField
                          control={form.control}
                          name={`entries.${index}.finding_id`}
                          render={({ field: findingField }) => (
                            <FormItem>
                              <FormLabel className="font-medium">ממצא *</FormLabel>
                              <Select
                                onValueChange={(v) => handleFindingChange(v, index)}
                                value={findingField.value}
                                disabled={!entrySubAreaId}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder={
                                      !entrySubAreaId ? 'בחר תת-שטח תחילה' : 'בחר ממצא'
                                    } />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {findings.map((finding) => (
                                    <SelectItem key={finding.id} value={finding.id}>
                                      {finding.description || finding.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Action type select */}
                        <FormField
                          control={form.control}
                          name={`entries.${index}.recommend_action_type_id`}
                          render={({ field: actionField }) => (
                            <FormItem>
                              <FormLabel className="font-medium">
                                סוג פעולה
                                {entryLoadingActionTypes[index] && <LoadingSpinner />}
                              </FormLabel>
                              <Select
                                onValueChange={(v) => handleActionTypeChange(v, index)}
                                value={actionField.value}
                                disabled={!entryFindingId || !cropId || entryLoadingActionTypes[index]}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder={
                                      !entryFindingId
                                        ? 'בחר ממצא תחילה'
                                        : !cropId
                                        ? 'אין גידול מוגדר'
                                        : 'בחר סוג פעולה'
                                    } />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {(entryActionTypes[index] || []).map((actionType) => (
                                    <SelectItem key={actionType.id} value={actionType.id}>
                                      {actionType.description || actionType.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Material select */}
                        <FormField
                          control={form.control}
                          name={`entries.${index}.recommend_material_id`}
                          render={({ field: materialField }) => (
                            <FormItem>
                              <FormLabel className="font-medium">
                                חומר מומלץ
                                {entryLoadingMaterials[index] && <LoadingSpinner />}
                              </FormLabel>
                              <Select
                                onValueChange={(v) => handleMaterialChange(v, index)}
                                value={materialField.value}
                                disabled={!entryActionTypeId || entryLoadingMaterials[index]}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder={
                                      !entryActionTypeId ? 'בחר סוג פעולה תחילה' : 'בחר חומר'
                                    } />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {(entryMaterials[index] || []).map((material) => (
                                    <SelectItem key={material.id} value={material.id}>
                                      {material.description || material.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Dosage input */}
                        <FormField
                          control={form.control}
                          name={`entries.${index}.recommend_dosage`}
                          render={({ field: dosageField }) => (
                            <FormItem>
                              <FormLabel className="font-medium">מינון</FormLabel>
                              <FormControl>
                                <Input
                                  {...dosageField}
                                  value={dosageField.value || ''}
                                  placeholder={
                                    entryRecommendedDosage[index]
                                      ? `מומלץ: ${entryRecommendedDosage[index]}`
                                      : 'הזן מינון'
                                  }
                                  className="h-11"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Unit type select */}
                        <FormField
                          control={form.control}
                          name={`entries.${index}.recommend_unit_type_id`}
                          render={({ field: unitField }) => (
                            <FormItem>
                              <FormLabel className="font-medium">יחידת מידה</FormLabel>
                              <Select onValueChange={unitField.onChange} value={unitField.value}>
                                <FormControl>
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder="בחר יחידת מידה" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {unitTypes.map((unit) => (
                                    <SelectItem key={unit.id} value={unit.id}>
                                      {unit.description || unit.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-lg font-medium"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin me-2" />
                  שומר...
                </>
              ) : (
                'שמור דוח ניטור'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
