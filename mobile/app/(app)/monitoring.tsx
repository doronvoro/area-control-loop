import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { FormSelect } from '../../components/forms/FormSelect';
import { EntryCard } from '../../components/forms/EntryCard';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useMonitoringCascade, MonitoringFormValues } from '../../hooks/useMonitoringCascade';
import { api } from '../../lib/api';
import { HEBREW } from '../../constants/hebrew';

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
  severity: z.string().optional(),
  treatments: z.array(treatmentSchema),
});

const monitoringSchema = z.object({
  customer_id: z.string().min(1, 'נדרש לבחור לקוח'),
  inspector_id: z.string().min(1, 'נדרש לבחור פקח'),
  area_id: z.string().min(1, 'נדרש לבחור שטח'),
  entries: z.array(subAreaEntrySchema).min(1, 'נדרשת לפחות רשומה אחת'),
});

export default function MonitoringScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<MonitoringFormValues>({
    resolver: zodResolver(monitoringSchema) as any,
    defaultValues: {
      customer_id: '',
      inspector_id: '',
      area_id: '',
      entries: [
        {
          sub_area_id: '',
          finding_id: '',
          severity: undefined,
          treatments: [],
        },
      ],
    },
  });

  const cascade = useMonitoringCascade(form);

  const watchedCustomerId = form.watch('customer_id');
  const watchedAreaId = form.watch('area_id');
  const entries = form.watch('entries');

  const handleSubmit = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      const errors = form.formState.errors;
      if (errors.entries?.message) {
        setError(errors.entries.message);
      } else if (errors.customer_id) {
        setError(errors.customer_id.message || '');
      } else if (errors.inspector_id) {
        setError(errors.inspector_id.message || '');
      } else if (errors.area_id) {
        setError(errors.area_id.message || '');
      } else {
        setError('יש לתקן את השגיאות בטופס');
      }
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const data = form.getValues();
      await api.post('/api/monitoring', {
        customer_id: data.customer_id,
        inspector_id: data.inspector_id,
        area_id: data.area_id,
        entries: data.entries,
      });

      setSuccess(true);
      form.reset();

      // Re-set customer for non-admin users
      if (!cascade.formData?.isAdmin && cascade.formData?.customerIdForData) {
        form.setValue('customer_id', cascade.formData.customerIdForData);
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || HEBREW.reportError);
    } finally {
      setSubmitting(false);
    }
  };

  if (cascade.loadingFormData) {
    return <LoadingSpinner message={HEBREW.loading} />;
  }

  const handleTreatmentChange = (
    entryIndex: number,
    treatmentIndex: number,
    field: string,
    value: string
  ) => {
    if (field === 'action_type_id') {
      cascade.handleTreatmentActionTypeChange(value, entryIndex, treatmentIndex);
    } else if (field === 'material_id') {
      cascade.handleTreatmentMaterialChange(value, entryIndex, treatmentIndex);
    } else {
      form.setValue(
        `entries.${entryIndex}.treatments.${treatmentIndex}.${field}` as any,
        value
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Alerts */}
          {error && (
            <View style={styles.alertContainer}>
              <Alert message={error} type="error" />
            </View>
          )}
          {success && (
            <View style={styles.alertContainer}>
              <Alert message={HEBREW.reportSaved} type="success" />
            </View>
          )}

          {/* Customer & Inspector Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>פרטי לקוח ופקח</Text>

            {cascade.formData?.isAdmin && (
              <FormSelect
                label={`${HEBREW.customer} *`}
                placeholder={HEBREW.selectCustomer}
                options={cascade.customerOptions}
                value={watchedCustomerId}
                onChange={cascade.handleCustomerChange}
              />
            )}

            <FormSelect
              label={`${HEBREW.inspector} *`}
              placeholder={
                !watchedCustomerId ? 'בחר לקוח תחילה' : HEBREW.selectInspector
              }
              options={cascade.inspectorOptions}
              value={form.watch('inspector_id')}
              onChange={(v) => form.setValue('inspector_id', v)}
              disabled={!watchedCustomerId}
              loading={cascade.loadingInspectors}
            />
          </View>

          {/* Area Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{HEBREW.area}</Text>
            <FormSelect
              label={`${HEBREW.area} *`}
              placeholder={
                !watchedCustomerId ? 'בחר לקוח תחילה' : HEBREW.selectArea
              }
              options={cascade.areaOptions}
              value={watchedAreaId}
              onChange={cascade.handleAreaChange}
              disabled={!watchedCustomerId}
              loading={cascade.loadingAreas}
            />
          </View>

          {/* Entries Section */}
          {watchedAreaId && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  רשומות תת-שטח ({entries.length})
                </Text>
                <TouchableOpacity
                  onPress={cascade.addEntry}
                  style={styles.addButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addButtonText}>+ {HEBREW.addEntry}</Text>
                </TouchableOpacity>
              </View>

              {entries.map((entry, index) => (
                <EntryCard
                  key={index}
                  index={index}
                  subAreaId={entry.sub_area_id}
                  findingId={entry.finding_id}
                  severity={entry.severity}
                  treatments={entry.treatments}
                  subAreas={cascade.subAreaOptions}
                  findings={cascade.findingOptions}
                  unitTypes={cascade.unitTypeOptions}
                  getActionTypes={cascade.getActionTypeOptions}
                  getMaterials={cascade.getMaterialOptions}
                  getLoadingMaterials={cascade.getLoadingMaterials}
                  onChangeSubArea={(v) => cascade.handleSubAreaChange(v, index)}
                  onChangeFinding={(v) => cascade.handleFindingChange(v, index)}
                  onChangeSeverity={(v) =>
                    form.setValue(`entries.${index}.severity`, v)
                  }
                  onChangeTreatment={(tIndex, field, value) =>
                    handleTreatmentChange(index, tIndex, field, value)
                  }
                  onAddTreatment={() => cascade.addTreatment(index)}
                  onRemoveTreatment={(tIndex) =>
                    cascade.removeTreatment(index, tIndex)
                  }
                  onRemoveEntry={() => cascade.removeEntry(index)}
                  subAreaError={
                    form.formState.errors.entries?.[index]?.sub_area_id?.message
                  }
                  findingError={
                    form.formState.errors.entries?.[index]?.finding_id?.message
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* Submit Footer */}
        <View style={styles.footer}>
          <Button
            title={submitting ? HEBREW.submitting : HEBREW.submitReport}
            onPress={handleSubmit}
            loading={submitting}
            size="lg"
            style={styles.submitButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  alertContainer: {
    marginBottom: 12,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'right',
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  addButtonText: {
    fontSize: 13,
    color: '#16a34a',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    width: '100%',
  },
});
