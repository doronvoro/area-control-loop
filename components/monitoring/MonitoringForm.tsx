'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import {
  Loader2,
  Plus,
  Trash2,
  User,
  MapPin,
  ClipboardList,
  Beaker,
  Check,
  AlertTriangle,
  Sparkles,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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

const SEVERITY_CONFIG: Record<string, { label: string; dotClass: string; chipClass: string }> = {
  [ReportSeverity.LOW]: { label: 'נמוכה', dotClass: 'severity-dot-low', chipClass: 'severity-low' },
  [ReportSeverity.MEDIUM]: { label: 'בינונית', dotClass: 'severity-dot-medium', chipClass: 'severity-medium' },
  [ReportSeverity.HIGH]: { label: 'גבוהה', dotClass: 'severity-dot-high', chipClass: 'severity-high' },
  [ReportSeverity.CRITICAL]: { label: 'קריטית', dotClass: 'severity-dot-critical', chipClass: 'severity-critical' },
};

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

  // Collapsed state for entries
  const [collapsedEntries, setCollapsedEntries] = useState<Record<number, boolean>>({});

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
  const watchedInspectorId = form.watch('inspector_id');

  // Progress step calculation
  const currentStep = useMemo(() => {
    if (!watchedCustomerId) return 0;
    if (!watchedInspectorId) return 1;
    if (!watchedAreaId) return 2;
    return 3;
  }, [watchedCustomerId, watchedInspectorId, watchedAreaId]);

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
    setCollapsedEntries({});
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

    // Rebuild collapsed state
    setCollapsedEntries(prev => {
      const newState: Record<number, boolean> = {};
      Object.keys(prev).forEach(key => {
        const keyNum = parseInt(key);
        if (keyNum < index) {
          newState[keyNum] = prev[keyNum];
        } else if (keyNum > index) {
          newState[keyNum - 1] = prev[keyNum];
        }
      });
      return newState;
    });
  };

  const toggleEntryCollapse = (index: number) => {
    setCollapsedEntries(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const getEntrySummary = (index: number) => {
    const subAreaId = form.watch(`entries.${index}.sub_area_id`);
    const findingId = form.watch(`entries.${index}.finding_id`);
    const severity = form.watch(`entries.${index}.severity`);
    const treatments = form.watch(`entries.${index}.treatments`) || [];

    const subArea = subAreas.find(sa => sa.id === subAreaId);
    const finding = findings.find(f => f.id === findingId);

    return {
      subAreaName: subArea?.display || subArea?.name || '',
      findingName: finding?.description || finding?.name || '',
      severity,
      treatmentCount: treatments.length,
    };
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

  const LoadingSpinner = () => <Loader2 className="h-3.5 w-3.5 animate-spin inline ms-1.5 opacity-60" />;

  const steps = [
    { label: 'לקוח', icon: User },
    { label: 'פקח', icon: User },
    { label: 'שטח', icon: MapPin },
    { label: 'ממצאים', icon: ClipboardList },
  ];

  return (
    <div className="monitoring-form-container max-w-4xl mx-auto">
      {/* Hero Header */}
      <div className="monitoring-hero px-6 py-8 md:px-8 md:py-10">
        <div className="hero-pattern" />
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              טופס ניטור חדש
            </h2>
          </div>
          <p className="text-center text-white/70 text-sm">
            מלא את פרטי הניטור עבור השטח הנבחר
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="progress-steps border-b border-border/40">
        {steps.map((step, i) => (
          <div key={i} className="progress-step">
            <div className="flex flex-col items-center gap-1">
              <div className={`step-circle ${
                i < currentStep ? 'step-circle-complete' :
                i === currentStep ? 'step-circle-active' :
                'step-circle-pending'
              }`}>
                {i < currentStep ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <step.icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span className={`step-label ${i === currentStep ? 'step-label-active' : ''}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`step-connector ${i < currentStep ? 'step-connector-complete' : ''}`} />
            )}
          </div>
        ))}
      </div>

      {/* Form Body */}
      <div className="p-4 md:p-6 space-y-5">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Alerts */}
            {error && (
              <div className="error-banner flex items-center gap-3 p-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
            {success && (
              <div className="success-banner flex items-center gap-3 p-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-200/60 flex-shrink-0">
                  <Check className="h-4 w-4" />
                </div>
                <p className="text-sm font-bold">הדוח נשמר בהצלחה!</p>
              </div>
            )}

            {/* Section 1: Customer & Inspector Selection */}
            <div className="monitoring-section section-customer p-5">
              <div className="section-header">
                <div className="section-icon section-icon-customer">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-base">פרטי לקוח ופקח</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Selection - Admin only */}
                {isAdmin && (
                  <FormField
                    control={form.control}
                    name="customer_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-sm">לקוח *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 monitoring-select-trigger">
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
                      <FormLabel className="font-semibold text-sm">
                        פקח *
                        {loadingInspectors && <LoadingSpinner />}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!watchedCustomerId || loadingInspectors}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11 monitoring-select-trigger">
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
            <div className="monitoring-section section-area p-5">
              <div className="section-header">
                <div className="section-icon section-icon-area">
                  <MapPin className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-base">שטח</h3>
              </div>
              <FormField
                control={form.control}
                name="area_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-sm">
                      שטח *
                      {loadingAreas && <LoadingSpinner />}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!watchedCustomerId || loadingAreas}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11 monitoring-select-trigger">
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
              <div className="monitoring-section section-entries p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="section-icon section-icon-entries">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">רשומות תת-שטח</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {fields.length} {fields.length === 1 ? 'רשומה' : 'רשומות'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="add-button"
                    onClick={addEntry}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    הוסף רשומה
                  </button>
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => {
                    const entrySubAreaId = form.watch(`entries.${index}.sub_area_id`);
                    const entryFindingId = form.watch(`entries.${index}.finding_id`);
                    const treatments = form.watch(`entries.${index}.treatments`) || [];
                    const cropId = entryCropIds[index];
                    const isCollapsed = collapsedEntries[index] && entrySubAreaId;
                    const summary = getEntrySummary(index);

                    return (
                      <div key={field.id} className="entry-card p-4 space-y-4">
                        {/* Entry Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="entry-number">{index + 1}</span>
                            {isCollapsed && summary.subAreaName && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-foreground/80">{summary.subAreaName}</span>
                                {summary.severity && (
                                  <span className={`severity-dot ${SEVERITY_CONFIG[summary.severity]?.dotClass}`} />
                                )}
                                {summary.treatmentCount > 0 && (
                                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                                    {summary.treatmentCount} טיפולים
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {entrySubAreaId && (
                              <button
                                type="button"
                                className="delete-button"
                                onClick={() => toggleEntryCollapse(index)}
                              >
                                {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                              </button>
                            )}
                            {fields.length > 1 && (
                              <button
                                type="button"
                                className="delete-button"
                                onClick={() => removeEntry(index)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Entry Body (collapsible) */}
                        {!isCollapsed && (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Sub-area select */}
                              <FormField
                                control={form.control}
                                name={`entries.${index}.sub_area_id`}
                                render={({ field: subField }) => (
                                  <FormItem>
                                    <FormLabel className="font-semibold text-sm">
                                      תת-שטח *
                                      {loadingSubAreas && <LoadingSpinner />}
                                    </FormLabel>
                                    <Select
                                      onValueChange={(v) => handleSubAreaChange(v, index)}
                                      value={subField.value}
                                      disabled={loadingSubAreas}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="h-11 monitoring-select-trigger">
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
                                    <FormLabel className="font-semibold text-sm">ממצא *</FormLabel>
                                    <Select
                                      onValueChange={(v) => handleFindingChange(v, index)}
                                      value={findingField.value}
                                      disabled={!entrySubAreaId}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="h-11 monitoring-select-trigger">
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
                            </div>

                            {/* Severity Chips */}
                            <FormField
                              control={form.control}
                              name={`entries.${index}.severity`}
                              render={({ field: severityField }) => (
                                <FormItem>
                                  <FormLabel className="font-semibold text-sm">חומרה</FormLabel>
                                  <div className="severity-chips">
                                    {SEVERITY_OPTIONS.map((option) => {
                                      const config = SEVERITY_CONFIG[option.value];
                                      const isActive = severityField.value === option.value;
                                      return (
                                        <button
                                          key={option.value}
                                          type="button"
                                          className={`severity-chip ${config.chipClass} ${isActive ? 'severity-active' : ''}`}
                                          onClick={() => {
                                            if (isActive) {
                                              severityField.onChange(undefined);
                                            } else {
                                              severityField.onChange(option.value);
                                            }
                                          }}
                                        >
                                          <span className={`severity-dot ${config.dotClass}`} style={isActive ? { background: 'currentColor', opacity: 0.6 } : undefined} />
                                          {config.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Treatments Section */}
                            {entryFindingId && (
                              <div className="treatments-divider">
                                <div className="flex items-center justify-between w-full pt-3">
                                  <div className="flex items-center gap-2">
                                    <Beaker className="h-4 w-4 text-amber-600/70" />
                                    <span className="font-bold text-sm">טיפולים מומלצים</span>
                                    {treatments.length > 0 && (
                                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                                        {treatments.length}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    className="add-button add-button-treatment"
                                    onClick={() => addTreatment(index)}
                                    disabled={!cropId || entryLoadingActionTypes[index]}
                                  >
                                    <Plus className="h-3 w-3" />
                                    הוסף טיפול
                                  </button>
                                </div>

                                <div className="w-full space-y-3 mt-3">
                                  {treatments.length === 0 && (
                                    <div className="empty-treatments">
                                      <Sparkles className="h-5 w-5 text-amber-400/60" />
                                      <p className="text-xs text-muted-foreground text-center">
                                        לחץ &quot;הוסף טיפול&quot; להוספת המלצות טיפול
                                      </p>
                                    </div>
                                  )}

                                  {treatments.map((_treatment, tIndex) => {
                                    const treatmentKey = `${index}-${tIndex}`;
                                    const treatmentActionTypeId = form.watch(`entries.${index}.treatments.${tIndex}.action_type_id`);
                                    const hasDosageRecommendation = !!treatmentRecommendedDosage[treatmentKey];

                                    return (
                                      <div key={tIndex} className="treatment-card p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <span className="treatment-number">{tIndex + 1}</span>
                                            <span className="text-xs font-semibold text-muted-foreground">טיפול</span>
                                            {hasDosageRecommendation && (
                                              <span className="recommended-badge">
                                                <Sparkles className="h-2.5 w-2.5" />
                                                מומלץ
                                              </span>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            className="delete-button"
                                            onClick={() => removeTreatment(index, tIndex)}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          {/* Action type select */}
                                          <FormField
                                            control={form.control}
                                            name={`entries.${index}.treatments.${tIndex}.action_type_id`}
                                            render={({ field: actionField }) => (
                                              <FormItem>
                                                <FormLabel className="font-semibold text-xs">
                                                  סוג פעולה
                                                  {entryLoadingActionTypes[index] && <LoadingSpinner />}
                                                </FormLabel>
                                                <Select
                                                  onValueChange={(v) => handleTreatmentActionTypeChange(v, index, tIndex)}
                                                  value={actionField.value}
                                                  disabled={!cropId || entryLoadingActionTypes[index]}
                                                >
                                                  <FormControl>
                                                    <SelectTrigger className="h-10 monitoring-select-trigger">
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
                                                <FormLabel className="font-semibold text-xs">
                                                  חומר מומלץ
                                                  {treatmentLoadingMaterials[treatmentKey] && <LoadingSpinner />}
                                                </FormLabel>
                                                <Select
                                                  onValueChange={(v) => handleTreatmentMaterialChange(v, index, tIndex)}
                                                  value={materialField.value}
                                                  disabled={!treatmentActionTypeId || treatmentLoadingMaterials[treatmentKey]}
                                                >
                                                  <FormControl>
                                                    <SelectTrigger className="h-10 monitoring-select-trigger">
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
                                                <FormLabel className="font-semibold text-xs">מינון</FormLabel>
                                                <FormControl>
                                                  <Input
                                                    {...dosageField}
                                                    value={dosageField.value || ''}
                                                    placeholder={
                                                      treatmentRecommendedDosage[treatmentKey]
                                                        ? `מומלץ: ${treatmentRecommendedDosage[treatmentKey]}`
                                                        : 'הזן מינון'
                                                    }
                                                    className="h-10 monitoring-select-trigger"
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
                                                <FormLabel className="font-semibold text-xs">יחידת מידה</FormLabel>
                                                <Select onValueChange={unitField.onChange} value={unitField.value}>
                                                  <FormControl>
                                                    <SelectTrigger className="h-10 monitoring-select-trigger">
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
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sticky Submit Footer */}
            <div className="sticky-footer">
              <div className="flex items-center justify-between gap-4">
                {/* Summary stats */}
                <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
                  {watchedAreaId && (
                    <>
                      <span className="flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5" />
                        {fields.length} {fields.length === 1 ? 'רשומה' : 'רשומות'}
                      </span>
                      <span className="w-px h-3.5 bg-border" />
                      <span className="flex items-center gap-1.5">
                        <Beaker className="h-3.5 w-3.5" />
                        {fields.reduce((sum, _, i) => sum + (form.watch(`entries.${i}.treatments`)?.length || 0), 0)} טיפולים
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="monitoring-submit flex items-center justify-center gap-2 h-12 px-8 w-full md:w-auto min-w-[200px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      <span>שומר...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>שמור דוח ניטור</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
