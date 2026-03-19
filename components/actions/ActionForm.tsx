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
import { MultiSelect } from '@/components/ui/multi-select';
import { Plus, Trash2, Lock, LockOpen } from 'lucide-react';
import { ReportSeverity, SEVERITY_OPTIONS, ActionTypeName, ACTION_TYPE_OPTIONS } from '@/types/database';
import { ENTIRE_AREA, ENTIRE_AREA_DISPLAY, ACTION_STATUS_OPTIONS } from '@/lib/constants';

const treatmentSchema = z.object({
  action_type_id: z.string().min(1, 'נדרש לבחור סוג פעולה'),
  material_id: z.string().optional(),
  material: z.string().min(1, 'נדרש להזין חומר'),
  dosage: z.string().min(1, 'נדרש להזין מינון'),
  unit_type_id: z.string().min(1, 'נדרש לבחור יחידת מידה'),
  status: z.string(),
  notes: z.string().optional(),
  monitoring_treatment_id: z.string().optional(), // Link back to monitoring treatment
});

const subAreaEntrySchema = z.object({
  source: z.enum(['monitoring', 'standalone']),
  monitoring_report_id: z.string().optional(),
  sub_area_id: z.string().min(1, 'נדרש לבחור תת-שטח'),
  sub_area_display: z.string().optional(),
  finding_ids: z.array(z.string()).min(1, 'נדרש לבחור לפחות ממצא אחד'),
  finding_name: z.string().optional(),
  severity: z.nativeEnum(ReportSeverity).optional(),
  crop_id: z.string().optional(),
  treatments: z.array(treatmentSchema).min(1, 'נדרש לפחות טיפול אחד'),
});

const actionSchema = z.object({
  customer_id: z.string().optional(),
  worker_id: z.string().min(1, 'נדרש לבחור עובד פעולה'),
  area_id: z.string().min(1, 'נדרש לבחור שטח'),
  report_date: z.string().optional(),
  entries: z.array(subAreaEntrySchema).min(1, 'נדרשת לפחות רשומה אחת'),
});

type ActionFormData = z.infer<typeof actionSchema>;

interface ActionFormProps {
  isAdmin: boolean;
  customers: any[];
  initialAreas: any[];
  initialWorkers: any[];
  findings: any[];
  unitTypes: any[];
  currentWorkerId?: string;
}

const statusOptions = ACTION_STATUS_OPTIONS;

export function ActionForm({
  isAdmin,
  customers,
  initialAreas,
  initialWorkers,
  findings,
  unitTypes,
  currentWorkerId,
}: ActionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Loaded data states
  const [actionWorkers, setActionWorkers] = useState<any[]>(initialWorkers);
  const [areas, setAreas] = useState<any[]>(initialAreas);
  const [subAreas, setSubAreas] = useState<any[]>([]);

  // Treatment-specific cascade data (indexed by "entryIndex-treatmentIndex")
  const [treatmentMaterials, setTreatmentMaterials] = useState<Record<string, any[]>>({});
  const [treatmentLoadingMaterials, setTreatmentLoadingMaterials] = useState<Record<string, boolean>>({});

  // Unlock: allow selecting any material instead of crop-filtered ones
  const [unlockedMaterials, setUnlockedMaterials] = useState<Record<string, boolean>>({});
  const [allMaterials, setAllMaterials] = useState<any[] | null>(null);

  // Loading states
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingSubAreas, setLoadingSubAreas] = useState(false);

  const form = useForm<ActionFormData>({
    resolver: zodResolver(actionSchema),
    defaultValues: {
      customer_id: '',
      worker_id: currentWorkerId || '',
      area_id: '',
      report_date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
      entries: [
        {
          source: 'standalone',
          sub_area_id: '',
          sub_area_display: '',
          finding_ids: [],
          finding_name: '',
          severity: undefined,
          crop_id: '',
          treatments: [
            {
              action_type_id: '',
              material_id: '',
              material: '',
              dosage: '',
              unit_type_id: '',
              status: 'planned',
              notes: '',
              monitoring_treatment_id: '',
            },
          ],
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

  // Fetch workers and areas when customer changes (admin only)
  useEffect(() => {
    if (isAdmin && watchCustomerId) {
      fetchActionWorkers(watchCustomerId);
      fetchAreas(watchCustomerId);
      // Reset dependent fields
      form.setValue('worker_id', '');
      form.setValue('area_id', '');
      setSubAreas([]);
      resetAllEntries();
    }
  }, [watchCustomerId, isAdmin]);

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
        finding_ids: [],
        finding_name: '',
        severity: undefined,
        crop_id: '',
        treatments: [
          {
            action_type_id: '',
            material_id: '',
            material: '',
            dosage: '',
            unit_type_id: '',
            status: 'planned',
            notes: '',
            monitoring_treatment_id: '',
          },
        ],
      },
    ]);
    setTreatmentMaterials({});
    setTreatmentLoadingMaterials({});
    setUnlockedMaterials({});
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
      .map((report: any) => {
        // Convert monitoring treatments to action treatments (with link to monitoring treatment)
        const treatments = (report.treatments || []).map((t: any) => ({
          action_type_id: t.action_type_id || '',
          material_id: t.material_id || '',
          material: t.material?.description || t.material?.name || '',
          dosage: t.dosage?.toString() || '',
          unit_type_id: t.unit_type_id || '',
          status: 'planned',
          notes: t.notes || '',
          monitoring_treatment_id: t.id || '', // Link to source monitoring treatment
        }));

        // If no treatments from monitoring, use backwards-compatible fields or create empty
        if (treatments.length === 0 && report.recommend_action_type_id) {
          treatments.push({
            action_type_id: report.recommend_action_type_id || '',
            material_id: report.recommend_material_id || '',
            material: report.recommend_material_name || '',
            dosage: report.recommend_dosage?.toString() || '',
            unit_type_id: report.recommend_unit_type_id || '',
            status: 'planned',
            notes: '',
            monitoring_treatment_id: '', // No link for backwards-compatible format
          });
        }

        // Ensure at least one treatment
        if (treatments.length === 0) {
          treatments.push({
            action_type_id: '',
            material_id: '',
            material: '',
            dosage: '',
            unit_type_id: '',
            status: 'planned',
            notes: '',
            monitoring_treatment_id: '',
          });
        }

        return {
          source: 'monitoring' as const,
          monitoring_report_id: report.monitoring_report_id,
          sub_area_id: report.sub_area_id || ENTIRE_AREA,
          sub_area_display: report.sub_area_display || report.sub_area_name || ENTIRE_AREA_DISPLAY,
          finding_ids: report.finding_id ? [report.finding_id] : [],
          finding_name: report.finding_name,
          severity: report.severity || undefined,
          crop_id: report.effective_crop_id || '',
          treatments,
        };
      });

    if (entries.length > 0) {
      form.setValue('entries', entries);
      // Pre-load cascade data for each entry
      entries.forEach((entry: any, entryIndex: number) => {
        const primaryFindingId = entry.finding_ids?.[0];
        if (entry.crop_id && primaryFindingId) {
          // Pre-load materials for each treatment with an action type
          entry.treatments.forEach((treatment: any, treatmentIndex: number) => {
            if (treatment.action_type_id) {
              fetchMaterialsForTreatment(entry.crop_id, primaryFindingId, treatment.action_type_id, entryIndex, treatmentIndex);
            }
          });
        }
      });
    } else {
      resetAllEntries();
    }
  };

  const fetchMaterialsForTreatment = useCallback(async (cropId: string, findingId: string, actionTypeId: string, entryIndex: number, treatmentIndex: number) => {
    const key = `${entryIndex}-${treatmentIndex}`;
    setTreatmentLoadingMaterials((prev) => ({ ...prev, [key]: true }));
    try {
      const response = await fetch(`/api/cascade?type=materials&cropId=${cropId}&findingId=${findingId}&actionTypeId=${actionTypeId}`);
      if (response.ok) {
        const data = await response.json();
        setTreatmentMaterials((prev) => ({ ...prev, [key]: data }));
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
    } finally {
      setTreatmentLoadingMaterials((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  const fetchDosageForTreatment = useCallback(async (cropId: string, findingId: string, actionTypeId: string, materialId: string, entryIndex: number, treatmentIndex: number) => {
    try {
      const response = await fetch(
        `/api/cascade?type=dosage&cropId=${cropId}&findingId=${findingId}&actionTypeId=${actionTypeId}&materialId=${materialId}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data) {
          form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.dosage`, data.dosage?.toString() || '');
          form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.unit_type_id`, data.unit_type_id || '');
        }
      }
    } catch (err) {
      console.error('Error fetching dosage:', err);
    }
  }, [form]);

  const fetchAllMaterials = useCallback(async () => {
    if (allMaterials) return;
    try {
      const res = await fetch('/api/materials');
      if (res.ok) {
        const data = await res.json();
        setAllMaterials(data);
      }
    } catch (err) {
      console.error('Error fetching all materials:', err);
    }
  }, [allMaterials]);

  const cleanupTreatmentStateForEntry = (entryIndex: number) => {
    const cleanupState = <T,>(state: Record<string, T>): Record<string, T> => {
      const newState: Record<string, T> = {};
      Object.keys(state).forEach(key => {
        if (!key.startsWith(`${entryIndex}-`)) {
          newState[key] = state[key];
        }
      });
      return newState;
    };
    setTreatmentMaterials(cleanupState);
    setTreatmentLoadingMaterials(cleanupState);
    setUnlockedMaterials(cleanupState);
  };

  const handleSubAreaChange = (subAreaId: string, entryIndex: number) => {
    const subArea = subAreas.find((sa) => sa.id === subAreaId);
    if (subArea) {
      const cropId = subArea.effective_crop_id || subArea.crop_id;

      form.setValue(`entries.${entryIndex}.sub_area_id`, subAreaId);
      form.setValue(`entries.${entryIndex}.sub_area_display`, subArea.display || subArea.name);
      form.setValue(`entries.${entryIndex}.crop_id`, cropId || '');

      // Reset dependent fields
      form.setValue(`entries.${entryIndex}.finding_ids`, []);
      form.setValue(`entries.${entryIndex}.finding_name`, '');
      form.setValue(`entries.${entryIndex}.treatments`, [
        { action_type_id: '', material_id: '', material: '', dosage: '', unit_type_id: '', status: 'planned', notes: '', monitoring_treatment_id: '' }
      ]);

      // Clear cascade data
      cleanupTreatmentStateForEntry(entryIndex);
    }
  };

  const handleFindingIdsChange = (findingIds: string[], entryIndex: number) => {
    form.setValue(`entries.${entryIndex}.finding_ids`, findingIds);

    // Reset treatments
    form.setValue(`entries.${entryIndex}.treatments`, [
      { action_type_id: '', material_id: '', material: '', dosage: '', unit_type_id: '', status: 'planned', notes: '', monitoring_treatment_id: '' }
    ]);

    // Clear cascade data
    cleanupTreatmentStateForEntry(entryIndex);
  };

  const handleTreatmentActionTypeChange = (actionTypeId: string, entryIndex: number, treatmentIndex: number) => {
    const cropId = form.getValues(`entries.${entryIndex}.crop_id`);
    const findingIds = form.getValues(`entries.${entryIndex}.finding_ids`) || [];
    const primaryFindingId = findingIds[0];
    const key = `${entryIndex}-${treatmentIndex}`;

    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.action_type_id`, actionTypeId);

    // Reset dependent fields for this treatment
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.material_id`, '');
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.material`, '');
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.dosage`, '');
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.unit_type_id`, '');

    if (cropId && primaryFindingId && actionTypeId) {
      fetchMaterialsForTreatment(cropId, primaryFindingId, actionTypeId, entryIndex, treatmentIndex);
    } else {
      setTreatmentMaterials((prev) => ({ ...prev, [key]: [] }));
    }
  };

  const handleTreatmentMaterialChange = (materialId: string, entryIndex: number, treatmentIndex: number) => {
    const cropId = form.getValues(`entries.${entryIndex}.crop_id`);
    const findingIds = form.getValues(`entries.${entryIndex}.finding_ids`) || [];
    const primaryFindingId = findingIds[0];
    const actionTypeId = form.getValues(`entries.${entryIndex}.treatments.${treatmentIndex}.action_type_id`);
    const key = `${entryIndex}-${treatmentIndex}`;
    const materials = unlockedMaterials[key] ? (allMaterials || []) : (treatmentMaterials[key] || []);
    const material = materials.find((m: any) => m.id === materialId);

    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.material_id`, materialId);
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.material`, material?.description || material?.name || '');

    if (cropId && primaryFindingId && actionTypeId && materialId) {
      fetchDosageForTreatment(cropId, primaryFindingId, actionTypeId, materialId, entryIndex, treatmentIndex);
    }
  };

  const addTreatmentToEntry = (entryIndex: number) => {
    const currentTreatments = form.getValues(`entries.${entryIndex}.treatments`) || [];
    form.setValue(`entries.${entryIndex}.treatments`, [
      ...currentTreatments,
      { action_type_id: '', material_id: '', material: '', dosage: '', unit_type_id: '', status: 'planned', notes: '', monitoring_treatment_id: '' }
    ]);
  };

  const removeTreatmentFromEntry = (entryIndex: number, treatmentIndex: number) => {
    const currentTreatments = form.getValues(`entries.${entryIndex}.treatments`) || [];
    if (currentTreatments.length <= 1) return; // Keep at least one treatment

    const newTreatments = currentTreatments.filter((_, i) => i !== treatmentIndex);
    form.setValue(`entries.${entryIndex}.treatments`, newTreatments);

    // Rebuild treatment state with shifted indices
    const rebuildTreatmentState = <T,>(state: Record<string, T>): Record<string, T> => {
      const newState: Record<string, T> = {};
      Object.keys(state).forEach(key => {
        const [eIdx, tIdx] = key.split('-').map(Number);
        if (eIdx !== entryIndex) {
          newState[key] = state[key];
        } else if (tIdx < treatmentIndex) {
          newState[key] = state[key];
        } else if (tIdx > treatmentIndex) {
          newState[`${eIdx}-${tIdx - 1}`] = state[key];
        }
      });
      return newState;
    };
    setTreatmentMaterials(rebuildTreatmentState);
    setTreatmentLoadingMaterials(rebuildTreatmentState);
  };

  const addEntry = () => {
    append({
      source: 'standalone',
      sub_area_id: '',
      sub_area_display: '',
      finding_ids: [],
      finding_name: '',
      severity: undefined,
      crop_id: '',
      treatments: [
        { action_type_id: '', material_id: '', material: '', dosage: '', unit_type_id: '', status: 'planned', notes: '', monitoring_treatment_id: '' }
      ],
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
          report_date: data.report_date || null,
          entries: data.entries.flatMap((entry) => {
            const subAreaId = entry.sub_area_id === ENTIRE_AREA ? null : entry.sub_area_id;
            const treatments = entry.treatments.map((t) => ({
              action_type_id: t.action_type_id,
              material_id: t.material_id || null,
              dosage: t.dosage,
              unit_type_id: t.unit_type_id,
              status: t.status,
              notes: t.notes || null,
              monitoring_treatment_id: t.monitoring_treatment_id || null,
            }));
            // Expand each finding_id into a separate entry for the API
            return entry.finding_ids.map((fid) => ({
              sub_area_id: subAreaId,
              finding_id: fid,
              monitoring_report_id: entry.monitoring_report_id || null,
              treatments,
            }));
          }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בשמירת הפעולות');
      }

      setSuccess(true);
      form.reset({
        customer_id: '',
        worker_id: currentWorkerId || '',
        area_id: '',
        report_date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        entries: [
          {
            source: 'standalone',
            sub_area_id: '',
            sub_area_display: '',
            finding_ids: [],
            finding_name: '',
            severity: undefined,
            crop_id: '',
            treatments: [
              { action_type_id: '', material_id: '', material: '', dosage: '', unit_type_id: '', status: 'planned', notes: '', monitoring_treatment_id: '' }
            ],
          },
        ],
      });
      if (isAdmin) {
        setActionWorkers([]);
        setAreas([]);
      }
      setSubAreas([]);
      setTreatmentMaterials({});
      setTreatmentLoadingMaterials({});

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
        <CardTitle>טופס פעולה חדש</CardTitle>
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

            {/* Customer Selection - Admin only */}
            {isAdmin && (
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
            )}

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
                    disabled={isAdmin && (!watchCustomerId || loadingWorkers)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingWorkers
                              ? 'טוען עובדים...'
                              : isAdmin && !watchCustomerId
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

            {/* Report Date */}
            <FormField
              control={form.control}
              name="report_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מועד</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
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
                    disabled={isAdmin && (!watchCustomerId || loadingAreas)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingAreas
                              ? 'טוען שטחים...'
                              : isAdmin && !watchCustomerId
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

              {fields.map((field, entryIndex) => {
                const entry = form.watch(`entries.${entryIndex}`);
                const isFromMonitoring = entry?.source === 'monitoring';
                const treatments = entry?.treatments || [];

                return (
                  <Card key={field.id} className="p-4">
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">רשומה {entryIndex + 1}</span>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(entryIndex)}
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
                            name={`entries.${entryIndex}.sub_area_id`}
                            render={({ field: subField }) => (
                              <FormItem>
                                <FormLabel>תת-שטח</FormLabel>
                                <Select
                                  onValueChange={(value) => handleSubAreaChange(value, entryIndex)}
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
                            name={`entries.${entryIndex}.finding_ids`}
                            render={({ field: findingField }) => (
                              <FormItem>
                                <FormLabel>ממצאים</FormLabel>
                                <MultiSelect
                                  options={[...findings]
                                    .sort((a, b) => (a.description || a.name || '').localeCompare(b.description || b.name || '', 'he'))
                                    .map((finding) => ({
                                      value: finding.id,
                                      label: finding.description || finding.name,
                                    }))}
                                  value={findingField.value}
                                  onValueChange={(ids) => handleFindingIdsChange(ids, entryIndex)}
                                  placeholder={
                                    !form.watch(`entries.${entryIndex}.sub_area_id`)
                                      ? 'בחר תחילה תת-שטח'
                                      : 'בחר ממצאים'
                                  }
                                  showSelectAll={false}
                                  disabled={!form.watch(`entries.${entryIndex}.sub_area_id`)}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {/* Severity select */}
                        <FormField
                          control={form.control}
                          name={`entries.${entryIndex}.severity`}
                          render={({ field: severityField }) => (
                            <FormItem>
                              <FormLabel>חומרה</FormLabel>
                              <Select
                                onValueChange={severityField.onChange}
                                value={severityField.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="בחר רמת חומרה" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {SEVERITY_OPTIONS.map((option) => (
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

                      {/* Treatments Section */}
                      <div className="space-y-3 pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">טיפולים</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addTreatmentToEntry(entryIndex)}
                          >
                            <Plus className="h-3 w-3 me-1" />
                            הוסף טיפול
                          </Button>
                        </div>

                        {treatments.map((treatment, treatmentIndex) => {
                          const treatmentKey = `${entryIndex}-${treatmentIndex}`;
                          const treatmentActionTypeId = form.watch(`entries.${entryIndex}.treatments.${treatmentIndex}.action_type_id`);

                          return (
                            <Card key={treatmentIndex} className="p-3 bg-muted/30">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-muted-foreground">טיפול {treatmentIndex + 1}</span>
                                {treatments.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeTreatmentFromEntry(entryIndex, treatmentIndex)}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Action Type */}
                                <FormField
                                  control={form.control}
                                  name={`entries.${entryIndex}.treatments.${treatmentIndex}.action_type_id`}
                                  render={({ field: actionField }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm">סוג פעולה</FormLabel>
                                      <Select
                                        onValueChange={(value) => handleTreatmentActionTypeChange(value, entryIndex, treatmentIndex)}
                                        value={actionField.value}
                                        disabled={!isFromMonitoring && !(form.watch(`entries.${entryIndex}.finding_ids`)?.length > 0)}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue
                                              placeholder={
                                                !isFromMonitoring && !(form.watch(`entries.${entryIndex}.finding_ids`)?.length > 0)
                                                  ? 'בחר תחילה ממצא'
                                                  : 'בחר סוג פעולה'
                                              }
                                            />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {ACTION_TYPE_OPTIONS.map((option) => (
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

                                {/* Material Selection */}
                                <FormField
                                  control={form.control}
                                  name={`entries.${entryIndex}.treatments.${treatmentIndex}.material_id`}
                                  render={({ field: materialField }) => (
                                    <FormItem>
                                      <div className="flex items-center gap-1.5">
                                        <FormLabel className="text-sm">חומר</FormLabel>
                                        {(treatmentMaterials[treatmentKey]?.length || 0) > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (!unlockedMaterials[treatmentKey]) fetchAllMaterials();
                                              setUnlockedMaterials(prev => ({ ...prev, [treatmentKey]: !prev[treatmentKey] }));
                                            }}
                                            className="p-0.5 rounded hover:bg-accent text-muted-foreground transition-colors"
                                            title={unlockedMaterials[treatmentKey] ? 'הצג רק חומרים מומלצים' : 'הצג את כל החומרים'}
                                          >
                                            {unlockedMaterials[treatmentKey]
                                              ? <LockOpen className="h-3.5 w-3.5 text-orange-500" />
                                              : <Lock className="h-3.5 w-3.5" />}
                                          </button>
                                        )}
                                      </div>
                                      <Select
                                        onValueChange={(value) => handleTreatmentMaterialChange(value, entryIndex, treatmentIndex)}
                                        value={materialField.value || ''}
                                        disabled={!treatmentActionTypeId || treatmentLoadingMaterials[treatmentKey]}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue
                                              placeholder={
                                                !treatmentActionTypeId
                                                  ? 'בחר תחילה סוג פעולה'
                                                  : treatmentLoadingMaterials[treatmentKey]
                                                    ? 'טוען...'
                                                    : 'בחר חומר'
                                              }
                                            />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {(unlockedMaterials[treatmentKey] ? (allMaterials || []) : (treatmentMaterials[treatmentKey] || [])).map((material: any) => (
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
                                  name={`entries.${entryIndex}.treatments.${treatmentIndex}.dosage`}
                                  render={({ field: dosageField }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm">מינון</FormLabel>
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
                                  name={`entries.${entryIndex}.treatments.${treatmentIndex}.unit_type_id`}
                                  render={({ field: unitField }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm">יחידת מידה</FormLabel>
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
                                  name={`entries.${entryIndex}.treatments.${treatmentIndex}.status`}
                                  render={({ field: statusField }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm">סטטוס</FormLabel>
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
                            </Card>
                          );
                        })}
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
