import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

interface SelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  label: string;
  placeholder: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
}

export function FormSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled = false,
  loading = false,
  error,
}: FormSelectProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayText = loading
    ? 'טוען...'
    : selectedOption?.label || placeholder;

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.trigger,
          error && styles.triggerError,
          disabled && styles.triggerDisabled,
        ]}
        onPress={() => setModalVisible(true)}
        disabled={disabled || loading}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.triggerText,
            !selectedOption && styles.placeholderText,
          ]}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <Text style={styles.chevron}>▼</Text>
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButton}>סגור</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{label}</Text>
            <View style={{ width: 40 }} />
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.option,
                  item.value === value && styles.optionSelected,
                ]}
                onPress={() => handleSelect(item.value)}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.optionText,
                    item.value === value && styles.optionTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {item.value === value && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
          />
        </SafeAreaView>
      </Modal>
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
    marginBottom: 6,
    textAlign: 'right',
  },
  trigger: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerError: {
    borderColor: '#ef4444',
  },
  triggerDisabled: {
    backgroundColor: '#f3f4f6',
    opacity: 0.7,
  },
  triggerText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
    textAlign: 'right',
  },
  placeholderText: {
    color: '#9ca3af',
  },
  chevron: {
    fontSize: 10,
    color: '#6b7280',
    marginStart: 8,
  },
  error: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    textAlign: 'right',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    fontSize: 15,
    color: '#16a34a',
    fontWeight: '500',
  },
  listContent: {
    paddingVertical: 8,
  },
  option: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionSelected: {
    backgroundColor: '#f0fdf4',
  },
  optionText: {
    fontSize: 16,
    color: '#111827',
    textAlign: 'right',
    flex: 1,
  },
  optionTextSelected: {
    color: '#16a34a',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#16a34a',
    marginStart: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
  },
});
