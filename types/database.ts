/**
 * Database types
 * This file will be auto-generated from Supabase
 * For now, we define basic types manually
 */

// Enum for area types - matches DB values, use directly as area_type_id
export enum AreaTypeId {
  MONITORING = 'monitoring',
  ACTION = 'action',
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

// Severity options for dropdowns/selects
export const SEVERITY_OPTIONS = [
  { value: ReportSeverity.LOW, label: SEVERITY_LABELS[ReportSeverity.LOW] },
  { value: ReportSeverity.MEDIUM, label: SEVERITY_LABELS[ReportSeverity.MEDIUM] },
  { value: ReportSeverity.HIGH, label: SEVERITY_LABELS[ReportSeverity.HIGH] },
  { value: ReportSeverity.CRITICAL, label: SEVERITY_LABELS[ReportSeverity.CRITICAL] },
];

// Size unit types for areas and sub-areas
export const SIZE_UNIT_TYPES = [
  { name: 'dunam', description: 'דונם' },
] as const;

export type SizeUnitTypeName = (typeof SIZE_UNIT_TYPES)[number]['name'];

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
      action_types: {
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
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
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
