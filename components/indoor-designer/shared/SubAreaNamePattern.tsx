'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { NamingPattern } from '../types';

interface SubAreaNamePatternProps {
  value: NamingPattern;
  onChange: (pattern: NamingPattern) => void;
  count: number;
  disabled?: boolean;
}

export function SubAreaNamePattern({
  value,
  onChange,
  count,
  disabled = false,
}: SubAreaNamePatternProps) {
  const [showCustom, setShowCustom] = useState(value.type === 'custom');

  const handlePrefixChange = (prefix: string) => {
    onChange({ ...value, prefix, type: 'numbered' });
    setShowCustom(false);
  };

  const handleSwitchToCustom = () => {
    const customNames = Array.from(
      { length: count },
      (_, i) => value.customNames?.[i] || `${value.prefix} ${i + 1}`
    );
    onChange({ ...value, type: 'custom', customNames });
    setShowCustom(true);
  };

  const handleCustomNameChange = (index: number, name: string) => {
    const customNames = [...(value.customNames || [])];
    customNames[index] = name;
    onChange({ ...value, customNames });
  };

  const handleSwitchToNumbered = () => {
    onChange({ ...value, type: 'numbered' });
    setShowCustom(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-sm font-medium">קידומת שם</Label>
          <Input
            value={value.prefix}
            onChange={(e) => handlePrefixChange(e.target.value)}
            placeholder="לדוגמה: אשנב"
            disabled={disabled || showCustom}
            className="mt-1"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={showCustom ? handleSwitchToNumbered : handleSwitchToCustom}
          disabled={disabled}
        >
          {showCustom ? 'מספור אוטומטי' : 'שמות מותאמים'}
        </Button>
      </div>

      {!showCustom && count > 0 && (
        <p className="text-xs text-muted-foreground">
          תצוגה מקדימה: {Array.from({ length: Math.min(count, 3) }, (_, i) => `${value.prefix} ${i + 1}`).join(', ')}
          {count > 3 ? '...' : ''}
        </p>
      )}

      {showCustom && (
        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
          {Array.from({ length: count }, (_, i) => (
            <Input
              key={i}
              value={value.customNames?.[i] || ''}
              onChange={(e) => handleCustomNameChange(i, e.target.value)}
              placeholder={`${value.prefix} ${i + 1}`}
              disabled={disabled}
              className="text-sm"
            />
          ))}
        </div>
      )}
    </div>
  );
}
