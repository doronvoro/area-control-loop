'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getSubAreaLabel } from '@/lib/utils';
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
  Copy,
  Leaf,
  X,
  RotateCcw,
  Calendar,
  Lock,
  LockOpen,
} from 'lucide-react';
import { ReportSeverity, SEVERITY_OPTIONS, SEVERITY_CONFIG, ActionTypeName, ACTION_TYPE_OPTIONS } from '@/types/database';
import { useSubAreaMaps } from '@/hooks/useSubAreaMaps';
import { MultiSelect } from '@/components/ui/multi-select';
import { ENTIRE_AREA, ENTIRE_AREA_DISPLAY, isEntireArea } from '@/lib/constants';
import { ReportDetailSheet } from '@/components/reports/ReportDetailSheet';
import { SearchableMaterialSelect } from '@/components/monitoring/SearchableMaterialSelect';

const treatmentSchema = z.object({
  action_type_id: z.string().optional(),
  material_id: z.string().optional(),
  dosage: z.string().optional(),
  unit_type_id: z.string().optional(),
  notes: z.string().optional(),
});

const subAreaEntrySchema = z.object({
  sub_area_ids: z.array(z.string()).min(1, 'נדרש לבחור לפחות תת-שטח אחד'),
  finding_ids: z.array(z.string()).min(1, 'נדרש לבחור לפחות ממצא אחד'),
  severity: z.nativeEnum(ReportSeverity).optional(),
  treatments: z.array(treatmentSchema),
});

const monitoringSchema = z.object({
  customer_id: z.string().min(1, 'נדרש לבחור לקוח'),
  inspector_id: z.string().min(1, 'נדרש לבחור פקח'),
  area_id: z.string().min(1, 'נדרש לבחור שטח'),
  report_date: z.string().optional(),
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
  const [savedReportNumber, setSavedReportNumber] = useState<number | null>(null);
  const [savedReportAreaId, setSavedReportAreaId] = useState<string | null>(null);
  const [showReportDetail, setShowReportDetail] = useState(false);
  const router = useRouter();

  // Collapsed state for entries
  const [collapsedEntries, setCollapsedEntries] = useState<Record<number, boolean>>({});

  // Dynamic data states - pre-loaded for non-admin users
  const [inspectors, setInspectors] = useState<any[]>(initialInspectors);
  const [areas, setAreas] = useState<any[]>(initialAreas);
  const [subAreas, setSubAreas] = useState<any[]>([]);

  // Default action type is spray
  const defaultActionTypeId = ActionTypeName.SPRAY;

  // Per-entry indexed state for cascade data
  const [entryFindings, setEntryFindings] = useState<Record<number, any[]>>({});
  const [entryLoadingFindings, setEntryLoadingFindings] = useState<Record<number, boolean>>({});
  const [entryCropIds, setEntryCropIds] = useState<Record<number, string | null>>({});

  // Per-treatment indexed state: key is "entryIndex-treatmentIndex"
  const [treatmentMaterials, setTreatmentMaterials] = useState<Record<string, any[]>>({});
  const [treatmentRecommendedDosage, setTreatmentRecommendedDosage] = useState<Record<string, string>>({});
  const [treatmentRecommendedUnitTypeId, setTreatmentRecommendedUnitTypeId] = useState<Record<string, string>>({});

  // Per-entry loading states
  // Per-treatment loading states
  const [treatmentLoadingMaterials, setTreatmentLoadingMaterials] = useState<Record<string, boolean>>({});

  // Unlock states: allow selecting any finding/material instead of crop-filtered ones
  const [unlockedFindings, setUnlockedFindings] = useState<Record<number, boolean>>({});
  const [unlockedMaterials, setUnlockedMaterials] = useState<Record<string, boolean>>({});
  const [allMaterials, setAllMaterials] = useState<any[] | null>(null);

  // Loading states
  const [loadingInspectors, setLoadingInspectors] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingSubAreas, setLoadingSubAreas] = useState(false);

  // Quick-resume from localStorage
  const [lastSelections, setLastSelections] = useState<{
    inspector_id?: string; area_id?: string; inspector_name?: string; area_name?: string;
  } | null>(null);
  const [showQuickResume, setShowQuickResume] = useState(false);

  // Auto-dismiss quick resume toast after 10 seconds
  useEffect(() => {
    if (showQuickResume) {
      const timer = setTimeout(() => setShowQuickResume(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showQuickResume]);

  // Step completion pulse tracking
  const prevStepRef = useRef(0);
  const [justCompletedSteps, setJustCompletedSteps] = useState<Set<number>>(new Set());

  const form = useForm<MonitoringFormData>({
    resolver: zodResolver(monitoringSchema),
    defaultValues: {
      customer_id: !isAdmin && customerIdForData ? customerIdForData : '',
      inspector_id: '',
      area_id: '',
      report_date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
      entries: [{
        sub_area_ids: [],
        finding_ids: [],
        severity: ReportSeverity.LOW,
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
  const watchedEntries = form.watch('entries');
  const allEntriesHaveFinding = watchedEntries?.length > 0 && watchedEntries.every((e: any) => e.finding_ids?.length > 0);

  // Dismiss quick resume and success banner when user starts filling the form
  useEffect(() => {
    if (watchedInspectorId || watchedAreaId) {
      if (showQuickResume) setShowQuickResume(false);
      if (success) setSuccess(false);
    }
  }, [watchedInspectorId, watchedAreaId, showQuickResume, success]);

  // Progress step calculation
  const currentStep = useMemo(() => {
    if (isAdmin) {
      if (!watchedCustomerId) return 0;
      if (!watchedInspectorId) return 1;
      if (!watchedAreaId) return 2;
      return 3;
    }
    // Non-admin: no customer step
    if (!watchedInspectorId) return 0;
    if (!watchedAreaId) return 1;
    return 2;
  }, [isAdmin, watchedCustomerId, watchedInspectorId, watchedAreaId]);


  // Load last selections from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('monitoring_last_selections');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.inspector_id && saved?.area_id) {
          setLastSelections(saved);
          setShowQuickResume(true);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Track step completion for pulse animation
  useEffect(() => {
    if (currentStep > prevStepRef.current) {
      const newCompleted = new Set<number>();
      for (let i = prevStepRef.current; i < currentStep; i++) {
        newCompleted.add(i);
      }
      setJustCompletedSteps(newCompleted);
      const timer = setTimeout(() => setJustCompletedSteps(new Set()), 600);
      prevStepRef.current = currentStep;
      return () => clearTimeout(timer);
    }
    prevStepRef.current = currentStep;
  }, [currentStep]);

  // Auto-scroll to next field on selection
  const scrollToNext = useCallback((elementId: string) => {
    setTimeout(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, []);

  useEffect(() => {
    if (watchedCustomerId && !watchedInspectorId) {
      scrollToNext('inspector-section');
    }
  }, [watchedCustomerId]);

  useEffect(() => {
    if (watchedInspectorId && !watchedAreaId) {
      scrollToNext('area-section');
    }
  }, [watchedInspectorId]);

  useEffect(() => {
    if (watchedAreaId) {
      scrollToNext('entries-section');
    }
  }, [watchedAreaId]);

  // Quick resume handler
  const handleQuickResume = useCallback(() => {
    if (!lastSelections) return;
    const { inspector_id, area_id } = lastSelections;
    if (inspector_id && inspectors.some(i => i.id === inspector_id)) {
      form.setValue('inspector_id', inspector_id);
    }
    if (area_id && areas.some(a => a.id === area_id)) {
      form.setValue('area_id', area_id);
    }
    setShowQuickResume(false);
  }, [lastSelections, inspectors, areas, form]);

  // Duplicate entry handler
  const duplicateEntry = useCallback((index: number) => {
    const source = form.getValues(`entries.${index}`);
    append({
      sub_area_ids: [],
      finding_ids: source.finding_ids,
      severity: source.severity,
      treatments: source.treatments.map(t => ({ ...t })),
    });
    const newIndex = fields.length;
    const cropId = entryCropIds[index];
    if (cropId) {
      setEntryCropIds(prev => ({ ...prev, [newIndex]: cropId }));
      setEntryFindings(prev => ({ ...prev, [newIndex]: entryFindings[index] || findings }));
      // Copy unlock states for findings
      if (unlockedFindings[index]) {
        setUnlockedFindings(prev => ({ ...prev, [newIndex]: true }));
      }
      source.treatments.forEach((_, tIdx) => {
        const srcKey = `${index}-${tIdx}`;
        const dstKey = `${newIndex}-${tIdx}`;
        if (treatmentMaterials[srcKey]) {
          setTreatmentMaterials(prev => ({ ...prev, [dstKey]: treatmentMaterials[srcKey] }));
        }
        if (treatmentRecommendedDosage[srcKey]) {
          setTreatmentRecommendedDosage(prev => ({ ...prev, [dstKey]: treatmentRecommendedDosage[srcKey] }));
          setTreatmentRecommendedUnitTypeId(prev => ({ ...prev, [dstKey]: treatmentRecommendedUnitTypeId[srcKey] }));
        }
        if (unlockedMaterials[srcKey]) {
          setUnlockedMaterials(prev => ({ ...prev, [dstKey]: true }));
        }
      });
    }
  }, [form, append, fields.length, entryCropIds, entryFindings, findings, treatmentMaterials, treatmentRecommendedDosage, treatmentRecommendedUnitTypeId, unlockedFindings, unlockedMaterials]);

  // Fetch inspectors and areas when customer changes (admin only)
  useEffect(() => {
    if (isAdmin && watchedCustomerId) {
      fetchInspectorsAndAreas(watchedCustomerId);
      // Reset dependent fields
      form.setValue('inspector_id', '');
      form.setValue('area_id', '');
      form.setValue('entries', [{
        sub_area_ids: [],
        finding_ids: [],
        severity: ReportSeverity.LOW,
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
        sub_area_ids: [],
        finding_ids: [],
        severity: ReportSeverity.LOW,
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
    setTreatmentMaterials({});
    setTreatmentRecommendedDosage({});
    setTreatmentRecommendedUnitTypeId({});
    setTreatmentLoadingMaterials({});
    setCollapsedEntries({});
    setUnlockedFindings({});
    setUnlockedMaterials({});
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

  const fetchFindingsForEntry = async (cropId: string, index: number) => {
    setEntryLoadingFindings(prev => ({ ...prev, [index]: true }));
    try {
      const res = await fetch(`/api/cascade?type=findings&cropId=${cropId}`);
      if (res.ok) {
        const data = await res.json();
        // If crop has specific findings use them, otherwise fall back to all findings
        setEntryFindings(prev => ({ ...prev, [index]: data.length > 0 ? data : findings }));
      } else {
        setEntryFindings(prev => ({ ...prev, [index]: findings }));
      }
    } catch (err) {
      console.error('Error fetching findings:', err);
      setEntryFindings(prev => ({ ...prev, [index]: findings }));
    } finally {
      setEntryLoadingFindings(prev => ({ ...prev, [index]: false }));
    }
  };

  const fetchMaterialsForTreatment = async (cropId: string, findingIds: string[], actionTypeId: string, entryIndex: number, treatmentIndex: number) => {
    const key = `${entryIndex}-${treatmentIndex}`;
    setTreatmentLoadingMaterials(prev => ({ ...prev, [key]: true }));
    try {
      const params = new URLSearchParams({ type: 'materials', cropId });
      if (findingIds.length > 0) params.set('findingIds', findingIds.join(','));
      if (actionTypeId) params.set('actionTypeId', actionTypeId);
      const res = await fetch(`/api/cascade?${params}`);
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
      const params = new URLSearchParams({ type: 'dosage', cropId, findingId, materialId });
      if (actionTypeId) params.set('actionTypeId', actionTypeId);
      const res = await fetch(`/api/cascade?${params}`);
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

  const fetchAllMaterials = async () => {
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
  };

  // Build parentMap + levelMap for multi-select hierarchy support
  const { parentMap: subAreaParentMap, levelMap: subAreaLevelMap } = useSubAreaMaps(subAreas);

  // Entry-specific handlers
  const handleSubAreaIdsChange = (subAreaIds: string[], index: number) => {
    form.setValue(`entries.${index}.sub_area_ids`, subAreaIds);

    // Determine the effective crop ID for the cascade
    const selectedArea = areas.find(a => a.id === watchedAreaId);
    const areaCropId = selectedArea?.crop_id || null;

    let effectiveCropId: string | null = null;
    if (subAreaIds.length > 0) {
      if (isEntireArea(subAreaIds[0])) {
        // Entire area selected - use area-level crop
        effectiveCropId = areaCropId;
      } else {
        const cropIds = subAreaIds
          .map(id => {
            const sa = subAreas.find(s => s.id === id);
            return sa?.effective_crop_id || sa?.crop_id || areaCropId;
          })
          .filter(Boolean);
        const uniqueCrops = [...new Set(cropIds)];
        effectiveCropId = uniqueCrops.length === 1 ? uniqueCrops[0] : areaCropId;
      }
    }

    setEntryCropIds(prev => ({ ...prev, [index]: effectiveCropId }));

    // Fetch crop-specific findings
    if (effectiveCropId) {
      fetchFindingsForEntry(effectiveCropId, index);
    } else {
      setEntryFindings(prev => ({ ...prev, [index]: findings }));
    }

    // Reset dependent fields for this entry
    form.setValue(`entries.${index}.finding_ids`, []);
    form.setValue(`entries.${index}.treatments`, []);

    cleanupTreatmentStateForEntry(index);
  };

  const handleFindingIdsChange = (findingIds: string[], index: number) => {
    form.setValue(`entries.${index}.finding_ids`, findingIds);
    const cropId = entryCropIds[index];

    // Reset treatments when findings change and auto-add one with default action type (ריסוס)
    form.setValue(`entries.${index}.treatments`, [
      { action_type_id: defaultActionTypeId, material_id: '', dosage: '', unit_type_id: '', notes: '' }
    ]);
    cleanupTreatmentStateForEntry(index);

    if (findingIds.length > 0 && cropId) {
      // Preload materials for the auto-added treatment using all selected findings
      fetchMaterialsForTreatment(cropId, findingIds, defaultActionTypeId, index, 0);
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
    setUnlockedMaterials(cleanupState);
  };

  const handleTreatmentActionTypeChange = (actionTypeId: string, entryIndex: number, treatmentIndex: number) => {
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.action_type_id`, actionTypeId);
    const cropId = entryCropIds[entryIndex];
    const findingIds = form.getValues(`entries.${entryIndex}.finding_ids`) || [];
    const key = `${entryIndex}-${treatmentIndex}`;

    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.material_id`, '');
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.dosage`, '');
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.unit_type_id`, '');
    setTreatmentRecommendedDosage(prev => ({ ...prev, [key]: '' }));
    setTreatmentRecommendedUnitTypeId(prev => ({ ...prev, [key]: '' }));

    if (cropId && findingIds.length > 0) {
      fetchMaterialsForTreatment(cropId, findingIds, actionTypeId || '', entryIndex, treatmentIndex);
    } else {
      setTreatmentMaterials(prev => ({ ...prev, [key]: [] }));
    }
  };

  const handleTreatmentMaterialChange = (materialId: string, entryIndex: number, treatmentIndex: number) => {
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.material_id`, materialId);
    const cropId = entryCropIds[entryIndex];
    const findingIds = form.getValues(`entries.${entryIndex}.finding_ids`) || [];
    const primaryFindingId = findingIds[0];
    const actionTypeId = form.getValues(`entries.${entryIndex}.treatments.${treatmentIndex}.action_type_id`);

    if (cropId && primaryFindingId && materialId) {
      fetchDosageForTreatment(cropId, primaryFindingId, actionTypeId || '', materialId, entryIndex, treatmentIndex);
    }
  };

  const addTreatment = (entryIndex: number) => {
    const currentTreatments = form.getValues(`entries.${entryIndex}.treatments`) || [];
    const newTreatmentIndex = currentTreatments.length;

    form.setValue(`entries.${entryIndex}.treatments`, [
      ...currentTreatments,
      { action_type_id: defaultActionTypeId, material_id: '', dosage: '', unit_type_id: '', notes: '' }
    ]);

    // Preload materials for the new treatment
    const cropId = entryCropIds[entryIndex];
    const findingIds = form.getValues(`entries.${entryIndex}.finding_ids`) || [];
    if (cropId && findingIds.length > 0) {
      fetchMaterialsForTreatment(cropId, findingIds, defaultActionTypeId, entryIndex, newTreatmentIndex);
    }
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
    setUnlockedMaterials(rebuildTreatmentState);
  };

  const addEntry = () => {
    append({
      sub_area_ids: [],
      finding_ids: [],
      severity: ReportSeverity.LOW,
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
    setUnlockedFindings(rebuildState);
    setTreatmentMaterials(rebuildTreatmentState);
    setTreatmentRecommendedDosage(rebuildTreatmentState);
    setTreatmentRecommendedUnitTypeId(rebuildTreatmentState);
    setTreatmentLoadingMaterials(rebuildTreatmentState);
    setUnlockedMaterials(rebuildTreatmentState);

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
    const subAreaIds = form.watch(`entries.${index}.sub_area_ids`) || [];
    const findingIds = form.watch(`entries.${index}.finding_ids`) || [];
    const severity = form.watch(`entries.${index}.severity`);
    const treatments = form.watch(`entries.${index}.treatments`) || [];

    const hasEntireArea = subAreaIds.length > 0 && isEntireArea(subAreaIds[0]);

    const selectedSubAreas = hasEntireArea
      ? []
      : subAreaIds
          .map((id: string) => subAreas.find(sa => sa.id === id))
          .filter(Boolean);

    const subAreaName = hasEntireArea
      ? ENTIRE_AREA_DISPLAY
      : selectedSubAreas.length === 0
        ? ''
        : selectedSubAreas.length === 1
          ? (selectedSubAreas[0]?.display || selectedSubAreas[0]?.name || '')
          : `${selectedSubAreas.length} תתי-שטח`;

    const selectedFindings = findingIds
      .map((id: string) => findings.find(f => f.id === id))
      .filter(Boolean);
    const findingName = selectedFindings.length === 0
      ? ''
      : selectedFindings.length === 1
        ? (selectedFindings[0]?.description || selectedFindings[0]?.name || '')
        : `${selectedFindings.length} ממצאים`;

    return {
      subAreaName,
      findingName,
      severity,
      treatmentCount: treatments.length,
    };
  };

  const onSubmit = async (data: MonitoringFormData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Expand finding_ids into separate entries (one per finding) and convert ENTIRE_AREA sentinel
      const entries = data.entries.flatMap(entry => {
        const subAreaIds = entry.sub_area_ids.includes(ENTIRE_AREA)
          ? [null]
          : entry.sub_area_ids;
        return entry.finding_ids.map(findingId => ({
          ...entry,
          sub_area_ids: subAreaIds,
          finding_id: findingId,
          finding_ids: undefined,
        }));
      });

      const response = await fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: data.customer_id,
          inspector_id: data.inspector_id,
          area_id: data.area_id,
          report_date: data.report_date || null,
          entries,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בשמירת הדוח');
      }

      const responseData = await response.json();
      setSavedReportNumber(responseData?.report_number ?? null);
      setSavedReportAreaId(responseData?.report_area_id ?? null);

      // Save selections to localStorage for quick-resume
      try {
        const selectedInspector = inspectors.find(i => i.id === data.inspector_id);
        const selectedArea = areas.find(a => a.id === data.area_id);
        localStorage.setItem('monitoring_last_selections', JSON.stringify({
          inspector_id: data.inspector_id,
          area_id: data.area_id,
          inspector_name: selectedInspector?.name || '',
          area_name: selectedArea?.name || '',
        }));
      } catch { /* ignore */ }

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

      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const LoadingSpinner = () => <Loader2 className="h-3.5 w-3.5 animate-spin inline ms-1.5 opacity-60" />;

  const steps = [
    ...(isAdmin ? [{ label: 'לקוח', icon: User }] : []),
    { label: 'פקח', icon: User },
    { label: 'שטח', icon: MapPin },
    { label: 'ממצאים', icon: ClipboardList },
  ];

  return (
    <div className="monitoring-form-container max-w-4xl mx-auto">
      {/* Hero Header */}
      <div className="monitoring-hero px-6 py-5 md:px-8 md:py-6">
        <div className="hero-pattern" />
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              טופס ניטור חדש
            </h2>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="progress-steps">
        {steps.map((step, i) => (
          <div key={i} className="progress-step">
            <div className="flex flex-col items-center gap-1">
              <div className={`step-circle ${
                i < currentStep ? 'step-circle-complete' :
                i === currentStep ? 'step-circle-active' :
                'step-circle-pending'
              } ${justCompletedSteps.has(i) ? 'step-circle-just-completed' : ''}`}>
                {i < currentStep ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <step.icon className="h-3.5 w-3.5" />
                )}
                {i === steps.length - 1 && currentStep >= steps.length - 1 && fields.length > 0 && (
                  <span className="step-badge">{fields.length}</span>
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

      {/* Quick Resume Toast */}
      {showQuickResume && lastSelections && (
        <button
          type="button"
          className="quick-resume-toast"
          onClick={handleQuickResume}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>המשך מהניטור הקודם?</span>
          {lastSelections.area_name && (
            <span className="font-bold">{lastSelections.area_name}</span>
          )}
          <span
            className="quick-resume-close"
            onClick={(e) => { e.stopPropagation(); setShowQuickResume(false); }}
          >
            <X className="h-3 w-3" />
          </span>
        </button>
      )}

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
                <p className="text-sm font-bold flex-1">
                  הדוח נשמר בהצלחה!
                  {savedReportNumber && <span> (דוח מס׳ {savedReportNumber})</span>}
                </p>
                {savedReportAreaId && (
                  <button
                    type="button"
                    className="flex-shrink-0 text-sm font-semibold text-green-700 underline underline-offset-2 hover:text-green-900 transition-colors"
                    onClick={() => setShowReportDetail(true)}
                  >
                    צפה בדוח
                  </button>
                )}
                <button
                  type="button"
                  className="flex-shrink-0 p-1 rounded-full hover:bg-green-200/60 transition-colors"
                  onClick={() => setSuccess(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Report Detail Sheet */}
            <ReportDetailSheet
              reportId={savedReportAreaId}
              open={showReportDetail}
              onOpenChange={setShowReportDetail}
            />

            {/* Section 1: Customer & Inspector Selection */}
            <div id="customer-section" className={`monitoring-section section-customer px-5 py-3.5 ${
              currentStep === 0 ? 'section-entering' : currentStep > 1 ? 'section-completed' : ''
            }`}>
              {isAdmin ? (
                <>
                  <div className="section-header">
                    <div className="section-icon section-icon-customer">
                      <User className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-base">פרטי לקוח ופקח</h3>
                    {watchedCustomerId && watchedInspectorId && (
                      <span className="field-check"><Check className="h-2.5 w-2.5" /></span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customer_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-sm">לקוח *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9 monitoring-select-trigger">
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
                        <FormItem id="inspector-section">
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
                              <SelectTrigger className="h-9 monitoring-select-trigger">
                                <SelectValue placeholder={
                                  !watchedCustomerId ? 'בחר לקוח תחילה' : 'בחר'
                                } />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent position="popper" sideOffset={4}>
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
                </>
              ) : (
                <div className="section-header-inline">
                  <div className="section-icon section-icon-customer shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-base shrink-0">פקח</h3>
                  {loadingInspectors && <LoadingSpinner />}

                  <div className="flex items-center shrink-0">
                    <FormField
                      control={form.control}
                      name="inspector_id"
                      render={({ field }) => (
                        <FormItem id="inspector-section">
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!watchedCustomerId || loadingInspectors}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9 w-64 monitoring-select-trigger">
                                <SelectValue placeholder="בחר" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent position="popper" sideOffset={4}>
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
                    {watchedInspectorId && (
                      <span className="field-check"><Check className="h-2.5 w-2.5" /></span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Area Selection */}
            <div id="area-section" className={`monitoring-section section-area px-5 py-3.5 ${
              currentStep === 2 ? 'section-entering' : currentStep > 2 ? 'section-completed' : ''
            }`}>
              <div className="section-header-inline">
                <div className="section-icon section-icon-area shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-base shrink-0">שטח</h3>
                {loadingAreas && <LoadingSpinner />}
                <div className="flex items-center shrink-0">
                  <FormField
                    control={form.control}
                    name="area_id"
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!watchedCustomerId || loadingAreas}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9 w-64 monitoring-select-trigger">
                              <SelectValue placeholder={
                                !watchedCustomerId ? 'בחר לקוח תחילה' : 'בחר'
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper" sideOffset={4}>
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
                  {watchedAreaId && (
                    <span className="field-check"><Check className="h-2.5 w-2.5" /></span>
                  )}
                  {watchedAreaId && (() => {
                    const selectedArea = areas.find(a => a.id === watchedAreaId);
                    const cropName = selectedArea?.crops?.name;
                    const variety = selectedArea?.variety;
                    return cropName ? (
                      <div className="area-info-badge" style={{ margin: 0 }}>
                        <Leaf className="h-3 w-3" />
                        <span>{cropName}{variety ? `, ${variety}` : ''}</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>

            {/* Report Date */}
            <div className="monitoring-section section-date px-5 py-3.5">
              <div className="section-header-inline">
                <div className="section-icon section-icon-date shrink-0">
                  <Calendar className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-base shrink-0">מועד</h3>
                <FormField
                  control={form.control}
                  name="report_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          className="h-9 w-64 monitoring-select-trigger monitoring-date-input"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section 3: Sub-Area Entries */}
            {watchedAreaId && (
              <div id="entries-section" className="monitoring-section section-entries section-entering p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="section-icon section-icon-entries">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">ממצאים</h3>
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
                    הוסף
                  </button>
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => {
                    const entrySubAreaIds = form.watch(`entries.${index}.sub_area_ids`) || [];
                    const entryFindingIds = form.watch(`entries.${index}.finding_ids`) || [];
                    const treatments = form.watch(`entries.${index}.treatments`) || [];
                    const cropId = entryCropIds[index];
                    const isCollapsed = collapsedEntries[index] && entrySubAreaIds.length > 0;
                    const summary = getEntrySummary(index);

                    return (
                      <div key={field.id} className="entry-card p-4 space-y-4">
                        {/* Entry Header */}
                        <div className="flex items-center justify-between">
                          <div
                            className="flex items-center gap-2.5 flex-1 cursor-pointer"
                            onClick={() => entrySubAreaIds.length > 0 && toggleEntryCollapse(index)}
                          >
                            <span className="entry-number">{index + 1}</span>
                            {isCollapsed && summary.subAreaName && (
                              <div className="flex items-center gap-2 text-sm flex-wrap">
                                <span className="font-medium text-foreground/80">{summary.subAreaName}</span>
                                {summary.findingName && (
                                  <>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="text-xs text-muted-foreground">{summary.findingName}</span>
                                  </>
                                )}
                                {summary.severity && (
                                  <span className={`severity-chip-mini ${SEVERITY_CONFIG[summary.severity]?.chipClass}`}>
                                    {SEVERITY_CONFIG[summary.severity]?.label}
                                  </span>
                                )}
                                {summary.treatmentCount > 0 && (
                                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                                    <Beaker className="h-2.5 w-2.5 inline me-0.5" />
                                    {summary.treatmentCount}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {/* Duplicate button */}
                            {entryFindingIds?.length > 0 && (
                              <button
                                type="button"
                                className="duplicate-button"
                                onClick={() => duplicateEntry(index)}
                                title="שכפל רשומה"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {entrySubAreaIds.length > 0 && (
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
                              {/* Sub-area multi-select */}
                              <FormField
                                control={form.control}
                                name={`entries.${index}.sub_area_ids`}
                                render={({ field: subField }) => (
                                  <FormItem className="md:col-span-2">
                                    <FormLabel className="font-semibold text-sm">
                                      תתי-שטח *
                                      {loadingSubAreas && <LoadingSpinner />}
                                    </FormLabel>
                                    <FormControl>
                                      <MultiSelect
                                        options={subAreas.map((sa) => {
                                          const selectedArea = areas.find(a => a.id === watchedAreaId);
                                          return {
                                            value: sa.id,
                                            label: getSubAreaLabel(sa, selectedArea?.crops?.name, selectedArea?.variety),
                                            shortLabel: sa.name,
                                          };
                                        })}
                                        value={subField.value}
                                        onValueChange={(ids) => handleSubAreaIdsChange(ids, index)}
                                        placeholder="בחר תתי-שטח"
                                        selectAllLabel="בחר את כל השטח"
                                        parentMap={subAreaParentMap}
                                        levelMap={subAreaLevelMap}
                                        disabled={loadingSubAreas}
                                        className="monitoring-select-trigger"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {/* Finding multi-select */}
                              <FormField
                                control={form.control}
                                name={`entries.${index}.finding_ids`}
                                render={({ field: findingField }) => (
                                  <FormItem className="md:col-span-2">
                                    <div className="flex items-center gap-1.5">
                                      <FormLabel className="font-semibold text-sm">
                                        ממצא *
                                        {entryLoadingFindings[index] && <LoadingSpinner />}
                                      </FormLabel>
                                      {entryFindings[index] && entryFindings[index] !== findings && (
                                        <button
                                          type="button"
                                          onClick={() => setUnlockedFindings(prev => ({ ...prev, [index]: !prev[index] }))}
                                          className="p-0.5 rounded hover:bg-accent text-muted-foreground transition-colors"
                                          title={unlockedFindings[index] ? 'הצג רק ממצאים מומלצים' : 'הצג את כל הממצאים'}
                                        >
                                          {unlockedFindings[index]
                                            ? <LockOpen className="h-3.5 w-3.5 text-orange-500" />
                                            : <Lock className="h-3.5 w-3.5" />}
                                        </button>
                                      )}
                                    </div>
                                    <FormControl>
                                      <MultiSelect
                                        options={[...(unlockedFindings[index] ? findings : (entryFindings[index] || findings))]
                                          .sort((a, b) => (a.description || a.name || '').localeCompare(b.description || b.name || '', 'he'))
                                          .map((finding) => ({
                                            value: finding.id,
                                            label: finding.description || finding.name,
                                          }))}
                                        value={findingField.value}
                                        onValueChange={(ids) => handleFindingIdsChange(ids, index)}
                                        placeholder={entrySubAreaIds.length === 0 ? 'בחר תתי-שטח תחילה' : 'בחר ממצאים'}
                                        showSelectAll={false}
                                        disabled={entrySubAreaIds.length === 0 || entryLoadingFindings[index]}
                                        className="monitoring-select-trigger"
                                      />
                                    </FormControl>
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
                            {entryFindingIds?.length > 0 && (
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
                                    disabled={!cropId}
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
                                          {/* Material select */}
                                          <FormField
                                            control={form.control}
                                            name={`entries.${index}.treatments.${tIndex}.material_id`}
                                            render={({ field: materialField }) => (
                                              <FormItem>
                                                <div className="flex items-center gap-1.5">
                                                  <FormLabel className="font-semibold text-xs">
                                                    חומר מומלץ
                                                    {treatmentLoadingMaterials[treatmentKey] && <LoadingSpinner />}
                                                  </FormLabel>
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
                                                <FormControl>
                                                  <SearchableMaterialSelect
                                                    materials={unlockedMaterials[treatmentKey] ? (allMaterials || []) : (treatmentMaterials[treatmentKey] || [])}
                                                    value={materialField.value}
                                                    onValueChange={(v) => handleTreatmentMaterialChange(v, index, tIndex)}
                                                    disabled={treatmentLoadingMaterials[treatmentKey]}
                                                    placeholder="בחר חומר"
                                                  />
                                                </FormControl>
                                                <FormMessage />
                                              </FormItem>
                                            )}
                                          />

                                          {/* Action type select */}
                                          <FormField
                                            control={form.control}
                                            name={`entries.${index}.treatments.${tIndex}.action_type_id`}
                                            render={({ field: actionField }) => (
                                              <FormItem>
                                                <FormLabel className="font-semibold text-xs">
                                                  סוג פעולה
                                                </FormLabel>
                                                <Select
                                                  onValueChange={(v) => handleTreatmentActionTypeChange(v, index, tIndex)}
                                                  value={actionField.value}
                                                >
                                                  <FormControl>
                                                    <SelectTrigger className="h-10 w-full monitoring-select-trigger">
                                                      <SelectValue placeholder="בחר סוג פעולה" />
                                                    </SelectTrigger>
                                                  </FormControl>
                                                  <SelectContent position="popper" sideOffset={4}>
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
                                                    <SelectTrigger className="h-10 w-full monitoring-select-trigger">
                                                      <SelectValue placeholder="בחר יחידת מידה" />
                                                    </SelectTrigger>
                                                  </FormControl>
                                                  <SelectContent position="popper" sideOffset={4}>
                                                    {[...unitTypes].sort((a, b) => (a.description || a.name || '').localeCompare(b.description || b.name || '', 'he')).map((unit) => (
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

                                        {/* Notes input */}
                                        <FormField
                                          control={form.control}
                                          name={`entries.${index}.treatments.${tIndex}.notes`}
                                          render={({ field: notesField }) => (
                                            <FormItem>
                                              <FormLabel className="font-semibold text-xs">הערות</FormLabel>
                                              <FormControl>
                                                <Input
                                                  {...notesField}
                                                  value={notesField.value || ''}
                                                  placeholder="הערות..."
                                                  className="h-10 monitoring-select-trigger"
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
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
                {/* Summary stats - visible on all sizes */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {watchedAreaId && (
                    <>
                      <span className="flex items-center gap-1">
                        <ClipboardList className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">{fields.length} {fields.length === 1 ? 'רשומה' : 'רשומות'}</span>
                        <span className="md:hidden">{fields.length}</span>
                      </span>
                      <span className="w-px h-3.5 bg-border" />
                      <span className="flex items-center gap-1">
                        <Beaker className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">
                          {fields.reduce((sum, _, i) => sum + (form.watch(`entries.${i}.treatments`)?.length || 0), 0)} טיפולים
                        </span>
                        <span className="md:hidden">
                          {fields.reduce((sum, _, i) => sum + (form.watch(`entries.${i}.treatments`)?.length || 0), 0)}
                        </span>
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !watchedInspectorId || !watchedAreaId || !allEntriesHaveFinding}
                  className={`monitoring-submit flex items-center justify-center gap-2 h-12 px-8 w-full md:w-auto min-w-[200px] ${
                    !loading && watchedInspectorId && watchedAreaId && allEntriesHaveFinding ? 'monitoring-submit-ready' : ''
                  }`}
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
