import type { GeoJSONPolygon } from '@/components/map/types';

// Split direction for subdivisions
export type SplitDirection = 'horizontal' | 'vertical';

// Naming pattern for auto-generated sub-areas
export interface NamingPattern {
  type: 'numbered' | 'custom';
  prefix: string; // e.g., "אזור", "אשנב", "שורה"
  customNames?: string[];
}

// Configuration for splitting a parent into children
export interface LevelSplitConfig {
  parentTempId: string;
  count: number;
  direction: SplitDirection;
  naming: NamingPattern;
}

// A generated sub-area (before saving to DB)
export interface GeneratedSubArea {
  tempId: string;
  parentTempId: string | null;
  level: number;
  name: string;
  geometry: GeoJSONPolygon;
}

// Main designer state (replaces WizardState)
export interface DesignerState {
  areaName: string;
  areaDescription: string;
  width: number; // meters
  height: number; // meters
  areaGeometry: GeoJSONPolygon | null;
  generatedSubAreas: GeneratedSubArea[]; // flat list, single source of truth
  selectedNodeId: string | null; // tempId or 'root'
  activeTemplateNodeId: string | null; // which node has the "add children" form open
  renamingNodeId: string | null; // which node is being renamed inline
}

// Canvas drawing state
export interface IndoorDrawingState {
  mode: 'view' | 'draw-area' | 'edit-sub-area';
  editingTempId?: string;
}

// For canvas zoom + highlight behavior
export interface SelectionContext {
  selectedId: string | null;
  highlightedIds: Set<string>; // selected + ancestors + descendants
  zoomTarget: GeoJSONPolygon | null;
}

// Breadcrumb path segment
export interface BreadcrumbSegment {
  id: string;
  name: string;
  level: number;
}

// Tree node (computed from flat generatedSubAreas)
export interface TreeNode {
  id: string; // tempId or 'root'
  name: string;
  level: number; // 0 for root, 1+ for sub-areas
  geometry: GeoJSONPolygon | null;
  children: TreeNode[];
  parentId: string | null;
}

// For the inline "add children" template form
export interface InlineTemplateFormData {
  count: number;
  direction: SplitDirection;
  naming: NamingPattern;
}

// Default level naming prefixes in Hebrew
export const DEFAULT_LEVEL_PREFIXES: Record<number, string> = {
  1: 'אזור',
  2: 'אשנב',
  3: 'שורה',
};

const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 50;

export const INITIAL_DESIGNER_STATE: DesignerState = {
  areaName: '',
  areaDescription: '',
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  areaGeometry: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [DEFAULT_WIDTH, 0],
        [DEFAULT_WIDTH, DEFAULT_HEIGHT],
        [0, DEFAULT_HEIGHT],
        [0, 0],
      ],
    ],
  },
  generatedSubAreas: [],
  selectedNodeId: null,
  activeTemplateNodeId: null,
  renamingNodeId: null,
};
