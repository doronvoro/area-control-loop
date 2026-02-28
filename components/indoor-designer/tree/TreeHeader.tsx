'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DimensionInput } from '../shared/DimensionInput';

interface TreeHeaderProps {
  areaName: string;
  areaDescription: string;
  width: number;
  height: number;
  onAreaNameChange: (name: string) => void;
  onAreaDescriptionChange: (desc: string) => void;
  onDimensionsChange: (width: number, height: number) => void;
  hasSubAreas: boolean;
}

export function TreeHeader({
  areaName,
  areaDescription,
  width,
  height,
  onAreaNameChange,
  onAreaDescriptionChange,
  onDimensionsChange,
  hasSubAreas,
}: TreeHeaderProps) {
  return (
    <div className="p-3 border-b space-y-3 bg-muted/20">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground">שם השטח</Label>
        <Input
          value={areaName}
          onChange={(e) => onAreaNameChange(e.target.value)}
          placeholder="לדוגמה: חממה צפונית"
          className="mt-1 h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground">תיאור</Label>
        <Input
          value={areaDescription}
          onChange={(e) => onAreaDescriptionChange(e.target.value)}
          placeholder="אופציונלי"
          className="mt-1 h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground">מימדים (מטר)</Label>
        <div className="mt-1">
          <DimensionInput
            width={width}
            height={height}
            onDimensionsChange={onDimensionsChange}
          />
        </div>
      </div>
    </div>
  );
}
