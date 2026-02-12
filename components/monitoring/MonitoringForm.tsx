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
import { ReportSeverity, SEVERITY_OPTIONS } from '@/types/database';

const treatmentSchema = z.object({
  action_type_id: z.string().optional(),
  material_id: z.string().optional(),
  dosage: z.string().optional(),
  unit_type_id: z.string().optional(),
  notes: z.string().optional(),
});

const subAreaEntrySchema = z.object({
  sub_area_id: z.string().min(1, 'נדרש לבחור תת-שטח'),
  finding_id: z.string().min(1, 'נדרש לבחור ממצא'),
  severity: z.nativeEnum(ReportSeverity).optional(),
  treatments: z.array(treatmentSchema),
});

const monitoringSchema = z.object({
  customer_id: z.string().min(1, 'נדרש לבחור לקוח'),
  inspector_id: z.string().min(1, 'נדרש לבחור פקח'),
  area_id: z.string().min(1, 'נדרש לבחור שטח'),
  entries: z.array(subAreaEntrySchema).min(1, 'נדרשת לפחות רשומה אחת'),
});

type MonitoringFormData = z.infer<typeof monitoringSchema>;

interface MonitoringFormProps {
  isAdmin: boolean;
  customers: any[];
  initialInspectors: any[];
  initialAreas: any[];
  findings: any[];
  unitTypes: any[];
  customerIdForData: string | null;
}

export function MonitoringForm({
  isAdmin,
  customers,
  initialInspectors,
  initialAreas,
  findings,
  unitTypes,
  customerIdForData,
}: MonitoringFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Dynamic data states - pre-loaded for non-admin users
  const [inspectors, setInspectors] = useState<any[]>(initialInspectors);
  const [areas, setAreas] = useState<any[]>(initialAreas);
  const [subAreas, setSubAreas] = useState<any[]>([]);

  // Per-entry indexed state for cascade data
  const [entryActionTypes, setEntryActionTypes] = useState<Record<number, any[]>>({});
  const [entryCropIds, setEntryCropIds] = useState<Record<number, string | null>>({});

  // Per-treatment indexed state: key is "entryIndex-treatmentIndex"
  const [treatmentMaterials, setTreatmentMaterials] = useState<Record<string, any[]>>({});
  const [treatmentRecommendedDosage, setTreatmentRecommendedDosage] = useState<Record<string, string>>({});
  const [treatmentRecommendedUnitTypeId, setTreatmentRecommendedUnitTypeId] = useState<Record<string, string>>({});

  // Per-entry loading states
  const [entryLoadingActionTypes, setEntryLoadingActionTypes] = useState<Record<number, boolean>>({});
  // Per-treatment loading states
  const [treatmentLoadingMaterials, setTreatmentLoadingMaterials] = useState<Record<string, boolean>>({});

  // Loading states
  const [loadingInspectors, setLoadingInspectors] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingSubAreas, setLoadingSubAreas] = useState(false);

  const form = useForm<MonitoringFormData>({
    resolver: zodResolver(monitoringSchema),
    defaultValues: {
      customer_id: !isAdmin && customerIdForData ? customerIdForData : '',
      inspector_id: '',
      area_id: '',
      entries: [{
        sub_area_id: '',
        finding_id: '',
        severity: undefined,
        treatments: [],
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'entries',
  });

  const watchedCustomerId = form.watch('customer_id');
  const watchedAreaId = form.watch('area_id');

  // Fetch inspectors and areas when customer changes (admin only)
  useEffect(() => {
    if (isAdmin && watchedCustomerId) {
      fetchInspectorsAndAreas(watchedCustomerId);
      // Reset dependent fields
      form.setValue('inspector_id', '');
      form.setValue('area_id', '');
      form.setValue('entries', [{
        sub_area_id: '',
        finding_id: '',
        severity: undefined,
        treatments: [],
      }]);
      setSubAreas([]);
      resetAllEntryState();
    } else if (isAdmin) {
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
        severity: undefined,
        treatments: [],
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
    setTreatmentMaterials({});
    setTreatmentRecommendedDosage({});
    setTreatmentRecommendedUnitTypeId({});
    setEntryLoadingActionTypes({});
    setTreatmentLoadingMaterials({});
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

  const fetchActionTypesForEntry = async (cropId: string, findingId: string, index: number) => {
    setEntryLoadingActionTypes(prev => ({ ...prev, [index]: true }));
    try {
      const res = await fetch(`/api/cascade?type=action_types&cropId=${cropId}&findingId=${findingId}`);
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

  const fetchMaterialsForTreatment = async (cropId: string, findingId: string, actionTypeId: string, entryIndex: number, treatmentIndex: number) => {
    const key = `${entryIndex}-${treatmentIndex}`;
    setTreatmentLoadingMaterials(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/cascade?type=materials&cropId=${cropId}&findingId=${findingId}&actionTypeId=${actionTypeId}`);
      if (res.ok) {
        const data = await res.json();
        setTreatmentMaterials(prev => ({ ...prev, [key]: data }));
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
    } finally {
      setTreatmentLoadingMaterials(prev => ({ ...prev, [key]: false }));
    }
  };

  const fetchDosageForTreatment = async (cropId: string, findingId: string, actionTypeId: string, materialId: string, entryIndex: number, treatmentIndex: number) => {
    const key = `${entryIndex}-${treatmentIndex}`;
    try {
      const res = await fetch(`/api/cascade?type=dosage&cropId=${cropId}&findingId=${findingId}&actionTypeId=${actionTypeId}&materialId=${materialId}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setTreatmentRecommendedDosage(prev => ({ ...prev, [key]: data.dosage?.toString() || '' }));
          setTreatmentRecommendedUnitTypeId(prev => ({ ...prev, [key]: data.unit_type_id || '' }));
          form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.dosage`, data.dosage?.toString() || '');
          form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.unit_type_id`, data.unit_type_id || '');
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
    form.setValue(`entries.${index}.treatments`, []);

    setEntryActionTypes(prev => ({ ...prev, [index]: [] }));
    // Clean up treatment-related state for this entry
    cleanupTreatmentStateForEntry(index);
  };

  const handleFindingChange = (findingId: string, index: number) => {
    form.setValue(`entries.${index}.finding_id`, findingId);
    const cropId = entryCropIds[index];

    // Reset treatments when finding changes
    form.setValue(`entries.${index}.treatments`, []);
    cleanupTreatmentStateForEntry(index);

    if (findingId && cropId) {
      fetchActionTypesForEntry(cropId, findingId, index);
    } else {
      setEntryActionTypes(prev => ({ ...prev, [index]: [] }));
    }
  };

  const cleanupTreatmentStateForEntry = (entryIndex: number) => {
    // Remove all treatment state for this entry
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
    setTreatmentRecommendedDosage(cleanupState);
    setTreatmentRecommendedUnitTypeId(cleanupState);
    setTreatmentLoadingMaterials(cleanupState);
  };

  const handleTreatmentActionTypeChange = (actionTypeId: string, entryIndex: number, treatmentIndex: number) => {
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.action_type_id`, actionTypeId);
    const cropId = entryCropIds[entryIndex];
    const findingId = form.getValues(`entries.${entryIndex}.finding_id`);
    const key = `${entryIndex}-${treatmentIndex}`;

    // Reset dependent fields for this treatment
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.material_id`, '');
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.dosage`, '');
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.unit_type_id`, '');
    setTreatmentRecommendedDosage(prev => ({ ...prev, [key]: '' }));
    setTreatmentRecommendedUnitTypeId(prev => ({ ...prev, [key]: '' }));

    if (cropId && findingId && actionTypeId) {
      fetchMaterialsForTreatment(cropId, findingId, actionTypeId, entryIndex, treatmentIndex);
    } else {
      setTreatmentMaterials(prev => ({ ...prev, [key]: [] }));
    }
  };

  const handleTreatmentMaterialChange = (materialId: string, entryIndex: number, treatmentIndex: number) => {
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.material_id`, materialId);
    const cropId = entryCropIds[entryIndex];
    const findingId = form.getValues(`entries.${entryIndex}.finding_id`);
    const actionTypeId = form.getValues(`entries.${entryIndex}.treatments.${treatmentIndex}.action_type_id`);

    if (cropId && findingId && actionTypeId && materialId) {
      fetchDosageForTreatment(cropId, findingId, actionTypeId, materialId, entryIndex, treatmentIndex);
    }
  };

  const addTreatment = (entryIndex: number) => {
    const currentTreatments = form.getValues(`entries.${entryIndex}.treatments`) || [];
    form.setValue(`entries.${entryIndex}.treatments`, [
      ...currentTreatments,
      { action_type_id: '', material_id: '', dosage: '', unit_type_id: '', notes: '' }
    ]);
  };

  const removeTreatment = (entryIndex: number, treatmentIndex: number) => {
    const currentTreatments = form.getValues(`entries.${entryIndex}.treatments`) || [];
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
    setTreatmentRecommendedDosage(rebuildTreatmentState);
    setTreatmentRecommendedUnitTypeId(rebuildTreatmentState);
    setTreatmentLoadingMaterials(rebuildTreatmentState);
  };

  const addEntry = () => {
    append({
      sub_area_id: '',
      finding_id: '',
      severity: undefined,
      treatments: [],
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

    // Rebuild treatment state with shifted entry indices
    const rebuildTreatmentState = <T,>(state: Record<string, T>): Record<string, T> => {
      const newState: Record<string, T> = {};
      Object.keys(state).forEach(key => {
        const [eIdx, tIdx] = key.split('-').map(Number);
        if (eIdx < index) {
          newState[key] = state[key];
        } else if (eIdx > index) {
          newState[`${eIdx - 1}-${tIdx}`] = state[key];
        }
      });
      return newState;
    };

    setEntryCropIds(rebuildState);
    setEntryActionTypes(rebuildState);
    setEntryLoadingActionTypes(rebuildState);
    setTreatmentMaterials(rebuildTreatmentState);
    setTreatmentRecommendedDosage(rebuildTreatmentState);
    setTreatmentRecommendedUnitTypeId(rebuildTreatmentState);
    setTreatmentLoadingMaterials(rebuildTreatmentState);
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
      if (!isAdmin && customerIdForData) {
        // Restore customer_id and pre-loaded data for non-admin users
        form.setValue('customer_id', customerIdForData);
        setInspectors(initialInspectors);
        setAreas(initialAreas);
      } else {
        setInspectors([]);
        setAreas([]);
      }
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
        <CardDescription>מלא את פרטי הניטור עבור השטח הנבחר</CardDescription>
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
                {/* Customer Selection - Admin only */}
                {isAdmin && (
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
                )}

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
              <h3 className="font-semibold text-lg border-b pb-2">שטח</h3>
              <FormField
                control={form.control}
                name="area_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">
                      שטח *
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
                            !watchedCustomerId ? 'בחר לקוח תחילה' : 'בחר שטח'
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
                  const treatments = form.watch(`entries.${index}.treatments`) || [];
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

                        {/* Severity select */}
                        <FormField
                          control={form.control}
                          name={`entries.${index}.severity`}
                          render={({ field: severityField }) => (
                            <FormItem>
                              <FormLabel className="font-medium">חומרה</FormLabel>
                              <Select
                                onValueChange={severityField.onChange}
                                value={severityField.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11">
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
                      {entryFindingId && (
                        <div className="space-y-3 pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">טיפולים מומלצים</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addTreatment(index)}
                              disabled={!cropId || entryLoadingActionTypes[index]}
                            >
                              <Plus className="h-3 w-3 me-1" />
                              הוסף טיפול
                            </Button>
                          </div>

                          {treatments.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              לחץ &quot;הוסף טיפול&quot; להוספת המלצות טיפול
                            </p>
                          )}

                          {treatments.map((treatment, tIndex) => {
                            const treatmentKey = `${index}-${tIndex}`;
                            const treatmentActionTypeId = form.watch(`entries.${index}.treatments.${tIndex}.action_type_id`);

                            return (
                              <Card key={tIndex} className="p-3 space-y-3 bg-background">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">טיפול {tIndex + 1}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeTreatment(index, tIndex)}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Action type select */}
                                  <FormField
                                    control={form.control}
                                    name={`entries.${index}.treatments.${tIndex}.action_type_id`}
                                    render={({ field: actionField }) => (
                                      <FormItem>
                                        <FormLabel className="font-medium text-sm">
                                          סוג פעולה
                                          {entryLoadingActionTypes[index] && <LoadingSpinner />}
                                        </FormLabel>
                                        <Select
                                          onValueChange={(v) => handleTreatmentActionTypeChange(v, index, tIndex)}
                                          value={actionField.value}
                                          disabled={!cropId || entryLoadingActionTypes[index]}
                                        >
                                          <FormControl>
                                            <SelectTrigger className="h-10">
                                              <SelectValue placeholder={
                                                !cropId ? 'אין גידול מוגדר' : 'בחר סוג פעולה'
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
                                    name={`entries.${index}.treatments.${tIndex}.material_id`}
                                    render={({ field: materialField }) => (
                                      <FormItem>
                                        <FormLabel className="font-medium text-sm">
                                          חומר מומלץ
                                          {treatmentLoadingMaterials[treatmentKey] && <LoadingSpinner />}
                                        </FormLabel>
                                        <Select
                                          onValueChange={(v) => handleTreatmentMaterialChange(v, index, tIndex)}
                                          value={materialField.value}
                                          disabled={!treatmentActionTypeId || treatmentLoadingMaterials[treatmentKey]}
                                        >
                                          <FormControl>
                                            <SelectTrigger className="h-10">
                                              <SelectValue placeholder={
                                                !treatmentActionTypeId ? 'בחר סוג פעולה תחילה' : 'בחר חומר'
                                              } />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            {(treatmentMaterials[treatmentKey] || []).map((material) => (
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
                                    name={`entries.${index}.treatments.${tIndex}.dosage`}
                                    render={({ field: dosageField }) => (
                                      <FormItem>
                                        <FormLabel className="font-medium text-sm">מינון</FormLabel>
                                        <FormControl>
                                          <Input
                                            {...dosageField}
                                            value={dosageField.value || ''}
                                            placeholder={
                                              treatmentRecommendedDosage[treatmentKey]
                                                ? `מומלץ: ${treatmentRecommendedDosage[treatmentKey]}`
                                                : 'הזן מינון'
                                            }
                                            className="h-10"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  {/* Unit type select */}
                                  <FormField
                                    control={form.control}
                                    name={`entries.${index}.treatments.${tIndex}.unit_type_id`}
                                    render={({ field: unitField }) => (
                                      <FormItem>
                                        <FormLabel className="font-medium text-sm">יחידת מידה</FormLabel>
                                        <Select onValueChange={unitField.onChange} value={unitField.value}>
                                          <FormControl>
                                            <SelectTrigger className="h-10">
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
