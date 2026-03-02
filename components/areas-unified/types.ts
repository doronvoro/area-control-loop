// Re-export shared types from area-management
export type {
  Customer,
  Area,
  SubArea,
  Crop,
  Permissions,
  TreeNode,
} from '@/components/area-management/AreaManagementLayout';

// Re-export map types
export type {
  AreaWithGeometry,
  SubAreaWithGeometry,
  DrawingState,
  GeoJSONPolygon,
} from '@/components/map/types';

// Re-export indoor designer types
export type {
  DesignerState,
  GeneratedSubArea,
} from '@/components/indoor-designer/types';

import type { Area } from '@/components/area-management/AreaManagementLayout';

export type AreaType = 'indoor' | 'outdoor';
export type PageMode = 'edit' | 'live';

export interface AreaWithType extends Area {
  area_type: AreaType;
}
