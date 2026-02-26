import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HEBREW } from '../../constants/hebrew';

const SEVERITY_OPTIONS = [
  { value: 'low', label: HEBREW.severityLow, color: '#22c55e', bg: '#f0fdf4' },
  { value: 'medium', label: HEBREW.severityMedium, color: '#eab308', bg: '#fefce8' },
  { value: 'high', label: HEBREW.severityHigh, color: '#f97316', bg: '#fff7ed' },
  { value: 'critical', label: HEBREW.severityCritical, color: '#ef4444', bg: '#fef2f2' },
] as const;

interface SeverityPickerProps {
  value?: string;
  onChange: (value: string) => void;
}

export function SeverityPicker({ value, onChange }: SeverityPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{HEBREW.severity}</Text>
      <View style={styles.chips}>
        {SEVERITY_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? option.bg : '#f9fafb',
                  borderColor: isSelected ? option.color : '#e5e7eb',
                },
              ]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? option.color : '#6b7280' },
                  isSelected && styles.chipTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'right',
  },
  chips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '400',
  },
  chipTextSelected: {
    fontWeight: '600',
  },
});
