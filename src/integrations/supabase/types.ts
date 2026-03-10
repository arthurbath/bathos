export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bathos_auth_rate_limits: {
        Row: {
          action_type: string
          created_at: string
          id: string
          ip_address: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          ip_address: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      bathos_feedback: {
        Row: {
          context: string
          created_at: string
          email: string | null
          id: string
          message: string
          user_id: string | null
        }
        Insert: {
          context?: string
          created_at?: string
          email?: string | null
          id?: string
          message: string
          user_id?: string | null
        }
        Update: {
          context?: string
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bathos_profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_test_user: boolean
          terms_version_accepted: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_test_user?: boolean
          terms_version_accepted?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_test_user?: boolean
          terms_version_accepted?: string | null
        }
        Relationships: []
      }
      bathos_terms_versions: {
        Row: {
          change_description: string
          created_at: string
          version: string
        }
        Insert: {
          change_description: string
          created_at?: string
          version: string
        }
        Update: {
          change_description?: string
          created_at?: string
          version?: string
        }
        Relationships: []
      }
      bathos_user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      bathos_user_settings: {
        Row: {
          created_at: string
          grid_column_widths: Json
          id: string
          theme: string
          updated_at: string
          use_default_grid_column_widths: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          grid_column_widths?: Json
          id?: string
          theme?: string
          updated_at?: string
          use_default_grid_column_widths?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          grid_column_widths?: Json
          id?: string
          theme?: string
          updated_at?: string
          use_default_grid_column_widths?: boolean
          user_id?: string
        }
        Relationships: []
      }
      budget_budgets: {
        Row: {
          color: string | null
          created_at: string
          household_id: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          household_id: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          household_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "budget_households"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          color: string | null
          created_at: string
          household_id: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          household_id: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          household_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "budget_households"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_expenses: {
        Row: {
          amount: number
          average_records: Json
          benefit_x: number
          budget_id: string | null
          category_id: string | null
          created_at: string
          current_period_handling: string
          frequency_param: number | null
          frequency_type: string
          household_id: string
          id: string
          is_estimate: boolean
          linked_account_id: string | null
          name: string
          value_type: string
        }
        Insert: {
          amount?: number
          average_records?: Json
          benefit_x?: number
          budget_id?: string | null
          category_id?: string | null
          created_at?: string
          current_period_handling?: string
          frequency_param?: number | null
          frequency_type?: string
          household_id: string
          id?: string
          is_estimate?: boolean
          linked_account_id?: string | null
          name: string
          value_type?: string
        }
        Update: {
          amount?: number
          average_records?: Json
          benefit_x?: number
          budget_id?: string | null
          category_id?: string | null
          created_at?: string
          current_period_handling?: string
          frequency_param?: number | null
          frequency_type?: string
          household_id?: string
          id?: string
          is_estimate?: boolean
          linked_account_id?: string | null
          name?: string
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budget_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "budget_households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_linked_account_id_fkey"
            columns: ["linked_account_id"]
            isOneToOne: false
            referencedRelation: "budget_linked_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_household_members: {
        Row: {
          created_at: string
          household_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "budget_households"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_households: {
        Row: {
          created_at: string
          id: string
          invite_code: string | null
          name: string
          partner_x_color: string | null
          partner_x_name: string
          partner_x_wage_cents_per_dollar: number | null
          partner_y_color: string | null
          partner_y_name: string
          partner_y_wage_cents_per_dollar: number | null
          wage_gap_adjustment_enabled: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string | null
          name?: string
          partner_x_color?: string | null
          partner_x_name?: string
          partner_x_wage_cents_per_dollar?: number | null
          partner_y_color?: string | null
          partner_y_name?: string
          partner_y_wage_cents_per_dollar?: number | null
          wage_gap_adjustment_enabled?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string | null
          name?: string
          partner_x_color?: string | null
          partner_x_name?: string
          partner_x_wage_cents_per_dollar?: number | null
          partner_y_color?: string | null
          partner_y_name?: string
          partner_y_wage_cents_per_dollar?: number | null
          wage_gap_adjustment_enabled?: boolean
        }
        Relationships: []
      }
      budget_income_streams: {
        Row: {
          amount: number
          average_records: Json
          created_at: string
          current_period_handling: string
          frequency_param: number | null
          frequency_type: string
          household_id: string
          id: string
          is_estimate: boolean
          name: string
          partner_label: string
          value_type: string
        }
        Insert: {
          amount?: number
          average_records?: Json
          created_at?: string
          current_period_handling?: string
          frequency_param?: number | null
          frequency_type?: string
          household_id: string
          id?: string
          is_estimate?: boolean
          name: string
          partner_label: string
          value_type?: string
        }
        Update: {
          amount?: number
          average_records?: Json
          created_at?: string
          current_period_handling?: string
          frequency_param?: number | null
          frequency_type?: string
          household_id?: string
          id?: string
          is_estimate?: boolean
          name?: string
          partner_label?: string
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_streams_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "budget_households"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_linked_accounts: {
        Row: {
          color: string | null
          created_at: string
          household_id: string
          id: string
          name: string
          owner_partner: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          household_id: string
          id?: string
          name: string
          owner_partner?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          owner_partner?: string
        }
        Relationships: [
          {
            foreignKeyName: "linked_accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "budget_households"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_restore_points: {
        Row: {
          created_at: string
          data: Json
          household_id: string
          id: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          household_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          household_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restore_points_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "budget_households"
            referencedColumns: ["id"]
          },
        ]
      }
      drawers_household_members: {
        Row: {
          created_at: string
          household_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawers_household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "drawers_households"
            referencedColumns: ["id"]
          },
        ]
      }
      drawers_households: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      drawers_instances: {
        Row: {
          created_at: string
          cubby_x: number | null
          cubby_y: number | null
          drawer_type: string
          household_id: string
          id: string
          label: string | null
          limbo_order: number | null
          location_kind: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cubby_x?: number | null
          cubby_y?: number | null
          drawer_type: string
          household_id: string
          id?: string
          label?: string | null
          limbo_order?: number | null
          location_kind: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cubby_x?: number | null
          cubby_y?: number | null
          drawer_type?: string
          household_id?: string
          id?: string
          label?: string | null
          limbo_order?: number | null
          location_kind?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawers_instances_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "drawers_households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawers_instances_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "drawers_units"
            referencedColumns: ["id"]
          },
        ]
      }
      drawers_units: {
        Row: {
          created_at: string
          frame_color: string
          height: number
          household_id: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          width: number
        }
        Insert: {
          created_at?: string
          frame_color?: string
          height: number
          household_id: string
          id?: string
          name: string
          sort_order: number
          updated_at?: string
          width: number
        }
        Update: {
          created_at?: string
          frame_color?: string
          height?: number
          household_id?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "drawers_units_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "drawers_households"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_definitions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          name: string
          rep_count: number | null
          updated_at: string
          user_id: string
          weight_delta_lbs: number | null
          weight_lbs: number | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          name: string
          rep_count?: number | null
          updated_at?: string
          user_id: string
          weight_delta_lbs?: number | null
          weight_lbs?: number | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          name?: string
          rep_count?: number | null
          updated_at?: string
          user_id?: string
          weight_delta_lbs?: number | null
          weight_lbs?: number | null
        }
        Relationships: []
      }
      exercise_routine_items: {
        Row: {
          exercise_definition_id: string
          id: string
          routine_id: string
          sort_order: number
        }
        Insert: {
          exercise_definition_id: string
          id?: string
          routine_id: string
          sort_order?: number
        }
        Update: {
          exercise_definition_id?: string
          id?: string
          routine_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "exercise_routine_items_exercise_definition_id_fkey"
            columns: ["exercise_definition_id"]
            isOneToOne: false
            referencedRelation: "exercise_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_routine_items_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "exercise_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_routines: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garage_services: {
        Row: {
          cadence_type: Database["public"]["Enums"]["garage_cadence_type"]
          created_at: string
          every_miles: number | null
          every_months: number | null
          id: string
          monitoring: boolean
          name: string
          notes: string | null
          sort_order: number
          type: Database["public"]["Enums"]["garage_service_type"]
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          cadence_type?: Database["public"]["Enums"]["garage_cadence_type"]
          created_at?: string
          every_miles?: number | null
          every_months?: number | null
          id?: string
          monitoring?: boolean
          name: string
          notes?: string | null
          sort_order?: number
          type: Database["public"]["Enums"]["garage_service_type"]
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          cadence_type?: Database["public"]["Enums"]["garage_cadence_type"]
          created_at?: string
          every_miles?: number | null
          every_months?: number | null
          id?: string
          monitoring?: boolean
          name?: string
          notes?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["garage_service_type"]
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_services_vehicle_fk"
            columns: ["vehicle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "garage_vehicles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      garage_servicing_receipts: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          servicing_id: string
          size_bytes: number | null
          storage_object_path: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          servicing_id: string
          size_bytes?: number | null
          storage_object_path: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          servicing_id?: string
          size_bytes?: number | null
          storage_object_path?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_servicing_receipts_servicing_fk"
            columns: ["servicing_id", "user_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "garage_servicings"
            referencedColumns: ["id", "user_id", "vehicle_id"]
          },
          {
            foreignKeyName: "garage_servicing_receipts_vehicle_fk"
            columns: ["vehicle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "garage_vehicles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      garage_servicing_services: {
        Row: {
          created_at: string
          id: string
          service_id: string
          servicing_id: string
          status: Database["public"]["Enums"]["garage_service_status"]
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_id: string
          servicing_id: string
          status?: Database["public"]["Enums"]["garage_service_status"]
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          service_id?: string
          servicing_id?: string
          status?: Database["public"]["Enums"]["garage_service_status"]
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_servicing_services_service_fk"
            columns: ["service_id", "user_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "garage_services"
            referencedColumns: ["id", "user_id", "vehicle_id"]
          },
          {
            foreignKeyName: "garage_servicing_services_servicing_fk"
            columns: ["servicing_id", "user_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "garage_servicings"
            referencedColumns: ["id", "user_id", "vehicle_id"]
          },
          {
            foreignKeyName: "garage_servicing_services_vehicle_fk"
            columns: ["vehicle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "garage_vehicles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      garage_servicings: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          odometer_miles: number
          service_date: string
          shop_name: string | null
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          odometer_miles: number
          service_date: string
          shop_name?: string | null
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          odometer_miles?: number
          service_date?: string
          shop_name?: string | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_servicings_vehicle_fk"
            columns: ["vehicle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "garage_vehicles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      garage_user_settings: {
        Row: {
          created_at: string
          id: string
          upcoming_days_default: number
          upcoming_miles_default: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          upcoming_days_default?: number
          upcoming_miles_default?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          upcoming_days_default?: number
          upcoming_miles_default?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garage_vehicles: {
        Row: {
          created_at: string
          current_odometer_miles: number
          id: string
          in_service_date: string | null
          is_active: boolean
          make: string | null
          model: string | null
          model_year: number | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_odometer_miles?: number
          id?: string
          in_service_date?: string | null
          is_active?: boolean
          make?: string | null
          model?: string | null
          model_year?: number | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_odometer_miles?: number
          id?: string
          in_service_date?: string | null
          is_active?: boolean
          make?: string | null
          model?: string | null
          model_year?: number | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      budget_create_household_for_current_user: { Args: never; Returns: Json }
      budget_delete_household: {
        Args: { _household_id: string }
        Returns: Json
      }
      budget_join_household_for_current_user: {
        Args: { _invite_code: string }
        Returns: Json
      }
      budget_leave_household: { Args: { _household_id: string }; Returns: Json }
      budget_list_household_members: {
        Args: { _household_id: string }
        Returns: {
          created_at: string
          display_name: string
          email: string
          is_self: boolean
          user_id: string
        }[]
      }
      budget_reassign_category_and_delete: {
        Args: {
          _household_id: string
          _new_category_id: string
          _old_category_id: string
        }
        Returns: Json
      }
      budget_reassign_linked_account_and_delete: {
        Args: {
          _household_id: string
          _new_linked_account_id: string
          _old_linked_account_id: string
        }
        Returns: Json
      }
      budget_remove_household_member: {
        Args: { _household_id: string; _member_user_id: string }
        Returns: Json
      }
      budget_restore_household_snapshot: {
        Args: { _household_id: string; _snapshot: Json }
        Returns: Json
      }
      budget_rotate_household_invite_code: {
        Args: { _household_id: string }
        Returns: Json
      }
      budget_update_partner_names: {
        Args: {
          _household_id: string
          _partner_x_name: string
          _partner_y_name: string
        }
        Returns: Json
      }
      budget_update_partner_settings: {
        Args: {
          _household_id: string
          _partner_x_name: string
          _partner_x_wage_cents_per_dollar: number
          _partner_y_name: string
          _partner_y_wage_cents_per_dollar: number
          _wage_gap_adjustment_enabled: boolean
        }
        Returns: Json
      }
      cleanup_old_bathos_auth_rate_limits: { Args: never; Returns: undefined }
      drawers_create_household_for_current_user: { Args: never; Returns: Json }
      drawers_delete_household: {
        Args: { _household_id: string }
        Returns: Json
      }
      drawers_join_household_for_current_user: {
        Args: { _invite_code: string }
        Returns: Json
      }
      drawers_leave_household: {
        Args: { _household_id: string }
        Returns: Json
      }
      drawers_list_household_members: {
        Args: { _household_id: string }
        Returns: {
          created_at: string
          display_name: string
          email: string
          is_self: boolean
          user_id: string
        }[]
      }
      drawers_remove_household_member: {
        Args: { _household_id: string; _member_user_id: string }
        Returns: Json
      }
      drawers_rotate_household_invite_code: {
        Args: { _household_id: string }
        Returns: Json
      }
      drawers_save_unit: {
        Args: {
          _frame_color: string
          _height: number
          _household_id: string
          _name: string
          _unit_id: string
          _width: number
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_drawers_household_member: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      is_household_member: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      lookup_drawers_household_by_invite_code: {
        Args: { _code: string }
        Returns: string
      }
      lookup_household_by_invite_code: {
        Args: { _code: string }
        Returns: string
      }
      move_drawers_drawer: {
        Args: {
          _insert_id: string
          _target_unit_id: string
          _target_x: number
          _target_y: number
        }
        Returns: undefined
      }
      move_drawers_drawer_to_limbo: {
        Args: { _insert_id: string }
        Returns: undefined
      }
      move_drawers_unit_drawers_to_limbo: {
        Args: { _unit_id: string }
        Returns: number
      }
      resize_drawers_unit: {
        Args: { _new_h: number; _new_w: number; _unit_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      garage_cadence_type: "recurring" | "no_interval"
      garage_service_status: "performed" | "not_needed_yet" | "declined"
      garage_service_type: "replacement" | "clean_lube" | "adjustment" | "check"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      garage_cadence_type: ["recurring", "no_interval"],
      garage_service_status: ["performed", "not_needed_yet", "declined"],
      garage_service_type: ["replacement", "clean_lube", "adjustment", "check"],
    },
  },
} as const
