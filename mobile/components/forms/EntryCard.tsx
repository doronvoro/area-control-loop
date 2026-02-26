import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { FormSelect } from './FormSelect';
import { SeverityPicker } from './SeverityPicker';
import { TreatmentCard } from './TreatmentCard';
import { HEBREW } from '../../constants/hebrew';

interface SelectOption {
  value: string;
  label: string;
}

interface Treatment {
  action_type_id?: string;
  material_id?: string;
  dosage?: string;
  unit_type_id?: string;
  notes?: string;
}

interface EntryCardProps {
  index: number;
  subAreaId: string;
  findingId: string;
  severity?: string;
  treatments: Treatment[];
  subAreas: SelectOption[];
  findings: SelectOption[];
  unitTypes: SelectOption[];
  getActionTypes: (entryIndex: number) => SelectOption[];
  getMaterials: (entryIndex: number, treatmentIndex: number) => SelectOption[];
  getLoadingMaterials: (entryIndex: number, treatmentIndex: number) => boolean;
  onChangeSubArea: (value: string) => void;
  onChangeFinding: (value: string) => void;
  onChangeSeverity: (value: string) => void;
  onChangeTreatment: (
    treatmentIndex: number,
    field: keyof Treatment,
    value: string
  ) => void;
  onAddTreatment: () => void;
  onRemoveTreatment: (treatmentIndex: number) => void;
  onRemoveEntry: () => void;
  subAreaError?: string;
  findingError?: string;
  readOnly?: boolean;
}

export function EntryCard({
  index,
  subAreaId,
  findingId,
  severity,
  treatments,
  subAreas,
  findings,
  unitTypes,
  getActionTypes,
  getMaterials,
  getLoadingMaterials,
  onChangeSubArea,
  onChangeFinding,
  onChangeSeverity,
  onChangeTreatment,
  onAddTreatment,
  onRemoveTreatment,
  onRemoveEntry,
  subAreaError,
  findingError,
  readOnly = false,
}: EntryCardProps) {
  const [expanded, setExpanded] = useState(true);

  const selectedSubArea = subAreas.find((s) => s.value === subAreaId);
  const selectedFinding = findings.find((f) => f.value === findingId);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerRight}>
          <Text style={styles.headerTitle}>
            רשומה {index + 1}
          </Text>
          {!expanded && selectedSubArea && (
            <Text style={styles.headerSummary} numberOfLines={1}>
              {selectedSubArea.label}
              {selectedFinding ? ` • ${selectedFinding.label}` : ''}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onRemoveEntry} activeOpacity={0.6}>
            <Text style={styles.removeButton}>{HEBREW.delete}</Text>
          </TouchableOpacity>
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <FormSelect
            label={HEBREW.subArea}
            placeholder={HEBREW.selectSubArea}
            options={subAreas}
            value={subAreaId}
            onChange={onChangeSubArea}
            error={subAreaError}
            disabled={readOnly}
          />

          <FormSelect
            label={HEBREW.finding}
            placeholder={HEBREW.selectFinding}
            options={findings}
            value={findingId}
            onChange={onChangeFinding}
            error={findingError}
            disabled={readOnly}
          />

          <SeverityPicker value={severity} onChange={onChangeSeverity} />

          <View style={styles.treatmentsSection}>
            <Text style={styles.treatmentsTitle}>{HEBREW.treatments}</Text>
            {treatments.map((treatment, tIndex) => (
              <TreatmentCard
                key={tIndex}
                index={tIndex}
                actionTypeId={treatment.action_type_id || ''}
                materialId={treatment.material_id || ''}
                dosage={treatment.dosage || ''}
                unitTypeId={treatment.unit_type_id || ''}
                notes={treatment.notes || ''}
                actionTypes={getActionTypes(index)}
                materials={getMaterials(index, tIndex)}
                unitTypes={unitTypes}
                loadingMaterials={getLoadingMaterials(index, tIndex)}
                onChangeActionType={(v) =>
                  onChangeTreatment(tIndex, 'action_type_id', v)
                }
                onChangeMaterial={(v) =>
                  onChangeTreatment(tIndex, 'material_id', v)
                }
                onChangeDosage={(v) =>
                  onChangeTreatment(tIndex, 'dosage', v)
                }
                onChangeUnitType={(v) =>
                  onChangeTreatment(tIndex, 'unit_type_id', v)
                }
                onChangeNotes={(v) =>
                  onChangeTreatment(tIndex, 'notes', v)
                }
                onRemove={() => onRemoveTreatment(tIndex)}
              />
            ))}
            <TouchableOpacity
              style={styles.addTreatmentButton}
              onPress={onAddTreatment}
              activeOpacity={0.7}
            >
              <Text style={styles.addTreatmentText}>+ {HEBREW.addTreatment}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerRight: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  headerSummary: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    textAlign: 'right',
  },
  headerActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  removeButton: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500',
  },
  chevron: {
    fontSize: 12,
    color: '#6b7280',
  },
  content: {
    padding: 14,
  },
  treatmentsSection: {
    marginTop: 8,
  },
  treatmentsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'right',
  },
  addTreatmentButton: {
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  addTreatmentText: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '500',
  },
});
