/**
 * Database types
 * This file will be auto-generated from Supabase
 * For now, we define basic types manually
 */

// Enum for area types - matches DB values, use directly as area_type_id
export enum AreaTypeId {
  MONITORING = 'monitoring',
  ACTION = 'action',
  NIR = 'nir',
  HARVEST = 'harvest',
}

// Severity levels for monitoring and action reports
export enum ReportSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Hebrew labels for severity levels (for UI display)
export const SEVERITY_LABELS: Record<ReportSeverity, string> = {
  [ReportSeverity.LOW]: 'נמוכה',
  [ReportSeverity.MEDIUM]: 'בינונית',
  [ReportSeverity.HIGH]: 'גבוהה',
  [ReportSeverity.CRITICAL]: 'קריטית',
};

// Severity UI config with CSS classes (for chips, dots, etc.)
export const SEVERITY_CONFIG: Record<string, { label: string; dotClass: string; chipClass: string }> = {
  [ReportSeverity.LOW]: { label: 'נמוכה', dotClass: 'severity-dot-low', chipClass: 'severity-low' },
  [ReportSeverity.MEDIUM]: { label: 'בינונית', dotClass: 'severity-dot-medium', chipClass: 'severity-medium' },
  [ReportSeverity.HIGH]: { label: 'גבוהה', dotClass: 'severity-dot-high', chipClass: 'severity-high' },
  [ReportSeverity.CRITICAL]: { label: 'קריטית', dotClass: 'severity-dot-critical', chipClass: 'severity-critical' },
};

// Severity options for dropdowns/selects
export const SEVERITY_OPTIONS = [
  { value: ReportSeverity.LOW, label: SEVERITY_LABELS[ReportSeverity.LOW] },
  { value: ReportSeverity.MEDIUM, label: SEVERITY_LABELS[ReportSeverity.MEDIUM] },
  { value: ReportSeverity.HIGH, label: SEVERITY_LABELS[ReportSeverity.HIGH] },
  { value: ReportSeverity.CRITICAL, label: SEVERITY_LABELS[ReportSeverity.CRITICAL] },
];

// Action type names
export enum ActionTypeName {
  SPRAY = 'spray',
  DRENCH = 'drench',
  SPREAD = 'spread',
}

// Hebrew labels for action type names (for UI display)
export const ACTION_TYPE_LABELS: Record<ActionTypeName, string> = {
  [ActionTypeName.SPRAY]: 'ריסוס',
  [ActionTypeName.DRENCH]: 'הגמעה',
  [ActionTypeName.SPREAD]: 'פיזור',
};

// Action type options for dropdowns/selects
export const ACTION_TYPE_OPTIONS = [
  { value: ActionTypeName.SPRAY, label: ACTION_TYPE_LABELS[ActionTypeName.SPRAY] },
  { value: ActionTypeName.DRENCH, label: ACTION_TYPE_LABELS[ActionTypeName.DRENCH] },
  { value: ActionTypeName.SPREAD, label: ACTION_TYPE_LABELS[ActionTypeName.SPREAD] },
];

// Size unit types for areas and sub-areas
export const SIZE_UNIT_TYPES = [
  { name: 'dunam', description: 'דונם' },
] as const;

export type SizeUnitTypeName = (typeof SIZE_UNIT_TYPES)[number]['name'];

// ---------------------------------------------------------------------------
// Olive harvest module
// ---------------------------------------------------------------------------
// Lookup values are stored in the DB as English codes and rendered in Hebrew,
// the same convention worker_types already follows.

// Status a measurement falls into, per parameter_rules.status
export enum ParameterStatus {
  IDLE = 'idle',
  OK = 'ok',
  PLAN = 'plan',
  URGENT = 'urgent',
}

export const PARAMETER_STATUS_CONFIG: Record<
  ParameterStatus,
  { pillClass: string; severity: number }
> = {
  [ParameterStatus.IDLE]: { pillClass: 'olive-pill-idle', severity: 0 },
  [ParameterStatus.OK]: { pillClass: 'olive-pill-ok', severity: 1 },
  [ParameterStatus.PLAN]: { pillClass: 'olive-pill-plan', severity: 2 },
  [ParameterStatus.URGENT]: { pillClass: 'olive-pill-urgent', severity: 3 },
};

// Ownership category of a plot (סוג מגדל)
export enum PlotType {
  OWNER = 'owner',
  PARTNER = 'partner',
  OCCASIONAL = 'occasional',
}

export const PLOT_TYPE_LABELS: Record<PlotType, string> = {
  [PlotType.OWNER]: 'ארץ גשור',
  [PlotType.PARTNER]: 'שותף',
  [PlotType.OCCASIONAL]: 'מזדמן',
};

export const PLOT_TYPE_OPTIONS = [
  { value: PlotType.OWNER, label: PLOT_TYPE_LABELS[PlotType.OWNER] },
  { value: PlotType.PARTNER, label: PLOT_TYPE_LABELS[PlotType.PARTNER] },
  { value: PlotType.OCCASIONAL, label: PLOT_TYPE_LABELS[PlotType.OCCASIONAL] },
];

// Harvesting equipment (סוג מוסקת)
export enum HarvesterType {
  X1190 = '1190x',
  X9090 = '9090x',
  OTHER = 'other',
}

export const HARVESTER_LABELS: Record<HarvesterType, string> = {
  [HarvesterType.X1190]: 'ניו הולנד 11.90X כפולה',
  [HarvesterType.X9090]: 'ניו הולנד 9090X',
  [HarvesterType.OTHER]: 'אחר (קבלן חיצוני)',
};

export const HARVESTER_OPTIONS = [
  { value: HarvesterType.X1190, label: HARVESTER_LABELS[HarvesterType.X1190] },
  { value: HarvesterType.X9090, label: HARVESTER_LABELS[HarvesterType.X9090] },
  { value: HarvesterType.OTHER, label: HARVESTER_LABELS[HarvesterType.OTHER] },
];

// Irrigation water source (סוג מים)
export enum WaterType {
  FRESH = 'fresh',
  RECLAIMED = 'reclaimed',
  KINNERET = 'kinneret',
}

export const WATER_TYPE_LABELS: Record<WaterType, string> = {
  [WaterType.FRESH]: 'שפירים',
  [WaterType.RECLAIMED]: 'קולחין',
  [WaterType.KINNERET]: 'כנרת',
};

export const WATER_TYPE_OPTIONS = [
  { value: WaterType.FRESH, label: WATER_TYPE_LABELS[WaterType.FRESH] },
  { value: WaterType.RECLAIMED, label: WATER_TYPE_LABELS[WaterType.RECLAIMED] },
  { value: WaterType.KINNERET, label: WATER_TYPE_LABELS[WaterType.KINNERET] },
];

// Alternate-bearing year type (סוג שנה)
export enum SeasonYearType {
  ON = 'ON',
  OFF = 'OFF',
}

export const SEASON_YEAR_TYPE_LABELS: Record<SeasonYearType, string> = {
  [SeasonYearType.ON]: 'שנה עמוסה (ON)',
  [SeasonYearType.OFF]: 'שנה מועטה (OFF)',
};

// Compass direction the sample was taken from (רוח שמיים)
export const NIR_DIRECTIONS = [
  'צפון',
  'דרום',
  'מזרח',
  'מערב',
  'מרכז',
  'צפון מזרח',
  'צפון מערב',
  'דרום מזרח',
  'דרום מערב',
  'מרכזי מזרחי',
  'מרכזי מערבי',
] as const;

export type NirDirection = (typeof NIR_DIRECTIONS)[number];

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      worker_types: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      report_area_types: {
        Row: {
          name: string; // PK - use AreaTypeId enum
          display_name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string; // PK - use AreaTypeId enum
          display_name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          display_name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workers: {
        Row: {
          id: string;
          customer_id: string;
          user_id: string;
          name: string;
          type_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          user_id: string;
          name: string;
          type_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          user_id?: string;
          name?: string;
          type_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      areas: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          crop_id: string | null;
          size: number | null;
          size_unit_type: string | null;
          geometry: Json | null;
          area_type: string | null;
          variety: string | null;
          planting_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          crop_id?: string | null;
          size?: number | null;
          size_unit_type?: string | null;
          geometry?: Json | null;
          area_type?: string | null;
          variety?: string | null;
          planting_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          crop_id?: string | null;
          size?: number | null;
          size_unit_type?: string | null;
          geometry?: Json | null;
          area_type?: string | null;
          variety?: string | null;
          planting_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      sub_areas: {
        Row: {
          id: string;
          area_id: string;
          parent_sub_area_id: string | null;
          level: number;
          name: string;
          variety: string | null;
          planting_time: string | null;
          rows: string | null;
          display: string | null;
          crop_id: string | null;
          size: number | null;
          size_unit_type: string | null;
          geometry: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          area_id: string;
          parent_sub_area_id?: string | null;
          level?: number;
          name: string;
          variety?: string | null;
          planting_time?: string | null;
          rows?: string | null;
          display?: string | null;
          crop_id?: string | null;
          size?: number | null;
          size_unit_type?: string | null;
          geometry?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          area_id?: string;
          parent_sub_area_id?: string | null;
          level?: number;
          name?: string;
          variety?: string | null;
          planting_time?: string | null;
          rows?: string | null;
          display?: string | null;
          crop_id?: string | null;
          size?: number | null;
          size_unit_type?: string | null;
          geometry?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      monitoring_area_report: {
        Row: {
          id: string;
          area_report_id: string;
          sub_area_id: string | null;
          finding_id: string;
          actions_area_report_id: string | null;
          severity: ReportSeverity | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          area_report_id: string;
          sub_area_id: string | null;
          finding_id: string;
          actions_area_report_id?: string | null;
          severity?: ReportSeverity | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          area_report_id?: string;
          sub_area_id?: string | null;
          finding_id?: string;
          actions_area_report_id?: string | null;
          severity?: ReportSeverity | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      monitoring_treatments: {
        Row: {
          id: string;
          monitoring_report_id: string;
          material_id: string | null;
          dosage: number | null;
          unit_type_id: string | null;
          action_type_id: string | null;
          status: string;
          notes: string | null;
          action_treatment_id: string | null;
          treatment_match: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          monitoring_report_id: string;
          material_id?: string | null;
          dosage?: number | null;
          unit_type_id?: string | null;
          action_type_id?: string | null;
          status?: string;
          notes?: string | null;
          action_treatment_id?: string | null;
          treatment_match?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          monitoring_report_id?: string;
          material_id?: string | null;
          dosage?: number | null;
          unit_type_id?: string | null;
          action_type_id?: string | null;
          status?: string;
          notes?: string | null;
          action_treatment_id?: string | null;
          treatment_match?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      actions_area_report: {
        Row: {
          id: string;
          area_report_id: string;
          sub_area_id: string | null;
          finding_id: string;
          severity: ReportSeverity | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          area_report_id: string;
          sub_area_id: string | null;
          finding_id: string;
          severity?: ReportSeverity | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          area_report_id?: string;
          sub_area_id?: string | null;
          finding_id?: string;
          severity?: ReportSeverity | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      action_treatments: {
        Row: {
          id: string;
          action_report_id: string;
          material_id: string | null;
          dosage: number | null;
          unit_type_id: string | null;
          action_type_id: string | null;
          status: string;
          notes: string | null;
          action_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          action_report_id: string;
          material_id?: string | null;
          dosage?: number | null;
          unit_type_id?: string | null;
          action_type_id?: string | null;
          status?: string;
          notes?: string | null;
          action_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          action_report_id?: string;
          material_id?: string | null;
          dosage?: number | null;
          unit_type_id?: string | null;
          action_type_id?: string | null;
          status?: string;
          notes?: string | null;
          action_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      report_areas: {
        Row: {
          id: string;
          area_id: string;
          area_type_id: string;
          name: string;
          description: string | null;
          status: string;
          completion_percentage: number;
          report_number: number;
          worker_id: string | null;
          report_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          area_id: string;
          area_type_id: string;
          name: string;
          description?: string | null;
          status?: string;
          completion_percentage?: number;
          report_number?: number;
          worker_id?: string | null;
          report_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          area_id?: string;
          area_type_id?: string;
          name?: string;
          description?: string | null;
          status?: string;
          completion_percentage?: number;
          report_number?: number;
          worker_id?: string | null;
          report_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invitations: {
        Row: {
          id: string;
          invitation_type: string;
          invited_by_user_id: string;
          invited_user_id: string | null;
          customer_id: string | null;
          email: string;
          name: string;
          worker_type_id: string | null;
          token: string;
          status: string;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invitation_type: string;
          invited_by_user_id: string;
          invited_user_id?: string | null;
          customer_id?: string | null;
          email: string;
          name: string;
          worker_type_id?: string | null;
          token: string;
          status?: string;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invitation_type?: string;
          invited_by_user_id?: string;
          invited_user_id?: string | null;
          customer_id?: string | null;
          email?: string;
          name?: string;
          worker_type_id?: string | null;
          token?: string;
          status?: string;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      customer_areas: {
        Row: {
          id: string;
          customer_id: string;
          area_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          area_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          area_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      findings: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          severity: string | null;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          severity?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          severity?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      unit_types: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      crops: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          parent_crop_id: string | null;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          parent_crop_id?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          parent_crop_id?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      materials: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          active_ingredient: string | null;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          active_ingredient?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          active_ingredient?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      crop_findings: {
        Row: {
          id: string;
          crop_id: string;
          finding_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          crop_id: string;
          finding_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          crop_id?: string;
          finding_id?: string;
          created_at?: string;
        };
      };
      recommend_material: {
        Row: {
          id: string;
          crop_id: string;
          finding_id: string | null;
          action_type_id: string | null;
          material_id: string;
          unit_type_id: string | null;
          dosage: number | null;
          source: string;
          registry_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          crop_id: string;
          finding_id?: string | null;
          action_type_id?: string | null;
          material_id: string;
          unit_type_id?: string | null;
          dosage?: number | null;
          source?: string;
          registry_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          crop_id?: string;
          finding_id?: string | null;
          action_type_id?: string | null;
          material_id?: string;
          unit_type_id?: string | null;
          dosage?: number | null;
          source?: string;
          registry_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      roles: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      permissions: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string | null;
          resource: string;
          action: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string | null;
          resource: string;
          action: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          description?: string | null;
          resource?: string;
          action?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      role_permissions: {
        Row: {
          id: string;
          role_id: string;
          permission_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          role_id: string;
          permission_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          role_id?: string;
          permission_id?: string;
          created_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role_id?: string;
          created_at?: string;
        };
      };
      pesticide_registry: {
        Row: {
          id: string;
          crop_name: string;
          crop_name_en: string | null;
          pest_name: string | null;
          pest_name_en: string | null;
          material_name: string;
          material_name_en: string | null;
          activity_type: string | null;
          activity_type_en: string | null;
          dosage_text: string | null;
          volume_text: string | null;
          license_number: string | null;
          active_ingredient: string | null;
          cas_number: string | null;
          resistance_group: string | null;
          target_code: string | null;
          concentration: string | null;
          concentration_en: string | null;
          formulation: string | null;
          formulation_en: string | null;
          toxicity_info: string | null;
          toxicity_info_en: string | null;
          toxicity_level: string | null;
          toxicity_level_en: string | null;
          license_holder: string | null;
          license_holder_en: string | null;
          manufacturer: string | null;
          manufacturer_en: string | null;
          label_url: string | null;
          crop_group: string | null;
          crop_group_en: string | null;
          pest_group: string | null;
          pest_group_en: string | null;
          pest_latin: string | null;
          approval_date: string | null;
          waiting_period: string | null;
          reentry_period: string | null;
          crop_stage: string | null;
          crop_age: string | null;
          weed_stage: string | null;
          weed_age: string | null;
          operation_type: string | null;
          crop_notes: string | null;
          soil_type: string | null;
          crop_id: string | null;
          finding_id: string | null;
          material_id: string | null;
          import_batch_id: string;
          csv_row_number: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          crop_name: string;
          crop_name_en?: string | null;
          pest_name?: string | null;
          pest_name_en?: string | null;
          material_name: string;
          material_name_en?: string | null;
          activity_type?: string | null;
          activity_type_en?: string | null;
          dosage_text?: string | null;
          volume_text?: string | null;
          license_number?: string | null;
          active_ingredient?: string | null;
          cas_number?: string | null;
          resistance_group?: string | null;
          target_code?: string | null;
          concentration?: string | null;
          concentration_en?: string | null;
          formulation?: string | null;
          formulation_en?: string | null;
          toxicity_info?: string | null;
          toxicity_info_en?: string | null;
          toxicity_level?: string | null;
          toxicity_level_en?: string | null;
          license_holder?: string | null;
          license_holder_en?: string | null;
          manufacturer?: string | null;
          manufacturer_en?: string | null;
          label_url?: string | null;
          crop_group?: string | null;
          crop_group_en?: string | null;
          pest_group?: string | null;
          pest_group_en?: string | null;
          pest_latin?: string | null;
          approval_date?: string | null;
          waiting_period?: string | null;
          reentry_period?: string | null;
          crop_stage?: string | null;
          crop_age?: string | null;
          weed_stage?: string | null;
          weed_age?: string | null;
          operation_type?: string | null;
          crop_notes?: string | null;
          soil_type?: string | null;
          crop_id?: string | null;
          finding_id?: string | null;
          material_id?: string | null;
          import_batch_id: string;
          csv_row_number?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          crop_name?: string;
          pest_name?: string | null;
          material_name?: string;
          activity_type?: string | null;
          dosage_text?: string | null;
          crop_id?: string | null;
          finding_id?: string | null;
          material_id?: string | null;
          updated_at?: string;
        };
      };
      import_batches: {
        Row: {
          id: string;
          filename: string;
          row_count: number;
          status: string;
          error_log: Json | null;
          imported_by: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          filename: string;
          row_count?: number;
          status?: string;
          error_log?: Json | null;
          imported_by?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          filename?: string;
          row_count?: number;
          status?: string;
          error_log?: Json | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
      };
      parameters: {
        Row: {
          code: string; // PK
          label: string;
          unit: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          label: string;
          unit?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          label?: string;
          unit?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      parameter_rules: {
        Row: {
          id: string;
          parameter_code: string;
          upper_bound: number | null; // null = unbounded catch-all, must sort last
          upper_inclusive: boolean;
          status: ParameterStatus;
          severity: number;
          message: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parameter_code: string;
          upper_bound?: number | null;
          upper_inclusive?: boolean;
          status: ParameterStatus;
          severity?: number;
          message: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          parameter_code?: string;
          upper_bound?: number | null;
          upper_inclusive?: boolean;
          status?: ParameterStatus;
          severity?: number;
          message?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      olive_plot_details: {
        Row: {
          area_id: string; // PK, 1:1 with areas
          grower_name: string | null;
          region: string | null;
          plot_type: PlotType | null;
          harvester: HarvesterType | null;
          water_type: WaterType | null;
          takt_count: number | null;
          plant_year_label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          area_id: string;
          grower_name?: string | null;
          region?: string | null;
          plot_type?: PlotType | null;
          harvester?: HarvesterType | null;
          water_type?: WaterType | null;
          takt_count?: number | null;
          plant_year_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          area_id?: string;
          grower_name?: string | null;
          region?: string | null;
          plot_type?: PlotType | null;
          harvester?: HarvesterType | null;
          water_type?: WaterType | null;
          takt_count?: number | null;
          plant_year_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      seasons: {
        Row: {
          id: string;
          name: string;
          year_type: SeasonYearType | null;
          starts_on: string;
          ends_on: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          year_type?: SeasonYearType | null;
          starts_on: string;
          ends_on: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          year_type?: SeasonYearType | null;
          starts_on?: string;
          ends_on?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      yield_estimates: {
        Row: {
          id: string;
          area_id: string;
          season_id: string;
          kg_per_dunam: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          area_id: string;
          season_id: string;
          kg_per_dunam?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          area_id?: string;
          season_id?: string;
          kg_per_dunam?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      variety_windows: {
        Row: {
          id: string;
          variety: string;
          start_dm: string; // 'DD/MM'
          end_dm: string; // 'DD/MM', may wrap the year end
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          variety: string;
          start_dm: string;
          end_dm: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          variety?: string;
          start_dm?: string;
          end_dm?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      weather_days: {
        Row: {
          id: string;
          entry_date: string;
          temp_min: number | null;
          temp_max: number | null;
          rain_mm: number | null;
          wind_kmh: number | null;
          is_manual: boolean; // manual rows win over fetched forecast
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entry_date: string;
          temp_min?: number | null;
          temp_max?: number | null;
          rain_mm?: number | null;
          wind_kmh?: number | null;
          is_manual?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entry_date?: string;
          temp_min?: number | null;
          temp_max?: number | null;
          rain_mm?: number | null;
          wind_kmh?: number | null;
          is_manual?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      nir_report: {
        Row: {
          report_area_id: string; // PK, detail of report_areas where area_type_id = 'nir'
          sub_area_id: string | null;
          oil: number | null;
          water: number | null;
          dry: number | null; // GENERATED ALWAYS — never written
          green: number | null;
          acid: number | null;
          maturity: number | null;
          irrig_amount: number | null;
          direction: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          report_area_id: string;
          sub_area_id?: string | null;
          oil?: number | null;
          water?: number | null;
          green?: number | null;
          acid?: number | null;
          maturity?: number | null;
          irrig_amount?: number | null;
          direction?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          report_area_id?: string;
          sub_area_id?: string | null;
          oil?: number | null;
          water?: number | null;
          green?: number | null;
          acid?: number | null;
          maturity?: number | null;
          irrig_amount?: number | null;
          direction?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      harvest_report: {
        Row: {
          report_area_id: string; // PK, detail of report_areas where area_type_id = 'harvest'
          sub_area_id: string | null;
          pass_number: number;
          harvester_type: string | null;
          operator: string | null;
          area_done_dunam: number | null;
          fruit_kg: number | null;
          oil_kg: number | null;
          is_final: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          report_area_id: string;
          sub_area_id?: string | null;
          pass_number?: number;
          harvester_type?: string | null;
          operator?: string | null;
          area_done_dunam?: number | null;
          fruit_kg?: number | null;
          oil_kg?: number | null;
          is_final?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          report_area_id?: string;
          sub_area_id?: string | null;
          pass_number?: number;
          harvester_type?: string | null;
          operator?: string | null;
          area_done_dunam?: number | null;
          fruit_kg?: number | null;
          oil_kg?: number | null;
          is_final?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// Convenience type aliases
export type Customer = Database['public']['Tables']['customers']['Row'];
export type WorkerType = Database['public']['Tables']['worker_types']['Row'];
export type ReportAreaType = Database['public']['Tables']['report_area_types']['Row'];
export type Worker = Database['public']['Tables']['workers']['Row'];
export type Area = Database['public']['Tables']['areas']['Row'];
export type SubArea = Database['public']['Tables']['sub_areas']['Row'];
export type Crop = Database['public']['Tables']['crops']['Row'];
export type Role = Database['public']['Tables']['roles']['Row'];
export type Permission = Database['public']['Tables']['permissions']['Row'];
export type RolePermission = Database['public']['Tables']['role_permissions']['Row'];
export type UserRole = Database['public']['Tables']['user_roles']['Row'];

// Olive harvest module
export type Parameter = Database['public']['Tables']['parameters']['Row'];
export type ParameterRule = Database['public']['Tables']['parameter_rules']['Row'];
export type OlivePlotDetails = Database['public']['Tables']['olive_plot_details']['Row'];
export type Season = Database['public']['Tables']['seasons']['Row'];
export type YieldEstimate = Database['public']['Tables']['yield_estimates']['Row'];
export type VarietyWindow = Database['public']['Tables']['variety_windows']['Row'];
export type WeatherDay = Database['public']['Tables']['weather_days']['Row'];
export type NirReport = Database['public']['Tables']['nir_report']['Row'];
export type HarvestReport = Database['public']['Tables']['harvest_report']['Row'];
