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
  initialInspectors: any[];
  initialAreas: any[];
  findings: any[];
  unitTypes: any[];
  customerIdForData: string | null;
}

export interface MonitoringFormValues {
  customer_id: string;
  inspector_id: string;
  area_id: string;
  entries: {
    sub_area_id: string | null;
    finding_id: string;
    severity?: string;
    treatments: {
      action_type_id?: string;
      material_id?: string;
      dosage?: string;
      unit_type_id?: string;
      notes?: string;
    }[];
  }[];
}

const EMPTY_ENTRY = {
  sub_area_id: '',
  finding_id: '',
  severity: undefined as string | undefined,
  treatments: [],
};

export function useMonitoringCascade(form: UseFormReturn<MonitoringFormValues>) {
  // Form data from API
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loadingFormData, setLoadingFormData] = useState(true);

  // Dynamic cascade data
  const [inspectors, setInspectors] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [subAreas, setSubAreas] = useState<any[]>([]);
  const [entryActionTypes, setEntryActionTypes] = useState<Record<number, any[]>>({});
  const [entryCropIds, setEntryCropIds] = useState<Record<number, string | null>>({});
  const [treatmentMaterials, setTreatmentMaterials] = useState<Record<string, any[]>>({});
  const [treatmentLoadingMaterials, setTreatmentLoadingMaterials] = useState<Record<string, boolean>>({});

  // Loading states
  const [loadingInspectors, setLoadingInspectors] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingSubAreas, setLoadingSubAreas] = useState(false);
  const [entryLoadingActionTypes, setEntryLoadingActionTypes] = useState<Record<number, boolean>>({});

  // Fetch initial form data
  useEffect(() => {
    fetchFormData();
  }, []);

  const fetchFormData = async () => {
    try {
      const data = await api.get<FormData>('/api/monitoring/form-data');
      setFormData(data);
      setInspectors(data.initialInspectors || []);
      setAreas(data.initialAreas || []);

      if (!data.isAdmin && data.customerIdForData) {
        form.setValue('customer_id', data.customerIdForData);
      }
    } catch (err) {
      console.error('Error fetching form data:', err);
    } finally {
      setLoadingFormData(false);
    }
  };

  // Cascade: customer → inspectors + areas
  const handleCustomerChange = async (customerId: string) => {
    form.setValue('customer_id', customerId);
    form.setValue('inspector_id', '');
    form.setValue('area_id', '');
    form.setValue('entries', [{ ...EMPTY_ENTRY }]);
    setSubAreas([]);
    resetAllEntryState();

    if (!customerId) {
      setInspectors([]);
      setAreas([]);
      return;
    }

    setLoadingInspectors(true);
    setLoadingAreas(true);
    try {
      const [inspectorsData, areasData] = await Promise.all([
        api.get<any[]>('/api/workers', { customerId, type: 'inspector' }),
        api.get<any[]>('/api/customer-areas', { customerId }),
      ]);
      setInspectors(inspectorsData);
      const areasList = areasData.map((ca: any) => ca.areas || ca).filter(Boolean);
      setAreas(areasList);
    } catch (err) {
      console.error('Error fetching inspectors/areas:', err);
    } finally {
      setLoadingInspectors(false);
      setLoadingAreas(false);
    }
  };

  // Cascade: area → sub-areas
  const handleAreaChange = async (areaId: string) => {
    form.setValue('area_id', areaId);
    form.setValue('entries', [{ ...EMPTY_ENTRY }]);
    resetAllEntryState();

    if (!areaId) {
      setSubAreas([]);
      return;
    }

    setLoadingSubAreas(true);
    try {
      const data = await api.get<any[]>('/api/sub-areas', { areaId });
      setSubAreas(data);
    } catch (err) {
      console.error('Error fetching sub-areas:', err);
    } finally {
      setLoadingSubAreas(false);
    }
  };

  // Cascade: sub-area → derive cropId
  const handleSubAreaChange = (subAreaId: string, entryIndex: number) => {
    const subArea = subAreas.find((sa: any) => sa.id === subAreaId);
    const selectedArea = areas.find((a: any) => a.id === form.getValues('area_id'));
    const cropId = subArea?.crop_id || selectedArea?.crop_id;

    form.setValue(`entries.${entryIndex}.sub_area_id`, subAreaId);
    form.setValue(`entries.${entryIndex}.finding_id`, '');
    form.setValue(`entries.${entryIndex}.treatments`, []);
    setEntryCropIds((prev) => ({ ...prev, [entryIndex]: cropId || null }));
    setEntryActionTypes((prev) => ({ ...prev, [entryIndex]: [] }));
    cleanupTreatmentStateForEntry(entryIndex);
  };

  // Cascade: finding → action types
  const handleFindingChange = async (findingId: string, entryIndex: number) => {
    form.setValue(`entries.${entryIndex}.finding_id`, findingId);
    form.setValue(`entries.${entryIndex}.treatments`, []);
    cleanupTreatmentStateForEntry(entryIndex);

    const cropId = entryCropIds[entryIndex];
    if (!findingId || !cropId) {
      setEntryActionTypes((prev) => ({ ...prev, [entryIndex]: [] }));
      return;
    }

    setEntryLoadingActionTypes((prev) => ({ ...prev, [entryIndex]: true }));
    try {
      const data = await api.get<any[]>('/api/cascade', {
        type: 'action_types',
        cropId,
        findingId,
      });
      setEntryActionTypes((prev) => ({ ...prev, [entryIndex]: data }));
    } catch (err) {
      console.error('Error fetching action types:', err);
    } finally {
      setEntryLoadingActionTypes((prev) => ({ ...prev, [entryIndex]: false }));
    }
  };

  // Cascade: action type → materials
  const handleTreatmentActionTypeChange = async (
    actionTypeId: string,
    entryIndex: number,
    treatmentIndex: number
  ) => {
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.action_type_id`, actionTypeId);
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.material_id`, '');
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.dosage`, '');
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.unit_type_id`, '');

    const key = `${entryIndex}-${treatmentIndex}`;
    const cropId = entryCropIds[entryIndex];
    const findingId = form.getValues(`entries.${entryIndex}.finding_id`);

    if (!cropId || !findingId || !actionTypeId) {
      setTreatmentMaterials((prev) => ({ ...prev, [key]: [] }));
      return;
    }

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

  // Cascade: material → dosage recommendation
  const handleTreatmentMaterialChange = async (
    materialId: string,
    entryIndex: number,
    treatmentIndex: number
  ) => {
    form.setValue(`entries.${entryIndex}.treatments.${treatmentIndex}.material_id`, materialId);

    const cropId = entryCropIds[entryIndex];
    const findingId = form.getValues(`entries.${entryIndex}.finding_id`);
    const actionTypeId = form.getValues(`entries.${entryIndex}.treatments.${treatmentIndex}.action_type_id`);

    if (!cropId || !findingId || !actionTypeId || !materialId) return;

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
  };

  // Entry management
  const addEntry = () => {
    const entries = form.getValues('entries');
    form.setValue('entries', [...entries, { ...EMPTY_ENTRY }]);
  };

  const removeEntry = (index: number) => {
    const entries = form.getValues('entries');
    form.setValue(
      'entries',
      entries.filter((_, i) => i !== index)
    );
    rebuildEntryIndices(index);
  };

  // Treatment management
  const addTreatment = (entryIndex: number) => {
    const treatments = form.getValues(`entries.${entryIndex}.treatments`) || [];
    form.setValue(`entries.${entryIndex}.treatments`, [
      ...treatments,
      { action_type_id: '', material_id: '', dosage: '', unit_type_id: '', notes: '' },
    ]);
  };

  const removeTreatment = (entryIndex: number, treatmentIndex: number) => {
    const treatments = form.getValues(`entries.${entryIndex}.treatments`) || [];
    form.setValue(
      `entries.${entryIndex}.treatments`,
      treatments.filter((_, i) => i !== treatmentIndex)
    );
    rebuildTreatmentIndices(entryIndex, treatmentIndex);
  };

  // State cleanup helpers
  const resetAllEntryState = () => {
    setEntryCropIds({});
    setEntryActionTypes({});
    setTreatmentMaterials({});
    setTreatmentLoadingMaterials({});
    setEntryLoadingActionTypes({});
  };

  const cleanupTreatmentStateForEntry = (entryIndex: number) => {
    const cleanup = <T,>(state: Record<string, T>): Record<string, T> => {
      const newState: Record<string, T> = {};
      Object.keys(state).forEach((key) => {
        if (!key.startsWith(`${entryIndex}-`)) {
          newState[key] = state[key];
        }
      });
      return newState;
    };
    setTreatmentMaterials(cleanup);
    setTreatmentLoadingMaterials(cleanup);
  };

  const rebuildEntryIndices = (removedIndex: number) => {
    const rebuildNumbered = <T,>(state: Record<number, T>): Record<number, T> => {
      const newState: Record<number, T> = {};
      Object.keys(state).forEach((key) => {
        const keyNum = parseInt(key);
        if (keyNum < removedIndex) newState[keyNum] = state[keyNum];
        else if (keyNum > removedIndex) newState[keyNum - 1] = state[keyNum];
      });
      return newState;
    };

    const rebuildKeyed = <T,>(state: Record<string, T>): Record<string, T> => {
      const newState: Record<string, T> = {};
      Object.keys(state).forEach((key) => {
        const [eIdx, tIdx] = key.split('-').map(Number);
        if (eIdx < removedIndex) newState[key] = state[key];
        else if (eIdx > removedIndex) newState[`${eIdx - 1}-${tIdx}`] = state[key];
      });
      return newState;
    };

    setEntryCropIds(rebuildNumbered);
    setEntryActionTypes(rebuildNumbered);
    setEntryLoadingActionTypes(rebuildNumbered);
    setTreatmentMaterials(rebuildKeyed);
    setTreatmentLoadingMaterials(rebuildKeyed);
  };

  const rebuildTreatmentIndices = (entryIndex: number, removedTreatmentIndex: number) => {
    const rebuild = <T,>(state: Record<string, T>): Record<string, T> => {
      const newState: Record<string, T> = {};
      Object.keys(state).forEach((key) => {
        const [eIdx, tIdx] = key.split('-').map(Number);
        if (eIdx !== entryIndex) newState[key] = state[key];
        else if (tIdx < removedTreatmentIndex) newState[key] = state[key];
        else if (tIdx > removedTreatmentIndex) newState[`${eIdx}-${tIdx - 1}`] = state[key];
      });
      return newState;
    };
    setTreatmentMaterials(rebuild);
    setTreatmentLoadingMaterials(rebuild);
  };

  // Build select options
  const customerOptions: SelectOption[] = (formData?.customers || []).map((c: any) => ({
    value: c.id,
    label: c.name,
  }));

  const inspectorOptions: SelectOption[] = inspectors.map((i: any) => ({
    value: i.id,
    label: i.name,
  }));

  const areaOptions: SelectOption[] = areas.map((a: any) => ({
    value: a.id,
    label: a.crops?.name ? `${a.name} (${a.crops.description || a.crops.name})` : a.name,
  }));

  const subAreaOptions: SelectOption[] = subAreas.map((sa: any) => ({
    value: sa.id,
    label: sa.display || sa.name,
  }));

  const findingOptions: SelectOption[] = (formData?.findings || []).map((f: any) => ({
    value: f.id,
    label: f.description || f.name,
  })).sort((a, b) => a.label.localeCompare(b.label, 'he'));

  const unitTypeOptions: SelectOption[] = (formData?.unitTypes || []).map((u: any) => ({
    value: u.id,
    label: u.description || u.name,
  }));

  const getActionTypeOptions = (entryIndex: number): SelectOption[] =>
    (entryActionTypes[entryIndex] || []).map((at: any) => ({
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
    const key = `${entryIndex}-${treatmentIndex}`;
    return !!treatmentLoadingMaterials[key];
  };

  return {
    // State
    formData,
    loadingFormData,
    loadingInspectors,
    loadingAreas,
    loadingSubAreas,

    // Select options
    customerOptions,
    inspectorOptions,
    areaOptions,
    subAreaOptions,
    findingOptions,
    unitTypeOptions,
    getActionTypeOptions,
    getMaterialOptions,
    getLoadingMaterials,

    // Handlers
    handleCustomerChange,
    handleAreaChange,
    handleSubAreaChange,
    handleFindingChange,
    handleTreatmentActionTypeChange,
    handleTreatmentMaterialChange,
    addEntry,
    removeEntry,
    addTreatment,
    removeTreatment,
  };
}
