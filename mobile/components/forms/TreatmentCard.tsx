import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { FormSelect } from './FormSelect';
import { FormInput } from './FormInput';
import { HEBREW } from '../../constants/hebrew';

interface SelectOption {
  value: string;
  label: string;
}

interface TreatmentCardProps {
  index: number;
  actionTypeId: string;
  materialId: string;
  dosage: string;
  unitTypeId: string;
  notes: string;
  actionTypes: SelectOption[];
  materials: SelectOption[];
  unitTypes: SelectOption[];
  loadingMaterials?: boolean;
  onChangeActionType: (value: string) => void;
  onChangeMaterial: (value: string) => void;
  onChangeDosage: (value: string) => void;
  onChangeUnitType: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onRemove: () => void;
}

export function TreatmentCard({
  index,
  actionTypeId,
  materialId,
  dosage,
  unitTypeId,
  notes,
  actionTypes,
  materials,
  unitTypes,
  loadingMaterials = false,
  onChangeActionType,
  onChangeMaterial,
  onChangeDosage,
  onChangeUnitType,
  onChangeNotes,
  onRemove,
}: TreatmentCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {HEBREW.treatments} {index + 1}
        </Text>
        <TouchableOpacity onPress={onRemove} activeOpacity={0.6}>
          <Text style={styles.removeButton}>{HEBREW.delete}</Text>
        </TouchableOpacity>
      </View>

      <FormSelect
        label={HEBREW.actionType}
        placeholder={HEBREW.selectActionType}
        options={actionTypes}
        value={actionTypeId}
        onChange={onChangeActionType}
      />

      <FormSelect
        label={HEBREW.material}
        placeholder={HEBREW.selectMaterial}
        options={materials}
        value={materialId}
        onChange={onChangeMaterial}
        loading={loadingMaterials}
        disabled={!actionTypeId}
      />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <FormInput
            label={HEBREW.dosage}
            value={dosage}
            onChangeText={onChangeDosage}
            keyboardType="numeric"
            textAlign="left"
          />
        </View>
        <View style={styles.flex1}>
          <FormSelect
            label={HEBREW.unitType}
            placeholder={HEBREW.selectUnitType}
            options={unitTypes}
            value={unitTypeId}
            onChange={onChangeUnitType}
          />
        </View>
      </View>

      <FormInput
        label={HEBREW.notes}
        value={notes}
        onChangeText={onChangeNotes}
        multiline
        numberOfLines={2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  removeButton: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
});
