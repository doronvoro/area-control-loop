'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { SplitDirectionToggle } from '../shared/SplitDirectionToggle';
import type { InlineTemplateFormData, SplitDirection, TreeNode } from '../types';
import { DEFAULT_LEVEL_PREFIXES } from '../types';
import { getBounds } from '../geometry/geometry-utils';

// Level colors matching indoor-canvas-styles.ts
const LEVEL_COLORS: Record<number, { stroke: string; fill: string }> = {
  1: { stroke: '#7c3aed', fill: '#ede9fe' },
  2: { stroke: '#059669', fill: '#d1fae5' },
  3: { stroke: '#d97706', fill: '#fef3c7' },
};

function getLevelColor(level: number) {
  return LEVEL_COLORS[level] || LEVEL_COLORS[3];
}

interface SplitPreviewProps {
  count: number;
  direction: SplitDirection;
  prefix: string;
  parentAspectRatio: number; // width / height
  childLevel: number;
}

function SplitPreview({
  count,
  direction,
  prefix,
  parentAspectRatio,
  childLevel,
}: SplitPreviewProps) {
  const clampedCount = Math.min(Math.max(count, 1), 50);
  const colors = getLevelColor(childLevel);

  // SVG dimensions scaled to parent aspect ratio
  const maxW = 240;
  const maxH = 100;
  let svgW: number, svgH: number;
  if (parentAspectRatio >= 1) {
    svgW = maxW;
    svgH = Math.max(40, maxW / parentAspectRatio);
    if (svgH > maxH) {
      svgH = maxH;
      svgW = maxH * parentAspectRatio;
    }
  } else {
    svgH = maxH;
    svgW = Math.max(60, maxH * parentAspectRatio);
  }

  const pad = 1;
  const innerW = svgW - pad * 2;
  const innerH = svgH - pad * 2;

  const strips = useMemo(() => {
    const result: { x: number; y: number; w: number; h: number; label: string }[] = [];
    for (let i = 0; i < clampedCount; i++) {
      const label =
        clampedCount <= 12 ? `${prefix} ${i + 1}` : `${i + 1}`;
      if (direction === 'horizontal') {
        const stripH = innerH / clampedCount;
        result.push({
          x: pad,
          y: pad + i * stripH,
          w: innerW,
          h: stripH,
          label,
        });
      } else {
        const stripW = innerW / clampedCount;
        result.push({
          x: pad + i * stripW,
          y: pad,
          w: stripW,
          h: innerH,
          label,
        });
      }
    }
    return result;
  }, [clampedCount, direction, prefix, innerW, innerH, pad]);

  // Decide whether to show labels based on available space
  const showLabels =
    clampedCount <= 20 &&
    (direction === 'horizontal'
      ? innerH / clampedCount >= 14
      : innerW / clampedCount >= 20);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="rounded border border-border/50"
        style={{ background: '#fafafa' }}
      >
        {/* Parent outline */}
        <rect
          x={pad}
          y={pad}
          width={innerW}
          height={innerH}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1}
          rx={1}
        />
        {/* Child strips */}
        {strips.map((s, i) => (
          <g key={i}>
            <rect
              x={s.x + 0.5}
              y={s.y + 0.5}
              width={Math.max(s.w - 1, 1)}
              height={Math.max(s.h - 1, 1)}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={0.8}
              strokeDasharray={childLevel >= 2 ? '3,2' : undefined}
              rx={0.5}
            />
            {showLabels && (
              <text
                x={s.x + s.w / 2}
                y={s.y + s.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.min(9, s.h - 2, s.w / 4)}
                fill={colors.stroke}
                fontWeight={500}
              >
                {s.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

interface InlineTemplateFormProps {
  parentNode: TreeNode;
  hasExistingChildren: boolean;
  siblingCount: number;
  onGenerate: (config: InlineTemplateFormData) => void;
  onGenerateForAll: (config: InlineTemplateFormData) => void;
  onCancel: () => void;
}

export function InlineTemplateForm({
  parentNode,
  hasExistingChildren,
  siblingCount,
  onGenerate,
  onGenerateForAll,
  onCancel,
}: InlineTemplateFormProps) {
  const childLevel = parentNode.level + 1;
  const defaultPrefix =
    DEFAULT_LEVEL_PREFIXES[childLevel] || `רמה ${childLevel}`;

  const [count, setCount] = useState(childLevel === 1 ? 2 : 10);
  const [direction, setDirection] = useState<SplitDirection>(
    childLevel === 1 ? 'horizontal' : 'vertical'
  );
  const [prefix, setPrefix] = useState(defaultPrefix);
  const [applyToAll, setApplyToAll] = useState(false);

  // Compute parent aspect ratio from geometry
  const parentAspectRatio = useMemo(() => {
    if (!parentNode.geometry) return 2;
    const bounds = getBounds(parentNode.geometry);
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    return h > 0 ? w / h : 2;
  }, [parentNode.geometry]);

  const handleGenerate = () => {
    if (count <= 0 || !prefix.trim()) return;
    const config: InlineTemplateFormData = {
      count,
      direction,
      naming: { type: 'numbered', prefix: prefix.trim() },
    };
    if (applyToAll) {
      onGenerateForAll(config);
    } else {
      onGenerate(config);
    }
  };

  return (
    <div className="ms-6 my-1 p-3 bg-muted/40 rounded-lg border border-dashed space-y-2.5">
      <div className="text-xs font-medium text-muted-foreground">
        הוסף תתי-שטחים ל-
        <span className="text-foreground font-semibold">{parentNode.name}</span>
      </div>

      {hasExistingChildren && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
          לנוד זה כבר יש צאצאים. יצירת חדשים תחליף את הקיימים.
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">כמות</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value) || 0)}
            className="h-8 text-sm mt-0.5"
            dir="ltr"
          />
        </div>
        <div className="flex-1">
          <Label className="text-xs">קידומת</Label>
          <Input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder={defaultPrefix}
            className="h-8 text-sm mt-0.5"
          />
        </div>
      </div>

      <SplitDirectionToggle
        value={direction}
        onChange={setDirection}
      />

      {/* Preview */}
      {count > 0 && prefix && (
        <div className="space-y-1.5">
          <SplitPreview
            count={count}
            direction={direction}
            prefix={prefix}
            parentAspectRatio={parentAspectRatio}
            childLevel={childLevel}
          />
          <p className="text-xs text-muted-foreground text-center">
            {Array.from({ length: Math.min(count, 3) }, (_, i) => `${prefix} ${i + 1}`).join(', ')}
            {count > 3 ? `, ... ${prefix} ${count}` : ''}
          </p>
        </div>
      )}

      {/* Apply to all siblings toggle */}
      {siblingCount > 1 && (
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={applyToAll}
            onCheckedChange={(checked) => setApplyToAll(checked === true)}
          />
          <span className="text-xs">
            החל על כל {siblingCount} הנודים ברמה זו
          </span>
        </label>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="flex-1 h-7 text-xs gap-1"
        >
          <X className="h-3 w-3" />
          ביטול
        </Button>
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={count <= 0 || !prefix.trim()}
          className="flex-1 h-7 text-xs gap-1"
        >
          <Plus className="h-3 w-3" />
          {applyToAll ? `צור (×${siblingCount})` : 'צור'}
        </Button>
      </div>
    </div>
  );
}
