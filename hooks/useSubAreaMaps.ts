import { useMemo } from 'react';

interface SubAreaLike {
  id: string;
  parent_sub_area_id?: string | null;
  level?: number;
}

/**
 * Build parentMap and levelMap from a sub-areas array.
 * Used by MultiSelect for tree hierarchy support (indentation + parent selection).
 */
export function useSubAreaMaps(subAreas: SubAreaLike[]) {
  const parentMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const sa of subAreas) {
      map[sa.id] = sa.parent_sub_area_id || null;
    }
    return map;
  }, [subAreas]);

  const levelMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sa of subAreas) {
      map[sa.id] = (sa.level || 1) - 1;
    }
    return map;
  }, [subAreas]);

  return { parentMap, levelMap };
}
