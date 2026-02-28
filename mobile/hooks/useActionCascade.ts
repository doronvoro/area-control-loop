import { useState, useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { api } from '../lib/api';

interface SelectOption {
  value: string;
  label: string;
}

interface FormData {
  isAdmin: boolean;
  customers: any[];
  initialAreas: any[];
  initialWorkers: any[];
  findings: any[];
  actionTypes: any[];
  unitTypes: any[];
  currentWorkerId?: string;
}

export interface ActionFormValues {
  customer_id?: string;
  worker_id: string;
  area_id: string;
  entries: {
    source: 'monitoring' | 'standalone';
    monitoring_report_id?: string;
    sub_area_id: string | null;
    sub_area_display?: string;
    finding_id: string;
    finding_name?: string;
    severity?: string;
    crop_id?: string;
    treatments: {
      action_type_id: string;
      material_id?: string;
      material: string;
      dosage: string;
      unit_type_id: string;
      status: string;
      notes?: string;
      monitoring_treatment_id?: string;
    }[];
  }[];
}

const EMPTY_TREATMENT = {
  action_type_id: '',
  material_id: '',
  material: '',
  dosage: '',
  unit_type_id: '',
  status: 'planned',
  notes: '',
  monitoring_treatment_id: '',
};

const EMPTY_ENTRY = {
  source: 'standalone' as const,
  sub_area_id: '',
  sub_area_display: '',
  finding_id: '',
  finding_name: '',
  severity: undefined as string | undefined,
  crop_id: '',
  treatments: [{ ...EMPTY_TREATMENT }],
};

export function useActionCascade(form: UseFormReturn<ActionFormValues>) {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loadingFormData, setLoadingFormData] = useState(true);

  const [workers, setWorkers] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [subAreas, setSubAreas] = useState<any[]>([]);
  const [entryActionTypes, setEntryActionTypes] = useState<Record<number, any[]>>({});
  const [treatmentMaterials, setTreatmentMaterials] = useState<Record<string, any[]>>({});
  const [treatmentLoadingMaterials, setTreatmentLoadingMaterials] = useState<Record<string, boolean>>({});

  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingSubAreas, setLoadingSubAreas] = useState(false);

  useEffect(() => {
    fetchFormData();
  }, []);

  const fetchFormData = async () => {
    try {
      const data = await api.get<FormData>('/api/actions/form-data');
      setFormData(data);
      setWorkers(data.initialWorkers || []);
      setAreas(data.initialAreas || []);

      if (data.currentWorkerId) {
        form.setValue('worker_id', data.currentWorkerId);
      }
    } catch (err) {
      console.error('Error fetching form data:', err);
    } finally {
      setLoadingFormData(false);
    }
  };

  const resetAllEntries = () => {
    form.setValue('entries', [{ ...EMPTY_ENTRY }]);
    setEntryActionTypes({});
    setTreatmentMaterials({});
    setTreatmentLoadingMaterials({});
  };

  // Cascade: customer → workers + areas
  const handleCustomerChange = async (customerId: string) => {
    form.setValue('customer_id', customerId);
    form.setValue('worker_id', '');
    form.setValue('area_id', '');
    setSubAreas([]);
    resetAllEntries();

    if (!customerId) {
      setWorkers([]);
      setAreas([]);
      return;
    }

    setLoadingWorkers(true);
    setLoadingAreas(true);
    try {
      const [workersData, areasData] = await Promise.all([
        api.get<any[]>('/api/workers', { customerId, type: 'action_worker' }),
        api.get<any[]>('/api/areas', { customerId }),
      ]);
      setWorkers(workersData);
      setAreas(areasData);
    } catch (err) {
      console.error('Error fetching workers/areas:', err);
    } finally {
      setLoadingWorkers(false);
      setLoadingAreas(false);
    }
  };

  // Cascade: area → sub-areas + monitoring data
  const handleAreaChange = async (areaId: string) => {
    form.setValue('area_id', areaId);
    resetAllEntries();

    if (!areaId) {
      setSubAreas([]);
      return;
    }

    setLoadingSubAreas(true);
    try {
      const [subAreasData, monitoringData] = await Promise.all([
        api.get<any[]>('/api/sub-areas', { areaId }),
        api.get<any[]>('/api/monitoring/by-area-for-actions', { areaId }),
      ]);
      setSubAreas(subAreasData);
      populateFromMonitoring(monitoringData);
    } catch (err) {
      console.error('Error fetching data:', err);
      resetAllEntries();
    } finally {
      setLoadingSubAreas(false);
    }
  };

  const populateFromMonitoring = (reports: any[]) => {
    const entries = reports
      .filter((r: any) => !r.already_has_action)
      .map((report: any) => {
        const treatments = (report.treatments || []).map((t: any) => ({
          action_type_id: t.action_type_id || '',
          material_id: t.material_id || '',
          material: t.material?.description || t.material?.name || '',
          dosage: t.dosage?.toString() || '',
          unit_type_id: t.unit_type_id || '',
          status: 'planned',
          notes: t.notes || '',
          monitoring_treatment_id: t.id || '',
        }));

        if (treatments.length === 0 && report.recommend_action_type_id) {
          treatments.push({
            action_type_id: report.recommend_action_type_id || '',
            material_id: report.recommend_material_id || '',
            material: report.recommend_material_name || '',
            dosage: report.recommend_dosage?.toString() || '',
            unit_type_id: report.recommend_unit_type_id || '',
            status: 'planned',
            notes: '',
            monitoring_treatment_id: '',
          });
        }

        if (treatments.length === 0) {
          treatments.push({ ...EMPTY_TREATMENT });
        }

        return {
          source: 'monitoring' as const,
          monitoring_report_id: report.monitoring_report_id,
          sub_area_id: report.sub_area_id,
          sub_area_display: report.sub_area_display || report.sub_area_name,
          finding_id: report.finding_id,
          finding_name: report.finding_name,
          severity: report.severity || undefined,
          crop_id: report.effective_crop_id || '',
          treatments,
        };
      });

    if (entries.length > 0) {
      form.setValue('entries', entries);
      // Pre-load cascade data
      entries.forEach((entry: any, entryIndex: number) => {
        if (entry.crop_id && entry.finding_id) {
          fetchActionTypes(entry.crop_id, entry.finding_id, entryIndex);
          entry.treatments.forEach((treatment: any, treatmentIndex: number) => {
            if (treatment.action_type_id) {
              fetchMaterials(entry.crop_id, entry.finding_id, treatment.action_type_id, entryIndex, treatmentIndex);
            }
          });
        }
      });
    } else {
      resetAllEntries();
    }
  };

  const fetchActionTypes = async (cropId: string, findingId: string, entryIndex: number) => {
    try {
      const data = await api.get<any[]>('/api/cascade', { type: 'action_types', cropId, findingId });
      setEntryActionTypes((prev) => ({ ...prev, [entryIndex]: data }));
    } catch (err) {
      console.error('Error fetching action types:', err);
    }
  };

  const fetchMaterials = async (
    cropId: string,
    findingId: string,
    actionTypeId: string,
    entryIndex: number,
    treatmentIndex: number
  ) => {
    const key = `${entryIndex}-${treatmentIndex}`;
    setTreatmentLoadingMaterials((prev) => ({ ...prev, [key]: true }));
    try {
      const data = await api.get<any[]>('/api/cascade', {
        type: 'materials',
        cropId,
        findingId,
        actionTypeId,
      });
      setTreatmentMaterials((prev) => ({ ...prev, [key]: data }));
    } catch (err) {
      console.error('Error fetching materials:', err);
    } finally {
      setTreatmentLoadingMaterials((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleTreatmentActionTypeChange = async (
    actionTypeId: string,
    entryIndex: number,
    treatmentIndex: number
  ) => {
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.action_type_id`, actionTypeId);
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.material_id`, '');
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.material`, '');
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.dosage`, '');
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.unit_type_id`, '');

    const entry = form.getValues(`entries.${entryIndex}`);
    const cropId = entry.crop_id;
    const findingId = entry.finding_id;

    if (cropId && findingId && actionTypeId) {
      await fetchMaterials(cropId, findingId, actionTypeId, entryIndex, treatmentIndex);
    }
  };

  const handleTreatmentMaterialChange = async (
    materialId: string,
    entryIndex: number,
    treatmentIndex: number
  ) => {
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.material_id`, materialId);

    const entry = form.getValues(`entries.${entryIndex}`);
    const cropId = entry.crop_id;
    const findingId = entry.finding_id;
    const actionTypeId = form.getValues(`entries.${entryIndex}.treatments.${treatmentIndex}.action_type_id`);

    if (cropId && findingId && actionTypeId && materialId) {
      try {
        const data = await api.get<any>('/api/cascade', {
          type: 'dosage',
          cropId,
          findingId,
          actionTypeId,
          materialId,
        });
        if (data) {
          form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.dosage`, data.dosage?.toString() || '');
          form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.unit_type_id`, data.unit_type_id || '');
        }
      } catch (err) {
        console.error('Error fetching dosage:', err);
      }
    }
  };

  // Entry management
  const addEntry = () => {
    const entries = form.getValues('entries');
    form.setValue('entries', [...entries, { ...EMPTY_ENTRY }]);
  };

  const removeEntry = (index: number) => {
    const entries = form.getValues('entries');
    form.setValue('entries', entries.filter((_, i) => i !== index));
  };

  const addTreatment = (entryIndex: number) => {
    const treatments = form.getValues(`entries.${entryIndex}.treatments`) || [];
    form.setValue(`entries.${entryIndex}.treatments`, [...treatments, { ...EMPTY_TREATMENT }]);
  };

  const removeTreatment = (entryIndex: number, treatmentIndex: number) => {
    const treatments = form.getValues(`entries.${entryIndex}.treatments`) || [];
    form.setValue(`entries.${entryIndex}.treatments`, treatments.filter((_, i) => i !== treatmentIndex));
  };

  // Select options
  const customerOptions: SelectOption[] = (formData?.customers || []).map((c: any) => ({
    value: c.id,
    label: c.name,
  }));

  const workerOptions: SelectOption[] = workers.map((w: any) => ({
    value: w.id,
    label: w.name,
  }));

  const areaOptions: SelectOption[] = areas.map((a: any) => ({
    value: a.id,
    label: a.name,
  }));

  const subAreaOptions: SelectOption[] = subAreas.map((sa: any) => ({
    value: sa.id,
    label: sa.display || sa.name,
  }));

  const findingOptions: SelectOption[] = (formData?.findings || []).map((f: any) => ({
    value: f.id,
    label: f.description || f.name,
  }));

  const actionTypeOptions: SelectOption[] = (formData?.actionTypes || []).map((at: any) => ({
    value: at.id,
    label: at.description || at.name,
  }));

  const unitTypeOptions: SelectOption[] = (formData?.unitTypes || []).map((u: any) => ({
    value: u.id,
    label: u.description || u.name,
  }));

  const getActionTypeOptions = (entryIndex: number): SelectOption[] =>
    (entryActionTypes[entryIndex] || formData?.actionTypes || []).map((at: any) => ({
      value: at.id,
      label: at.description || at.name,
    }));

  const getMaterialOptions = (entryIndex: number, treatmentIndex: number): SelectOption[] => {
    const key = `${entryIndex}-${treatmentIndex}`;
    return (treatmentMaterials[key] || []).map((m: any) => ({
      value: m.id,
      label: m.description || m.name,
    }));
  };

  const getLoadingMaterials = (entryIndex: number, treatmentIndex: number): boolean => {
    return !!treatmentLoadingMaterials[`${entryIndex}-${treatmentIndex}`];
  };

  const statusOptions: SelectOption[] = [
    { value: 'planned', label: 'מתוכנן' },
    { value: 'in_progress', label: 'בביצוע' },
    { value: 'completed', label: 'הושלם' },
  ];

  return {
    formData,
    loadingFormData,
    loadingWorkers,
    loadingAreas,
    loadingSubAreas,

    customerOptions,
    workerOptions,
    areaOptions,
    subAreaOptions,
    findingOptions,
    actionTypeOptions,
    unitTypeOptions,
    statusOptions,
    getActionTypeOptions,
    getMaterialOptions,
    getLoadingMaterials,

    handleCustomerChange,
    handleAreaChange,
    handleTreatmentActionTypeChange,
    handleTreatmentMaterialChange,
    addEntry,
    removeEntry,
    addTreatment,
    removeTreatment,
  };
}
