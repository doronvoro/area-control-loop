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
import { ENTIRE_AREA, ENTIRE_AREA_DISPLAY, ACTION_STATUS_OPTIONS } from '@/lib/constants';

const subAreaEntrySchema = z.object({
  source: z.enum(['monitoring', 'standalone']),
  monitoring_report_id: z.string().optional(),
  sub_area_id: z.string().min(1, 'נדרש לבחור תת-שטח'),
  sub_area_display: z.string().optional(),
  finding_id: z.string().min(1, 'נדרש לבחור ממצא'),
  finding_name: z.string().optional(),
  crop_id: z.string().optional(),
  action_type_id: z.string().min(1, 'נדרש לבחור סוג פעולה'),
  material_id: z.string().optional(),
  material: z.string().min(1, 'נדרש להזין חומר'),
  dosage: z.string().min(1, 'נדרש להזין מינון'),
  unit_type_id: z.string().min(1, 'נדרש לבחור יחידת מידה'),
  status: z.string(),
});

const actionSchema = z.object({
  customer_id: z.string().min(1, 'נדרש לבחור לקוח'),
  worker_id: z.string().min(1, 'נדרש לבחור עובד פעולה'),
  area_id: z.string().min(1, 'נדרש לבחור שטח'),
  entries: z.array(subAreaEntrySchema).min(1, 'נדרשת לפחות רשומה אחת'),
});

type ActionFormData = z.infer<typeof actionSchema>;

interface AdminActionFormProps {
  customers: any[];
  findings: any[];
  actionTypes: any[];
  unitTypes: any[];
}

const statusOptions = ACTION_STATUS_OPTIONS;

export function AdminActionForm({
  customers,
  findings,
  actionTypes,
  unitTypes,
}: AdminActionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Loaded data states
  const [actionWorkers, setActionWorkers] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [subAreas, setSubAreas] = useState<any[]>([]);

  // Entry-specific cascade data (indexed by entry index)
  const [entryActionTypes, setEntryActionTypes] = useState<Record<number, any[]>>({});
  const [entryMaterials, setEntryMaterials] = useState<Record<number, any[]>>({});

  // Loading states
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingSubAreas, setLoadingSubAreas] = useState(false);

  const form = useForm<ActionFormData>({
    resolver: zodResolver(actionSchema),
    defaultValues: {
      customer_id: '',
      worker_id: '',
      area_id: '',
      entries: [
        {
          source: 'standalone',
          sub_area_id: '',
          sub_area_display: '',
          finding_id: '',
          finding_name: '',
          crop_id: '',
          action_type_id: '',
          material_id: '',
          material: '',
          dosage: '',
          unit_type_id: '',
          status: 'planned',
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

  // Fetch workers and areas when customer changes
  useEffect(() => {
    if (watchCustomerId) {
      fetchActionWorkers(watchCustomerId);
      fetchAreas(watchCustomerId);
      // Reset dependent fields
      form.setValue('worker_id', '');
      form.setValue('area_id', '');
      setSubAreas([]);
      resetAllEntries();
    }
  }, [watchCustomerId]);

  // Fetch sub-areas and monitoring reports when area changes
  useEffect(() => {
    if (watchAreaId) {
      fetchSubAreasAndMonitoring(watchAreaId);
    }
  }, [watchAreaId]);

  const resetAllEntries = () => {
    form.setValue('entries', [
      {
        source: 'standalone',
        sub_area_id: '',
        sub_area_display: '',
        finding_id: '',
        finding_name: '',
        crop_id: '',
        action_type_id: '',
        material_id: '',
        material: '',
        dosage: '',
        unit_type_id: '',
        status: 'planned',
      },
    ]);
    setEntryActionTypes({});
    setEntryMaterials({});
  };

  const fetchActionWorkers = async (customerId: string) => {
    setLoadingWorkers(true);
    try {
      const response = await fetch(`/api/workers?customerId=${customerId}&type=action_worker`);
      if (response.ok) {
        const data = await response.json();
        setActionWorkers(data);
      }
    } catch (err) {
      console.error('Error fetching action workers:', err);
    } finally {
      setLoadingWorkers(false);
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

  const fetchSubAreasAndMonitoring = async (areaId: string) => {
    setLoadingSubAreas(true);
    try {
      // Fetch both sub-areas and monitoring reports
      const [subAreasRes, monitoringRes] = await Promise.all([
        fetch(`/api/sub-areas?areaId=${areaId}`),
        fetch(`/api/monitoring/by-area-for-actions?areaId=${areaId}`),
      ]);

      if (subAreasRes.ok) {
        const subAreasData = await subAreasRes.json();
        setSubAreas(subAreasData);
      }

      if (monitoringRes.ok) {
        const monitoringData = await monitoringRes.json();
        populateFromMonitoring(monitoringData);
      } else {
        resetAllEntries();
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      resetAllEntries();
    } finally {
      setLoadingSubAreas(false);
    }
  };

  const populateFromMonitoring = (reports: any[]) => {
    if (reports.length === 0) {
      resetAllEntries();
      return;
    }

    const entries = reports
      .filter((r: any) => !r.already_has_action)
      .map((report: any) => ({
        source: 'monitoring' as const,
        monitoring_report_id: report.monitoring_report_id,
        sub_area_id: report.sub_area_id || ENTIRE_AREA,
        sub_area_display: report.sub_area_display || report.sub_area_name || ENTIRE_AREA_DISPLAY,
        finding_id: report.finding_id,
        finding_name: report.finding_name,
        crop_id: report.effective_crop_id || '',
        action_type_id: report.recommend_action_type_id || '',
        material_id: report.recommend_material_id || '',
        material: report.recommend_material_name || '',
        dosage: report.recommend_dosage?.toString() || '',
        unit_type_id: report.recommend_unit_type_id || '',
        status: 'planned',
      }));

    if (entries.length > 0) {
      form.setValue('entries', entries);
      // Pre-load cascade data for each entry
      entries.forEach((entry: any, index: number) => {
        if (entry.crop_id && entry.finding_id) {
          fetchActionTypes(entry.crop_id, entry.finding_id, index);
          if (entry.action_type_id) {
            fetchMaterials(entry.crop_id, entry.finding_id, entry.action_type_id, index);
          }
        }
      });
    } else {
      resetAllEntries();
    }
  };

  const fetchActionTypes = useCallback(async (cropId: string, findingId: string, entryIndex: number) => {
    try {
      const response = await fetch(`/api/cascade?type=action_types&cropId=${cropId}&findingId=${findingId}`);
      if (response.ok) {
        const data = await response.json();
        setEntryActionTypes((prev) => ({ ...prev, [entryIndex]: data }));
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
        setEntryMaterials((prev) => ({ ...prev, [entryIndex]: data }));
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
          form.setValue(`entries.${entryIndex}.dosage`, data.dosage?.toString() || '');
          form.setValue(`entries.${entryIndex}.unit_type_id`, data.unit_type_id || '');
        }
      }
    } catch (err) {
      console.error('Error fetching dosage:', err);
    }
  }, [form]);

  const handleSubAreaChange = (subAreaId: string, entryIndex: number) => {
    const subArea = subAreas.find((sa) => sa.id === subAreaId);
    if (subArea) {
      const cropId = subArea.effective_crop_id || subArea.crop_id;

      form.setValue(`entries.${entryIndex}.sub_area_id`, subAreaId);
      form.setValue(`entries.${entryIndex}.sub_area_display`, subArea.display || subArea.name);
      form.setValue(`entries.${entryIndex}.crop_id`, cropId || '');

      // Reset dependent fields
      form.setValue(`entries.${entryIndex}.finding_id`, '');
      form.setValue(`entries.${entryIndex}.finding_name`, '');
      form.setValue(`entries.${entryIndex}.action_type_id`, '');
      form.setValue(`entries.${entryIndex}.material_id`, '');
      form.setValue(`entries.${entryIndex}.material`, '');
      form.setValue(`entries.${entryIndex}.dosage`, '');
      form.setValue(`entries.${entryIndex}.unit_type_id`, '');

      // Clear cascade data
      setEntryActionTypes((prev) => ({ ...prev, [entryIndex]: [] }));
      setEntryMaterials((prev) => ({ ...prev, [entryIndex]: [] }));
    }
  };

  const handleFindingChange = (findingId: string, entryIndex: number) => {
    const cropId = form.getValues(`entries.${entryIndex}.crop_id`);
    const finding = findings.find((f) => f.id === findingId);

    form.setValue(`entries.${entryIndex}.finding_id`, findingId);
    form.setValue(`entries.${entryIndex}.finding_name`, finding?.name || '');

    // Reset dependent fields
    form.setValue(`entries.${entryIndex}.action_type_id`, '');
    form.setValue(`entries.${entryIndex}.material_id`, '');
    form.setValue(`entries.${entryIndex}.material`, '');
    form.setValue(`entries.${entryIndex}.dosage`, '');
    form.setValue(`entries.${entryIndex}.unit_type_id`, '');

    // Clear cascade data
    setEntryMaterials((prev) => ({ ...prev, [entryIndex]: [] }));

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
    form.setValue(`entries.${entryIndex}.material`, '');
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
    const materials = entryMaterials[entryIndex] || [];
    const material = materials.find((m: any) => m.id === materialId);

    form.setValue(`entries.${entryIndex}.material_id`, materialId);
    form.setValue(`entries.${entryIndex}.material`, material?.description || material?.name || '');

    if (cropId && findingId && actionTypeId && materialId) {
      fetchDosage(cropId, findingId, actionTypeId, materialId, entryIndex);
    }
  };

  const addEntry = () => {
    append({
      source: 'standalone',
      sub_area_id: '',
      sub_area_display: '',
      finding_id: '',
      finding_name: '',
      crop_id: '',
      action_type_id: '',
      material_id: '',
      material: '',
      dosage: '',
      unit_type_id: '',
      status: 'planned',
    });
  };

  const onSubmit = async (data: ActionFormData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_id: data.area_id,
          worker_id: data.worker_id,
          entries: data.entries.map((entry) => ({
            sub_area_id: entry.sub_area_id === ENTIRE_AREA ? null : entry.sub_area_id,
            finding_id: entry.finding_id,
            action_type_id: entry.action_type_id,
            material: entry.material,
            dosage: entry.dosage,
            unit_type_id: entry.unit_type_id,
            status: entry.status,
            monitoring_report_id: entry.monitoring_report_id || null,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בשמירת הפעולות');
      }

      setSuccess(true);
      form.reset();
      setActionWorkers([]);
      setAreas([]);
      setSubAreas([]);
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
        <CardTitle>טופס פעולה מנהל - רשומות מרובות</CardTitle>
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
                <AlertDescription>הפעולות נשמרו בהצלחה!</AlertDescription>
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

            {/* Action Worker Selection */}
            <FormField
              control={form.control}
              name="worker_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>עובד פעולה</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!watchCustomerId || loadingWorkers}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingWorkers
                              ? 'טוען עובדים...'
                              : !watchCustomerId
                                ? 'בחר תחילה לקוח'
                                : 'בחר עובד פעולה'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {actionWorkers.map((worker) => (
                        <SelectItem key={worker.id} value={worker.id}>
                          {worker.name}
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
                  הוסף רשומה
                </Button>
              </div>

              {fields.map((field, index) => {
                const entry = form.watch(`entries.${index}`);
                const isFromMonitoring = entry?.source === 'monitoring';

                return (
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
                        {/* Sub-area - read-only for monitoring, editable for standalone */}
                        {isFromMonitoring ? (
                          <FormItem>
                            <FormLabel>תת-שטח</FormLabel>
                            <FormControl>
                              <Input
                                value={entry.sub_area_display || ''}
                                readOnly
                                className="bg-muted"
                              />
                            </FormControl>
                          </FormItem>
                        ) : (
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
                        )}

                        {/* Finding - read-only for monitoring, editable for standalone */}
                        {isFromMonitoring ? (
                          <FormItem>
                            <FormLabel>ממצא</FormLabel>
                            <FormControl>
                              <Input
                                value={entry.finding_name || ''}
                                readOnly
                                className="bg-muted"
                              />
                            </FormControl>
                          </FormItem>
                        ) : (
                          <FormField
                            control={form.control}
                            name={`entries.${index}.finding_id`}
                            render={({ field: findingField }) => (
                              <FormItem>
                                <FormLabel>ממצא</FormLabel>
                                <Select
                                  onValueChange={(value) => handleFindingChange(value, index)}
                                  value={findingField.value}
                                  disabled={!form.watch(`entries.${index}.sub_area_id`)}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue
                                        placeholder={
                                          !form.watch(`entries.${index}.sub_area_id`)
                                            ? 'בחר תחילה תת-שטח'
                                            : 'בחר ממצא'
                                        }
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {[...findings].sort((a, b) => (a.description || a.name || '').localeCompare(b.description || b.name || '', 'he')).map((finding) => (
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
                        )}

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
                                disabled={isFromMonitoring ? false : !form.watch(`entries.${index}.finding_id`)}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={
                                        !isFromMonitoring && !form.watch(`entries.${index}.finding_id`)
                                          ? 'בחר תחילה ממצא'
                                          : 'בחר סוג פעולה'
                                      }
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {(entryActionTypes[index]?.length > 0 ? entryActionTypes[index] : actionTypes).map((actionType: any) => (
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

                        {/* Material Selection */}
                        <FormField
                          control={form.control}
                          name={`entries.${index}.material_id`}
                          render={({ field: materialField }) => (
                            <FormItem>
                              <FormLabel>חומר מומלץ</FormLabel>
                              <Select
                                onValueChange={(value) => handleMaterialChange(value, index)}
                                value={materialField.value || ''}
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
                                <Input {...dosageField} placeholder="מינון" />
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
                              <Select onValueChange={unitField.onChange} value={unitField.value}>
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

                        {/* Status */}
                        <FormField
                          control={form.control}
                          name={`entries.${index}.status`}
                          render={({ field: statusField }) => (
                            <FormItem>
                              <FormLabel>סטטוס</FormLabel>
                              <Select onValueChange={statusField.onChange} value={statusField.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="בחר סטטוס" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {statusOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
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
                );
              })}
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'שומר...' : 'שמור דוח פעולה'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
