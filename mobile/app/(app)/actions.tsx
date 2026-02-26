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
import { FormInput } from '../../components/forms/FormInput';
import { SeverityPicker } from '../../components/forms/SeverityPicker';
import { TreatmentCard } from '../../components/forms/TreatmentCard';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useActionCascade, ActionFormValues } from '../../hooks/useActionCascade';
import { api } from '../../lib/api';
import { HEBREW } from '../../constants/hebrew';

const treatmentSchema = z.object({
  action_type_id: z.string().min(1, 'נדרש לבחור סוג פעולה'),
  material_id: z.string().optional(),
  material: z.string().min(1, 'נדרש להזין חומר'),
  dosage: z.string().min(1, 'נדרש להזין מינון'),
  unit_type_id: z.string().min(1, 'נדרש לבחור יחידת מידה'),
  status: z.string(),
  notes: z.string().optional(),
  monitoring_treatment_id: z.string().optional(),
});

const entrySchema = z.object({
  source: z.enum(['monitoring', 'standalone']),
  monitoring_report_id: z.string().optional(),
  sub_area_id: z.string().min(1, 'נדרש לבחור תת-שטח'),
  sub_area_display: z.string().optional(),
  finding_id: z.string().min(1, 'נדרש לבחור ממצא'),
  finding_name: z.string().optional(),
  severity: z.string().optional(),
  crop_id: z.string().optional(),
  treatments: z.array(treatmentSchema).min(1, 'נדרש לפחות טיפול אחד'),
});

const actionSchema = z.object({
  customer_id: z.string().optional(),
  worker_id: z.string().min(1, 'נדרש לבחור עובד פעולה'),
  area_id: z.string().min(1, 'נדרש לבחור שטח'),
  entries: z.array(entrySchema).min(1, 'נדרשת לפחות רשומה אחת'),
});

export default function ActionsScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<ActionFormValues>({
    resolver: zodResolver(actionSchema) as any,
    defaultValues: {
      customer_id: '',
      worker_id: '',
      area_id: '',
      entries: [
        {
          source: 'standalone',
          sub_area_id: '',
          finding_id: '',
          severity: undefined,
          treatments: [
            {
              action_type_id: '',
              material_id: '',
              material: '',
              dosage: '',
              unit_type_id: '',
              status: 'planned',
              notes: '',
            },
          ],
        },
      ],
    },
  });

  const cascade = useActionCascade(form);
  const watchedCustomerId = form.watch('customer_id');
  const watchedAreaId = form.watch('area_id');
  const entries = form.watch('entries');

  const handleSubmit = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      setError('יש לתקן את השגיאות בטופס');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const data = form.getValues();
      await api.post('/api/actions', data);
      setSuccess(true);
      form.reset();
      if (cascade.formData?.currentWorkerId) {
        form.setValue('worker_id', cascade.formData.currentWorkerId);
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

          {/* Worker Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>פרטי עובד</Text>

            {cascade.formData?.isAdmin && (
              <FormSelect
                label={`${HEBREW.customer} *`}
                placeholder={HEBREW.selectCustomer}
                options={cascade.customerOptions}
                value={watchedCustomerId || ''}
                onChange={cascade.handleCustomerChange}
              />
            )}

            <FormSelect
              label={`${HEBREW.worker} *`}
              placeholder={HEBREW.selectWorker}
              options={cascade.workerOptions}
              value={form.watch('worker_id')}
              onChange={(v) => form.setValue('worker_id', v)}
              loading={cascade.loadingWorkers}
              disabled={cascade.formData?.isAdmin && !watchedCustomerId}
            />
          </View>

          {/* Area Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{HEBREW.area}</Text>
            <FormSelect
              label={`${HEBREW.area} *`}
              placeholder={HEBREW.selectArea}
              options={cascade.areaOptions}
              value={watchedAreaId}
              onChange={cascade.handleAreaChange}
              loading={cascade.loadingAreas}
              disabled={cascade.formData?.isAdmin && !watchedCustomerId}
            />
          </View>

          {/* Entries Section */}
          {watchedAreaId && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  רשומות ({entries.length})
                </Text>
                <TouchableOpacity
                  onPress={cascade.addEntry}
                  style={styles.addButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addButtonText}>+ {HEBREW.addEntry}</Text>
                </TouchableOpacity>
              </View>

              {entries.map((entry, index) => {
                const isFromMonitoring = entry.source === 'monitoring';

                return (
                  <View key={index} style={styles.entryCard}>
                    <View style={styles.entryHeader}>
                      <View style={styles.entryHeaderRight}>
                        <Text style={styles.entryTitle}>רשומה {index + 1}</Text>
                        {isFromMonitoring && (
                          <View style={styles.monitoringBadge}>
                            <Text style={styles.monitoringBadgeText}>מניטור</Text>
                          </View>
                        )}
                      </View>
                      {entries.length > 1 && (
                        <TouchableOpacity
                          onPress={() => cascade.removeEntry(index)}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.removeButton}>{HEBREW.delete}</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.entryContent}>
                      {/* Sub-area */}
                      {isFromMonitoring ? (
                        <View style={styles.readOnlyField}>
                          <Text style={styles.readOnlyLabel}>{HEBREW.subArea}</Text>
                          <Text style={styles.readOnlyValue}>
                            {entry.sub_area_display || entry.sub_area_id}
                          </Text>
                        </View>
                      ) : (
                        <FormSelect
                          label={`${HEBREW.subArea} *`}
                          placeholder={HEBREW.selectSubArea}
                          options={cascade.subAreaOptions}
                          value={entry.sub_area_id}
                          onChange={(v) =>
                            form.setValue(`entries.${index}.sub_area_id`, v)
                          }
                          loading={cascade.loadingSubAreas}
                        />
                      )}

                      {/* Finding */}
                      {isFromMonitoring ? (
                        <View style={styles.readOnlyField}>
                          <Text style={styles.readOnlyLabel}>{HEBREW.finding}</Text>
                          <Text style={styles.readOnlyValue}>
                            {entry.finding_name || entry.finding_id}
                          </Text>
                        </View>
                      ) : (
                        <FormSelect
                          label={`${HEBREW.finding} *`}
                          placeholder={HEBREW.selectFinding}
                          options={cascade.findingOptions}
                          value={entry.finding_id}
                          onChange={(v) =>
                            form.setValue(`entries.${index}.finding_id`, v)
                          }
                        />
                      )}

                      {/* Severity display */}
                      {entry.severity && (
                        <View style={styles.readOnlyField}>
                          <Text style={styles.readOnlyLabel}>{HEBREW.severity}</Text>
                          <Text style={styles.readOnlyValue}>
                            {entry.severity === 'low'
                              ? HEBREW.severityLow
                              : entry.severity === 'medium'
                                ? HEBREW.severityMedium
                                : entry.severity === 'high'
                                  ? HEBREW.severityHigh
                                  : HEBREW.severityCritical}
                          </Text>
                        </View>
                      )}

                      {/* Treatments */}
                      <View style={styles.treatmentsSection}>
                        <Text style={styles.treatmentsTitle}>
                          {HEBREW.treatments}
                        </Text>
                        {entry.treatments.map((treatment, tIndex) => (
                          <View key={tIndex} style={styles.treatmentItem}>
                            <View style={styles.treatmentHeader}>
                              <Text style={styles.treatmentTitle}>
                                {HEBREW.treatments} {tIndex + 1}
                              </Text>
                              {entry.treatments.length > 1 && (
                                <TouchableOpacity
                                  onPress={() =>
                                    cascade.removeTreatment(index, tIndex)
                                  }
                                  activeOpacity={0.6}
                                >
                                  <Text style={styles.removeButton}>
                                    {HEBREW.delete}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>

                            <FormSelect
                              label={HEBREW.actionType}
                              placeholder={HEBREW.selectActionType}
                              options={cascade.getActionTypeOptions(index)}
                              value={treatment.action_type_id}
                              onChange={(v) =>
                                handleTreatmentChange(
                                  index,
                                  tIndex,
                                  'action_type_id',
                                  v
                                )
                              }
                            />

                            <FormSelect
                              label={HEBREW.material}
                              placeholder={HEBREW.selectMaterial}
                              options={cascade.getMaterialOptions(index, tIndex)}
                              value={treatment.material_id || ''}
                              onChange={(v) =>
                                handleTreatmentChange(
                                  index,
                                  tIndex,
                                  'material_id',
                                  v
                                )
                              }
                              loading={cascade.getLoadingMaterials(index, tIndex)}
                              disabled={!treatment.action_type_id}
                            />

                            <View style={styles.row}>
                              <View style={styles.flex1}>
                                <FormInput
                                  label={HEBREW.dosage}
                                  value={treatment.dosage}
                                  onChangeText={(v) =>
                                    handleTreatmentChange(
                                      index,
                                      tIndex,
                                      'dosage',
                                      v
                                    )
                                  }
                                  keyboardType="numeric"
                                  textAlign="left"
                                />
                              </View>
                              <View style={styles.flex1}>
                                <FormSelect
                                  label={HEBREW.unitType}
                                  placeholder={HEBREW.selectUnitType}
                                  options={cascade.unitTypeOptions}
                                  value={treatment.unit_type_id}
                                  onChange={(v) =>
                                    handleTreatmentChange(
                                      index,
                                      tIndex,
                                      'unit_type_id',
                                      v
                                    )
                                  }
                                />
                              </View>
                            </View>

                            <FormSelect
                              label={HEBREW.status}
                              placeholder={HEBREW.status}
                              options={cascade.statusOptions}
                              value={treatment.status}
                              onChange={(v) =>
                                handleTreatmentChange(
                                  index,
                                  tIndex,
                                  'status',
                                  v
                                )
                              }
                            />

                            <FormInput
                              label={HEBREW.notes}
                              value={treatment.notes || ''}
                              onChangeText={(v) =>
                                handleTreatmentChange(
                                  index,
                                  tIndex,
                                  'notes',
                                  v
                                )
                              }
                              multiline
                              numberOfLines={2}
                            />
                          </View>
                        ))}

                        <TouchableOpacity
                          style={styles.addTreatmentButton}
                          onPress={() => cascade.addTreatment(index)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.addTreatmentText}>
                            + {HEBREW.addTreatment}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
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
  flex1: {
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
  entryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    overflow: 'hidden',
  },
  entryHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  entryHeaderRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  monitoringBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  monitoringBadgeText: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  removeButton: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500',
  },
  entryContent: {
    padding: 14,
  },
  readOnlyField: {
    marginBottom: 16,
  },
  readOnlyLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
    textAlign: 'right',
  },
  readOnlyValue: {
    fontSize: 15,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'right',
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
  treatmentItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  treatmentHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  treatmentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  row: {
    flexDirection: 'row-reverse',
    gap: 12,
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
