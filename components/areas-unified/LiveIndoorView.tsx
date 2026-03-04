'use client';

import { useMemo } from 'react';
import { InteractiveIndoorCanvas } from '@/components/indoor-designer/canvas/InteractiveIndoorCanvas';
import { getBounds } from '@/components/indoor-designer/geometry/geometry-utils';
import type { GeneratedSubArea } from '@/components/indoor-designer/types';
import type { GeoJSONPolygon } from '@/components/map/types';
import type { SubArea, AreaWithType } from './types';

interface LiveIndoorViewProps {
  area: AreaWithType | null;
  subAreas: SubArea[];
  selectedSubAreaId?: string;
  pendingMonitoringCounts?: Record<string, number>;
  monitoringReports?: Record<string, any[]>;
}

function convertDbToDesignerSubAreas(
  subAreas: SubArea[],
  parentTempId: string | null = null
): GeneratedSubArea[] {
  const result: GeneratedSubArea[] = [];
  for (const sa of subAreas) {
    const tempId = sa.id;
    result.push({
      tempId,
      parentTempId,
      level: sa.level,
      name: sa.name,
      geometry: (sa as any).geometry || {
        type: 'Polygon' as const,
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      },
    });
    if (sa.children && sa.children.length > 0) {
      result.push(...convertDbToDesignerSubAreas(sa.children, tempId));
    }
  }
  return result;
}

export function LiveIndoorView({
  area,
  subAreas,
  selectedSubAreaId,
  pendingMonitoringCounts,
  monitoringReports,
}: LiveIndoorViewProps) {
  const { areaGeometry, width, height, generatedSubAreas } = useMemo(() => {
    if (!area) return { areaGeometry: null, width: 100, height: 50, generatedSubAreas: [] };

    const geo = (area as any).geometry as GeoJSONPolygon | null;
    let w = 100;
    let h = 50;
    if (geo) {
      const bounds = getBounds(geo);
      w = Math.round((bounds.maxX - bounds.minX) * 10) / 10 || 100;
      h = Math.round((bounds.maxY - bounds.minY) * 10) / 10 || 50;
    }

    return {
      areaGeometry: geo || {
        type: 'Polygon' as const,
        coordinates: [[[0, 0], [w, 0], [w, h], [0, h], [0, 0]]],
      },
      width: w,
      height: h,
      generatedSubAreas: convertDbToDesignerSubAreas(subAreas),
    };
  }, [area, subAreas]);

  if (!area) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground border rounded-lg bg-card">
        <p className="text-sm">בחר שטח פנימי מהעץ</p>
      </div>
    );
  }

  return (
    <div className="h-full rounded-lg overflow-hidden border relative z-0">
      <InteractiveIndoorCanvas
        areaGeometry={areaGeometry}
        subAreas={generatedSubAreas}
        width={width}
        height={height}
        drawingState={{ mode: 'view' }}
        selectedTempId={selectedSubAreaId || null}
        showLabels
        showLegend
        pendingMonitoringCounts={pendingMonitoringCounts}
        monitoringReports={monitoringReports}
      />
    </div>
  );
}
