import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AlertProps {
  message: string;
  type: 'success' | 'error' | 'warning';
}

export function Alert({ message, type }: AlertProps) {
  return (
    <View style={[styles.container, styles[type]]}>
      <Text style={[styles.text, styles[`text_${type}`]]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  success: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  error: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  warning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  text: {
    fontSize: 14,
    textAlign: 'right',
  },
  text_success: {
    color: '#166534',
  },
  text_error: {
    color: '#991b1b',
  },
  text_warning: {
    color: '#92400e',
  },
});
