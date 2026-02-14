export type { ActionTask, CompletedTaskData } from '@/components/actions/TaskCard';

export type AreaStatus = 'all_done' | 'partial' | 'needs_action' | 'no_monitoring';

export interface AreaStatusData {
  id: string;
  name: string;
  status: AreaStatus;
  total_findings: number;
  total_treatments: number;
  completed_treatments: number;
  pending_treatments: number;
  last_monitoring: string | null;
  last_action: string | null;
}

export interface SubAreaTreeNode {
  id: string;
  name: string;
  display: string | null;
  variety: string | null;
  rows: string | null;
  crop_id: string | null;
  level: number;
  children: SubAreaTreeNode[];
}

export interface FlatSubArea {
  id: string;
  name: string;
  display: string | null;
  variety: string | null;
  rows: string | null;
  depth: number;
  hasChildren: boolean;
  taskCount: number;
}

export interface RefItem {
  id: string;
  name: string;
}

export interface AreaMapFormData {
  isAdmin: boolean;
  customers: any[];
  currentWorkerId: string | null;
  initialWorkers: { id: string; name: string }[];
  findings: any[];
  actionTypes: RefItem[];
  unitTypes: RefItem[];
}

export const STATUS_CONFIG: Record<AreaStatus, {
  label: string;
  badgeClass: string;
  dotColor: string;
  progressColor: string;
}> = {
  all_done: {
    label: 'טופל',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColor: 'bg-emerald-500',
    progressColor: 'bg-emerald-500',
  },
  partial: {
    label: 'בטיפול',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-500',
    progressColor: 'bg-amber-500',
  },
  needs_action: {
    label: 'דורש טיפול',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    dotColor: 'bg-red-500',
    progressColor: 'bg-red-500',
  },
  no_monitoring: {
    label: 'לא נבדק',
    badgeClass: 'bg-gray-50 text-gray-500 border-gray-200',
    dotColor: 'bg-gray-400',
    progressColor: 'bg-gray-400',
  },
};
