/**
 * Database types
 * This file will be auto-generated from Supabase
 * For now, we define basic types manually
 */

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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          crop_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          crop_id?: string | null;
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
          created_at?: string;
          updated_at?: string;
        };
      };
      monitoring_area_report: {
        Row: {
          id: string;
          area_report_id: string;
          sub_area_id: string;
          finding_id: string;
          recommend_material_id: string | null;
          recommend_dosage: number | null;
          recommend_unit_type_id: string | null;
          recommend_action_type_id: string | null;
          actions_area_report_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          area_report_id: string;
          sub_area_id: string;
          finding_id: string;
          recommend_material_id?: string | null;
          recommend_dosage?: number | null;
          recommend_unit_type_id?: string | null;
          recommend_action_type_id?: string | null;
          actions_area_report_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          area_report_id?: string;
          sub_area_id?: string;
          finding_id?: string;
          recommend_material_id?: string | null;
          recommend_dosage?: number | null;
          recommend_unit_type_id?: string | null;
          recommend_action_type_id?: string | null;
          actions_area_report_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      actions_area_report: {
        Row: {
          id: string;
          area_report_id: string;
          sub_area_id: string;
          finding_id: string;
          material: string | null;
          dosage: string | null;
          unit_type_id: string | null;
          action_type_id: string | null;
          action_time: string | null;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          area_report_id: string;
          sub_area_id: string;
          finding_id: string;
          material?: string | null;
          dosage?: string | null;
          unit_type_id?: string | null;
          action_type_id?: string | null;
          action_time?: string | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          area_report_id?: string;
          sub_area_id?: string;
          finding_id?: string;
          material?: string | null;
          dosage?: string | null;
          unit_type_id?: string | null;
          action_type_id?: string | null;
          action_time?: string | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      report_areas: {
        Row: {
          id: string;
          area_id: string;
          type: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          area_id: string;
          type: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          area_id?: string;
          type?: string;
          name?: string;
          description?: string | null;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          severity?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          severity?: string | null;
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
      materials: {
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
          action_type_id: string;
          material_id: string;
          unit_type_id: string;
          dosage: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          crop_id: string;
          action_type_id: string;
          material_id: string;
          unit_type_id: string;
          dosage: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          crop_id?: string;
          action_type_id?: string;
          material_id?: string;
          unit_type_id?: string;
          dosage?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
