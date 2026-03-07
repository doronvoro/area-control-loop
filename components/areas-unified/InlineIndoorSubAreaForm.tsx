'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { showToast } from '@/lib/toast';
import { Loader2 } from 'lucide-react';
import { InlineTemplateForm } from '@/components/indoor-designer/tree/InlineTemplateForm';
import { subdivideRectangle, createRectangleGeometry, getBounds } from '@/components/indoor-designer/geometry/geometry-utils';
import type {
  TreeNode,
  InlineTemplateFormData,
} from '@/components/indoor-designer/types';
import type { GeoJSONPolygon } from '@/components/map/types';

interface InlineIndoorSubAreaFormProps {
  areaId: string;
  parentSubAreaId: string | null;
  parentName: string;
  parentLevel: number;
  parentGeometry: GeoJSONPolygon | null;
  existingChildCount: number;
  siblingCount: number;
  depth: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function InlineIndoorSubAreaForm({
  areaId,
  parentSubAreaId,
  parentName,
  parentLevel,
  parentGeometry: initialGeometry,
  existingChildCount,
  siblingCount,
  depth,
  onSuccess,
  onCancel,
}: InlineIndoorSubAreaFormProps) {
  const [saving, setSaving] = useState(false);
  const [geometry, setGeometry] = useState<GeoJSONPolygon | null>(initialGeometry);
  const [loadingGeometry, setLoadingGeometry] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch geometry if not provided
  useEffect(() => {
    setGeometry(initialGeometry);

    if (!initialGeometry) {
      setLoadingGeometry(true);
      if (parentSubAreaId) {
        // Fetch sub-area geometry
        fetch(`/api/sub-areas?areaId=${areaId}`)
          .then((res) => res.json())
          .then((data) => {
            const subArea = (Array.isArray(data) ? data : []).find((sa: any) => sa.id === parentSubAreaId);
            if (subArea?.geometry) {
              setGeometry(subArea.geometry);
            }
          })
          .catch(console.error)
          .finally(() => setLoadingGeometry(false));
      } else {
        // Fetch area geometry — /api/areas returns all areas for the customer including geometry
        fetch(`/api/areas`)
          .then((res) => res.json())
          .then((data) => {
            const area = (Array.isArray(data) ? data : []).find((a: any) => a.id === areaId);
            if (area?.geometry) {
              setGeometry(area.geometry);
            } else {
              // Indoor areas may not have geometry stored — create default from dimensions
              // (matching IndoorAreaEditor's fallback behavior)
              const w = area?.size || 100;
              const h = 50;
              setGeometry(createRectangleGeometry(0, 0, w, h));
            }
          })
          .catch(console.error)
          .finally(() => setLoadingGeometry(false));
      }
    }
  }, [areaId, parentSubAreaId, initialGeometry]);

  // Scroll into view on mount
  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  // Build a TreeNode compatible with InlineTemplateForm
  const parentNode: TreeNode = useMemo(
    () => ({
      id: parentSubAreaId || 'root',
      name: parentName,
      level: parentLevel,
      geometry,
      children: [],
      parentId: null,
    }),
    [parentSubAreaId, parentName, parentLevel, geometry]
  );

  const handleGenerate = useCallback(
    async (config: InlineTemplateFormData) => {
      if (!geometry) {
        showToast.error('לא נמצאה גאומטריה להורה. יש להגדיר גבולות תחילה.');
        return;
      }

      setSaving(true);
      try {
        const childGeometries = subdivideRectangle(
          geometry,
          config.count,
          config.direction
        );

        const childLevel = parentLevel + 1;

        for (let i = 0; i < childGeometries.length; i++) {
          const name =
            config.naming.type === 'custom' && config.naming.customNames?.[i]
              ? config.naming.customNames[i]
              : `${config.naming.prefix} ${i + 1}`;

          const res = await fetch('/api/sub-areas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              area_id: areaId,
              name,
              parent_sub_area_id: parentSubAreaId || null,
              level: childLevel,
              geometry: childGeometries[i],
            }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || `שגיאה ביצירת תת-שטח ${name}`);
          }
        }

        showToast.success(`נוצרו ${childGeometries.length} תתי-שטחים בהצלחה`);
        onSuccess();
      } catch (error: any) {
        showToast.error(error.message || 'שגיאה ביצירת תתי-שטחים');
        console.error(error);
      } finally {
        setSaving(false);
      }
    },
    [areaId, parentSubAreaId, parentLevel, geometry, onSuccess]
  );

  const isLoading = saving || loadingGeometry;

  return (
    <div
      ref={containerRef}
      className="overflow-hidden pe-2"
      style={{ paddingInlineStart: `${depth * 1.5 + 0.5}rem` }}
    >
      {isLoading ? (
        <div className="my-1 p-3 bg-muted/40 rounded-lg border border-dashed flex flex-col items-center justify-center py-6 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">
            {saving ? 'יוצר תתי-שטחים...' : 'טוען נתונים...'}
          </span>
        </div>
      ) : (
        <InlineTemplateForm
          parentNode={parentNode}
          hasExistingChildren={existingChildCount > 0}
          siblingCount={siblingCount}
          onGenerate={handleGenerate}
          onGenerateForAll={handleGenerate}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}
