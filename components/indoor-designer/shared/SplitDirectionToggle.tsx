'use client';

import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Rows3, Columns3 } from 'lucide-react';
import type { SplitDirection } from '../types';

interface SplitDirectionToggleProps {
  value: SplitDirection;
  onChange: (direction: SplitDirection) => void;
  disabled?: boolean;
}

export function SplitDirectionToggle({
  value,
  onChange,
  disabled = false,
}: SplitDirectionToggleProps) {
  return (
    <div>
      <Label className="text-sm font-medium">כיוון חלוקה</Label>
      <div className="flex gap-2 mt-1">
        <Button
          type="button"
          variant={value === 'horizontal' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange('horizontal')}
          disabled={disabled}
          className="flex-1 gap-2"
        >
          <Rows3 className="h-4 w-4" />
          אופקי
        </Button>
        <Button
          type="button"
          variant={value === 'vertical' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange('vertical')}
          disabled={disabled}
          className="flex-1 gap-2"
        >
          <Columns3 className="h-4 w-4" />
          אנכי
        </Button>
      </div>
    </div>
  );
}
