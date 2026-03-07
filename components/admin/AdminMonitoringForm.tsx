'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSubAreaLabel } from '@/lib/utils';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2 } from 'lucide-react';
import { ENTIRE_AREA, ENTIRE_AREA_DISPLAY } from '@/lib/constants';

const subAreaEntrySchema = z.object({
  sub_area_id: z.string().min(1, 'נדרש לבחור תת-שטח'),
  crop_id: z.string().optional(),
  crop_name: z.string().optional(),
  finding_id: z.string().min(1, 'נדרש לבחור ממצא'),
  action_type_id: z.string().min(1, 'נדרש לבחור סוג פעולה'),
  material_id: z.string().min(1, 'נדרש לבחור חומר'),
  dosage: z.string().min(1, 'נדרש להזין מינון'),
  unit_type_id: z.string().min(1, 'נדרש לבחור יחידת מידה'),
});

const monitoringSchema = z.object({
  customer_id: z.string().min(1, 'נדרש לבחור לקוח'),
  inspector_id: z.string().min(1, 'נדרש לבחור פקח'),
  area_id: z.string().min(1, 'נדרש לבחור שטח'),
  entries: z.array(subAreaEntrySchema).min(1, 'נדרשת לפחות רשומה אחת'),
});

type MonitoringFormData = z.infer<typeof monitoringSchema>;

interface AdminMonitoringFormProps {
  customers: any[];
  unitTypes: any[];
}

export function AdminMonitoringForm({
  customers,
  unitTypes,
}: AdminMonitoringFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Loaded data states
  const [inspectors, setInspectors] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [subAreas, setSubAreas] = useState<any[]>([]);

  // Entry-specific cascade data (indexed by entry index)
  const [entryFindings, setEntryFindings] = useState<Record<number, any[]>>({});
  const [entryActionTypes, setEntryActionTypes] = useState<Record<number, any[]>>({});
  const [entryMaterials, setEntryMaterials] = useState<Record<number, any[]>>({});

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
      entries: [
        {
          sub_area_id: '',
          crop_id: '',
          crop_name: '',
          finding_id: '',
          action_type_id: '',
          material_id: '',
          dosage: '',
          unit_type_id: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'entries',
  });

  const watchCustomerId = form.watch('customer_id');
  const watchAreaId = form.watch('area_id');

  // Fetch inspectors when customer changes
  useEffect(() => {
    if (watchCustomerId) {
      fetchInspectors(watchCustomerId);
      fetchAreas(watchCustomerId);
      // Reset dependent fields
      form.setValue('inspector_id', '');
      form.setValue('area_id', '');
      setSubAreas([]);
      resetAllEntries();
    }
  }, [watchCustomerId]);

  // Fetch sub-areas when area changes
  useEffect(() => {
    if (watchAreaId) {
      fetchSubAreas(watchAreaId);
      resetAllEntries();
    }
  }, [watchAreaId]);

  const resetAllEntries = () => {
    form.setValue('entries', [
      {
        sub_area_id: '',
        crop_id: '',
        crop_name: '',
        finding_id: '',
        action_type_id: '',
        material_id: '',
        dosage: '',
        unit_type_id: '',
      },
    ]);
    setEntryFindings({});
    setEntryActionTypes({});
    setEntryMaterials({});
  };

  const fetchInspectors = async (customerId: string) => {
    setLoadingInspectors(true);
    try {
      const response = await fetch(`/api/workers?customerId=${customerId}&type=inspector`);
      if (response.ok) {
        const data = await response.json();
        setInspectors(data);
      }
    } catch (err) {
      console.error('Error fetching inspectors:', err);
    } finally {
      setLoadingInspectors(false);
    }
  };

  const fetchAreas = async (customerId: string) => {
    setLoadingAreas(true);
    try {
      const response = await fetch(`/api/areas?customerId=${customerId}`);
      if (response.ok) {
        const data = await response.json();
        setAreas(data);
      }
    } catch (err) {
      console.error('Error fetching areas:', err);
    } finally {
      setLoadingAreas(false);
    }
  };

  const fetchSubAreas = async (areaId: string) => {
    setLoadingSubAreas(true);
    try {
      const response = await fetch(`/api/sub-areas?areaId=${areaId}`);
      if (response.ok) {
        const data = await response.json();
        setSubAreas(data);
      }
    } catch (err) {
      console.error('Error fetching sub-areas:', err);
    } finally {
      setLoadingSubAreas(false);
    }
  };

  const fetchFindings = useCallback(async (cropId: string, entryIndex: number) => {
    try {
      const response = await fetch(`/api/cascade?type=findings&cropId=${cropId}`);
      if (response.ok) {
        const data = await response.json();
        setEntryFindings(prev => ({ ...prev, [entryIndex]: data }));
      }
    } catch (err) {
      console.error('Error fetching findings:', err);
    }
  }, []);

  const fetchActionTypes = useCallback(async (cropId: string, findingId: string, entryIndex: number) => {
    try {
      const response = await fetch(`/api/cascade?type=action_types&cropId=${cropId}&findingId=${findingId}`);
      if (response.ok) {
        const data = await response.json();
        setEntryActionTypes(prev => ({ ...prev, [entryIndex]: data }));
      }
    } catch (err) {
      console.error('Error fetching action types:', err);
    }
  }, []);

  const fetchMaterials = useCallback(async (cropId: string, findingId: string, actionTypeId: string, entryIndex: number) => {
    try {
      const response = await fetch(`/api/cascade?type=materials&cropId=${cropId}&findingId=${findingId}&actionTypeId=${actionTypeId}`);
      if (response.ok) {
        const data = await response.json();
        setEntryMaterials(prev => ({ ...prev, [entryIndex]: data }));
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
    }
  }, []);

  const fetchDosage = useCallback(async (cropId: string, findingId: string, actionTypeId: string, materialId: string, entryIndex: number) => {
    try {
      const response = await fetch(
        `/api/cascade?type=dosage&cropId=${cropId}&findingId=${findingId}&actionTypeId=${actionTypeId}&materialId=${materialId}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data) {
          form.setValue(`entries.${entryIndex}.dosage`, data.dosage || '');
          form.setValue(`entries.${entryIndex}.unit_type_id`, data.unit_type_id || '');
        }
      }
    } catch (err) {
      console.error('Error fetching dosage:', err);
    }
  }, [form]);

  const handleSubAreaChange = (subAreaId: string, entryIndex: number) => {
    const subArea = subAreas.find(sa => sa.id === subAreaId);
    if (subArea) {
      const cropId = subArea.effective_crop_id || subArea.crop_id;
      const cropName = subArea.effective_crop?.description || subArea.effective_crop?.name || '';

      form.setValue(`entries.${entryIndex}.sub_area_id`, subAreaId);
      form.setValue(`entries.${entryIndex}.crop_id`, cropId || '');
      form.setValue(`entries.${entryIndex}.crop_name`, cropName);

      // Reset dependent fields
      form.setValue(`entries.${entryIndex}.finding_id`, '');
      form.setValue(`entries.${entryIndex}.action_type_id`, '');
      form.setValue(`entries.${entryIndex}.material_id`, '');
      form.setValue(`entries.${entryIndex}.dosage`, '');
      form.setValue(`entries.${entryIndex}.unit_type_id`, '');

      // Clear cascade data
      setEntryActionTypes(prev => ({ ...prev, [entryIndex]: [] }));
      setEntryMaterials(prev => ({ ...prev, [entryIndex]: [] }));

      // Fetch findings for this crop
      if (cropId) {
        fetchFindings(cropId, entryIndex);
      }
    }
  };

  const handleFindingChange = (findingId: string, entryIndex: number) => {
    const cropId = form.getValues(`entries.${entryIndex}.crop_id`);
    form.setValue(`entries.${entryIndex}.finding_id`, findingId);

    // Reset dependent fields
    form.setValue(`entries.${entryIndex}.action_type_id`, '');
    form.setValue(`entries.${entryIndex}.material_id`, '');
    form.setValue(`entries.${entryIndex}.dosage`, '');
    form.setValue(`entries.${entryIndex}.unit_type_id`, '');

    // Clear cascade data
    setEntryMaterials(prev => ({ ...prev, [entryIndex]: [] }));

    if (cropId && findingId) {
      fetchActionTypes(cropId, findingId, entryIndex);
    }
  };

  const handleActionTypeChange = (actionTypeId: string, entryIndex: number) => {
    const cropId = form.getValues(`entries.${entryIndex}.crop_id`);
    const findingId = form.getValues(`entries.${entryIndex}.finding_id`);
    form.setValue(`entries.${entryIndex}.action_type_id`, actionTypeId);

    // Reset dependent fields
    form.setValue(`entries.${entryIndex}.material_id`, '');
    form.setValue(`entries.${entryIndex}.dosage`, '');
    form.setValue(`entries.${entryIndex}.unit_type_id`, '');

    if (cropId && findingId && actionTypeId) {
      fetchMaterials(cropId, findingId, actionTypeId, entryIndex);
    }
  };

  const handleMaterialChange = (materialId: string, entryIndex: number) => {
    const cropId = form.getValues(`entries.${entryIndex}.crop_id`);
    const findingId = form.getValues(`entries.${entryIndex}.finding_id`);
    const actionTypeId = form.getValues(`entries.${entryIndex}.action_type_id`);
    form.setValue(`entries.${entryIndex}.material_id`, materialId);

    if (cropId && findingId && actionTypeId && materialId) {
      fetchDosage(cropId, findingId, actionTypeId, materialId, entryIndex);
    }
  };

  const addEntry = () => {
    append({
      sub_area_id: '',
      crop_id: '',
      crop_name: '',
      finding_id: '',
      action_type_id: '',
      material_id: '',
      dosage: '',
      unit_type_id: '',
    });
  };

  const onSubmit = async (data: MonitoringFormData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // First, get or create a report_area for monitoring
      const area = areas.find(a => a.id === data.area_id);
      let reportAreaId: string;

      // Check if report_area exists for this area
      const reportAreaRes = await fetch(`/api/report-areas?areaId=${data.area_id}&type=monitoring`);
      if (reportAreaRes.ok) {
        const reportAreas = await reportAreaRes.json();
        if (reportAreas.length > 0) {
          reportAreaId = reportAreas[0].id;
        } else {
          // Create new report_area
          const createRes = await fetch('/api/report-areas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              area_id: data.area_id,
              type: 'monitoring',
              name: `דוח ניטור - ${area?.name || 'שטח'}`,
              description: `דוח ניטור שנוצר ע"י מנהל`,
            }),
          });
          if (!createRes.ok) {
            throw new Error('שגיאה ביצירת אזור דוח');
          }
          const newReportArea = await createRes.json();
          reportAreaId = newReportArea.id;
        }
      } else {
        throw new Error('שגיאה בבדיקת אזור דוח');
      }

      // Create monitoring reports for each entry
      for (const entry of data.entries) {
        const material = entryMaterials[data.entries.indexOf(entry)]?.find(
          (m: any) => m.id === entry.material_id
        );

        const response = await fetch('/api/monitoring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            area_report_id: reportAreaId,
            sub_area_id: entry.sub_area_id === ENTIRE_AREA ? null : entry.sub_area_id,
            finding_id: entry.finding_id,
            recommend_material: material?.description || material?.name || '',
            recommend_dosage: entry.dosage,
            recommend_unit_type_id: entry.unit_type_id,
            recommend_action_type_id: entry.action_type_id,
            status: 'pending',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'שגיאה בשמירת הדוח');
        }
      }

      setSuccess(true);
      form.reset();
      setInspectors([]);
      setAreas([]);
      setSubAreas([]);
      setEntryFindings({});
      setEntryActionTypes({});
      setEntryMaterials({});

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>טופס ניטור מנהל - רשומות מרובות</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <AlertDescription>הדוחות נשמרו בהצלחה!</AlertDescription>
              </Alert>
            )}

            {/* Customer Selection */}
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>לקוח</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
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

            {/* Inspector Selection */}
            <FormField
              control={form.control}
              name="inspector_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>פקח</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!watchCustomerId || loadingInspectors}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingInspectors
                              ? 'טוען פקחים...'
                              : !watchCustomerId
                                ? 'בחר תחילה לקוח'
                                : 'בחר פקח'
                          }
                        />
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

            {/* Area Selection */}
            <FormField
              control={form.control}
              name="area_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שטח</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!watchCustomerId || loadingAreas}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingAreas
                              ? 'טוען שטחים...'
                              : !watchCustomerId
                                ? 'בחר תחילה לקוח'
                                : 'בחר שטח'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {areas.map((area) => {
                        const cropName = area.crops?.name;
                        const variety = area.variety;
                        const cropLabel = cropName
                          ? variety ? `${cropName}, ${variety}` : cropName
                          : 'ללא גידול';
                        return (
                          <SelectItem key={area.id} value={area.id}>
                            {`${area.name} (${cropLabel})`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Sub-area entries */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">רשומות תת-שטח</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEntry}
                  disabled={!watchAreaId || loadingSubAreas}
                >
                  <Plus className="h-4 w-4 me-2" />
                  הוסף תת-שטח
                </Button>
              </div>

              {fields.map((field, index) => (
                <Card key={field.id} className="p-4">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">רשומה {index + 1}</span>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Sub-area */}
                      <FormField
                        control={form.control}
                        name={`entries.${index}.sub_area_id`}
                        render={({ field: subField }) => (
                          <FormItem>
                            <FormLabel>תת-שטח</FormLabel>
                            <Select
                              onValueChange={(value) => handleSubAreaChange(value, index)}
                              value={subField.value}
                              disabled={!watchAreaId || loadingSubAreas}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={
                                      loadingSubAreas
                                        ? 'טוען...'
                                        : !watchAreaId
                                          ? 'בחר תחילה שטח'
                                          : 'בחר תת-שטח'
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={ENTIRE_AREA}>
                                  {ENTIRE_AREA_DISPLAY}
                                </SelectItem>
                                {subAreas.map((subArea) => {
                                  const selectedArea = areas.find(a => a.id === watchAreaId);
                                  return (
                                    <SelectItem key={subArea.id} value={subArea.id}>
                                      {getSubAreaLabel(subArea, selectedArea?.crops?.name, selectedArea?.variety)}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Crop (auto-filled, read-only) */}
                      <FormField
                        control={form.control}
                        name={`entries.${index}.crop_name`}
                        render={({ field: cropField }) => (
                          <FormItem>
                            <FormLabel>גידול</FormLabel>
                            <FormControl>
                              <Input
                                value={cropField.value || ''}
                                readOnly
                                placeholder="ייבחר אוטומטית"
                                className="bg-muted"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {/* Finding */}
                      <FormField
                        control={form.control}
                        name={`entries.${index}.finding_id`}
                        render={({ field: findingField }) => (
                          <FormItem>
                            <FormLabel>ממצא</FormLabel>
                            <Select
                              onValueChange={(value) => handleFindingChange(value, index)}
                              value={findingField.value}
                              disabled={!form.watch(`entries.${index}.crop_id`)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={
                                      !form.watch(`entries.${index}.crop_id`)
                                        ? 'בחר תחילה תת-שטח'
                                        : 'בחר ממצא'
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {[...(entryFindings[index] || [])].sort((a: any, b: any) => (a.description || a.name || '').localeCompare(b.description || b.name || '', 'he')).map((finding: any) => (
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

                      {/* Action Type */}
                      <FormField
                        control={form.control}
                        name={`entries.${index}.action_type_id`}
                        render={({ field: actionField }) => (
                          <FormItem>
                            <FormLabel>סוג פעולה</FormLabel>
                            <Select
                              onValueChange={(value) => handleActionTypeChange(value, index)}
                              value={actionField.value}
                              disabled={!form.watch(`entries.${index}.finding_id`)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={
                                      !form.watch(`entries.${index}.finding_id`)
                                        ? 'בחר תחילה ממצא'
                                        : 'בחר סוג פעולה'
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(entryActionTypes[index] || []).map((actionType: any) => (
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

                      {/* Material */}
                      <FormField
                        control={form.control}
                        name={`entries.${index}.material_id`}
                        render={({ field: materialField }) => (
                          <FormItem>
                            <FormLabel>חומר</FormLabel>
                            <Select
                              onValueChange={(value) => handleMaterialChange(value, index)}
                              value={materialField.value}
                              disabled={!form.watch(`entries.${index}.action_type_id`)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={
                                      !form.watch(`entries.${index}.action_type_id`)
                                        ? 'בחר תחילה סוג פעולה'
                                        : 'בחר חומר'
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(entryMaterials[index] || []).map((material: any) => (
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

                      {/* Dosage */}
                      <FormField
                        control={form.control}
                        name={`entries.${index}.dosage`}
                        render={({ field: dosageField }) => (
                          <FormItem>
                            <FormLabel>מינון</FormLabel>
                            <FormControl>
                              <Input
                                {...dosageField}
                                placeholder="מינון"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Unit Type */}
                      <FormField
                        control={form.control}
                        name={`entries.${index}.unit_type_id`}
                        render={({ field: unitField }) => (
                          <FormItem>
                            <FormLabel>יחידת מידה</FormLabel>
                            <Select
                              onValueChange={unitField.onChange}
                              value={unitField.value}
                            >
                              <FormControl>
                                <SelectTrigger>
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
                  </div>
                </Card>
              ))}
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'שומר...' : 'שמור דוח ניטור'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
