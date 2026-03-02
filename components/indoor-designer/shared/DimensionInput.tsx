'use client';

import { useState, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DimensionInputProps {
  width: number;
  height: number;
  onDimensionsChange: (width: number, height: number) => void;
  disabled?: boolean;
}

export function DimensionInput({
  width,
  height,
  onDimensionsChange,
  disabled = false,
}: DimensionInputProps) {
  const totalDunam = (width * height) / 1000;

  // Local state for the dunam input to allow free typing
  const [dunamInput, setDunamInput] = useState<string | null>(null);
  // Lock the aspect ratio at the moment the user focuses the dunam field
  const lockedRatioRef = useRef<number | null>(null);

  const handleDunamFocus = useCallback(() => {
    if (width > 0 && height > 0) {
      lockedRatioRef.current = width / height;
    } else {
      lockedRatioRef.current = 1;
    }
  }, [width, height]);

  const handleDunamChange = useCallback(
    (value: string) => {
      setDunamInput(value);
      const dunam = parseFloat(value) || 0;
      if (dunam <= 0) return;

      const sqm = dunam * 1000;
      const ratio = lockedRatioRef.current || 1;
      const exactHeight = Math.sqrt(sqm / ratio);
      const exactWidth = sqm / exactHeight;

      // Prefer integers if rounding error is small (within 1%)
      const intW = Math.round(exactWidth);
      const intH = Math.round(exactHeight);
      const intArea = intW * intH;
      const error = Math.abs(intArea - sqm) / sqm;

      if (error < 0.01 && intW > 0 && intH > 0) {
        onDimensionsChange(intW, intH);
      } else {
        onDimensionsChange(
          Math.round(exactWidth * 10) / 10,
          Math.round(exactHeight * 10) / 10
        );
      }
    },
    [onDimensionsChange]
  );

  const handleDunamBlur = useCallback(() => {
    setDunamInput(null);
    lockedRatioRef.current = null;
  }, []);

  const displayDunam =
    dunamInput !== null
      ? dunamInput
      : totalDunam > 0
        ? String(Math.round(totalDunam * 1000) / 1000)
        : '';

  return (
    <div className="space-y-2">
      {/* Width × Height */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label className="text-sm font-medium">רוחב (מטר)</Label>
          <Input
            type="number"
            min={0.1}
            step={0.1}
            value={width}
            onChange={(e) =>
              onDimensionsChange(parseFloat(e.target.value) || 0, height)
            }
            disabled={disabled}
            dir="ltr"
            className="mt-1"
          />
        </div>
        <span className="pb-2 text-muted-foreground font-medium">×</span>
        <div className="flex-1">
          <Label className="text-sm font-medium">אורך (מטר)</Label>
          <Input
            type="number"
            min={0.1}
            step={0.1}
            value={height}
            onChange={(e) =>
              onDimensionsChange(width, parseFloat(e.target.value) || 0)
            }
            disabled={disabled}
            dir="ltr"
            className="mt-1"
          />
        </div>
      </div>

      {/* Total area in dunam */}
      <div>
        <Label className="text-sm font-medium">שטח כולל (דונם)</Label>
        <Input
          type="number"
          min={0.001}
          step="any"
          value={displayDunam}
          onChange={(e) => handleDunamChange(e.target.value)}
          onFocus={handleDunamFocus}
          onBlur={handleDunamBlur}
          disabled={disabled}
          dir="ltr"
          className="mt-1"
        />
      </div>
    </div>
  );
}
