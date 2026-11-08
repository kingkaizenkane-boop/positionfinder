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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      analysis_sessions: {
        Row: {
          created_at: string
          current_p1: number
          current_p10: number
          current_p2: number
          current_p3: number
          current_p4: number
          current_p5: number
          current_p6: number
          current_p7: number
          current_p8: number
          current_p9: number
          game_id: string | null
          game_name: string
          id: string
          minimum_occurrences: number
          played_date: string
          provider: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          current_p1: number
          current_p10: number
          current_p2: number
          current_p3: number
          current_p4: number
          current_p5: number
          current_p6: number
          current_p7: number
          current_p8: number
          current_p9: number
          game_id?: string | null
          game_name: string
          id?: string
          minimum_occurrences?: number
          played_date: string
          provider: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          current_p1?: number
          current_p10?: number
          current_p2?: number
          current_p3?: number
          current_p4?: number
          current_p5?: number
          current_p6?: number
          current_p7?: number
          current_p8?: number
          current_p9?: number
          game_id?: string | null
          game_name?: string
          id?: string
          minimum_occurrences?: number
          played_date?: string
          provider?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          game_name: string
          id: string
          provider: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          game_name: string
          id?: string
          provider: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          game_name?: string
          id?: string
          provider?: string
          user_id?: string | null
        }
        Relationships: []
      }
      historical_draws: {
        Row: {
          created_at: string
          draw_date: string
          draw_number: number
          game_id: string
          id: string
          p1: number
          p10: number
          p2: number
          p3: number
          p4: number
          p5: number
          p6: number
          p7: number
          p8: number
          p9: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          draw_date: string
          draw_number: number
          game_id: string
          id?: string
          p1: number
          p10: number
          p2: number
          p3: number
          p4: number
          p5: number
          p6: number
          p7: number
          p8: number
          p9: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          draw_date?: string
          draw_number?: number
          game_id?: string
          id?: string
          p1?: number
          p10?: number
          p2?: number
          p3?: number
          p4?: number
          p5?: number
          p6?: number
          p7?: number
          p8?: number
          p9?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historical_draws_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          draws_detected: number
          draws_imported: number
          draws_rejected: number
          duplicates_skipped: number
          games_detected: number
          id: string
          provider: string
          raw_text: string
          source_name: string | null
          source_year: number | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          draws_detected?: number
          draws_imported?: number
          draws_rejected?: number
          duplicates_skipped?: number
          games_detected?: number
          id?: string
          provider: string
          raw_text: string
          source_name?: string | null
          source_year?: number | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          draws_detected?: number
          draws_imported?: number
          draws_rejected?: number
          duplicates_skipped?: number
          games_detected?: number
          id?: string
          provider?: string
          raw_text?: string
          source_name?: string | null
          source_year?: number | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      transitions: {
        Row: {
          analysis_session_id: string
          created_at: string
          historical_draw_id: string
          id: string
          next_draw_id: string
          source_number: number
          source_position: number
          target_number: number
          target_position: number
          user_id: string | null
        }
        Insert: {
          analysis_session_id: string
          created_at?: string
          historical_draw_id: string
          id?: string
          next_draw_id: string
          source_number: number
          source_position: number
          target_number: number
          target_position: number
          user_id?: string | null
        }
        Update: {
          analysis_session_id?: string
          created_at?: string
          historical_draw_id?: string
          id?: string
          next_draw_id?: string
          source_number?: number
          source_position?: number
          target_number?: number
          target_position?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transitions_analysis_session_id_fkey"
            columns: ["analysis_session_id"]
            isOneToOne: false
            referencedRelation: "analysis_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transitions_historical_draw_id_fkey"
            columns: ["historical_draw_id"]
            isOneToOne: false
            referencedRelation: "historical_draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transitions_next_draw_id_fkey"
            columns: ["next_draw_id"]
            isOneToOne: false
            referencedRelation: "historical_draws"
            referencedColumns: ["id"]
          },
        ]
      }
      zsa_analysis_runs: {
        Row: {
          created_at: string
          dataset_snapshot: Json
          dataset_version: string
          engine_version: string
          filters: Json
          id: string
          name: string
          result_summary: Json
          threshold_settings: Json
        }
        Insert: {
          created_at?: string
          dataset_snapshot: Json
          dataset_version: string
          engine_version?: string
          filters?: Json
          id?: string
          name: string
          result_summary?: Json
          threshold_settings?: Json
        }
        Update: {
          created_at?: string
          dataset_snapshot?: Json
          dataset_version?: string
          engine_version?: string
          filters?: Json
          id?: string
          name?: string
          result_summary?: Json
          threshold_settings?: Json
        }
        Relationships: []
      }
      zsa_groups: {
        Row: {
          completeness_status: string
          created_at: string
          draw_date: string | null
          game_id: string | null
          game_name: string
          group_sequence: number
          grouping_confirmed: boolean
          id: string
          import_batch_id: string | null
          line1_occurrence_id: string | null
          line2_occurrence_id: string | null
          line3_occurrence_id: string | null
          provider: string
        }
        Insert: {
          completeness_status?: string
          created_at?: string
          draw_date?: string | null
          game_id?: string | null
          game_name: string
          group_sequence: number
          grouping_confirmed?: boolean
          id?: string
          import_batch_id?: string | null
          line1_occurrence_id?: string | null
          line2_occurrence_id?: string | null
          line3_occurrence_id?: string | null
          provider: string
        }
        Update: {
          completeness_status?: string
          created_at?: string
          draw_date?: string | null
          game_id?: string | null
          game_name?: string
          group_sequence?: number
          grouping_confirmed?: boolean
          id?: string
          import_batch_id?: string | null
          line1_occurrence_id?: string | null
          line2_occurrence_id?: string | null
          line3_occurrence_id?: string | null
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "zsa_groups_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zsa_groups_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zsa_groups_line1_occurrence_id_fkey"
            columns: ["line1_occurrence_id"]
            isOneToOne: false
            referencedRelation: "zsa_source_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zsa_groups_line2_occurrence_id_fkey"
            columns: ["line2_occurrence_id"]
            isOneToOne: false
            referencedRelation: "zsa_source_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zsa_groups_line3_occurrence_id_fkey"
            columns: ["line3_occurrence_id"]
            isOneToOne: false
            referencedRelation: "zsa_source_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      zsa_source_occurrences: {
        Row: {
          created_at: string
          draw_date: string | null
          draw_number: number | null
          game_id: string | null
          game_name: string
          id: string
          import_batch_id: string | null
          issues: Json
          line_role: number | null
          position_values: number[] | null
          provider: string
          record_status: string
          source_line_end: number
          source_line_start: number
          source_order: number
          source_text: string
        }
        Insert: {
          created_at?: string
          draw_date?: string | null
          draw_number?: number | null
          game_id?: string | null
          game_name: string
          id?: string
          import_batch_id?: string | null
          issues?: Json
          line_role?: number | null
          position_values?: number[] | null
          provider: string
          record_status?: string
          source_line_end: number
          source_line_start: number
          source_order: number
          source_text: string
        }
        Update: {
          created_at?: string
          draw_date?: string | null
          draw_number?: number | null
          game_id?: string | null
          game_name?: string
          id?: string
          import_batch_id?: string | null
          issues?: Json
          line_role?: number | null
          position_values?: number[] | null
          provider?: string
          record_status?: string
          source_line_end?: number
          source_line_start?: number
          source_order?: number
          source_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "zsa_source_occurrences_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zsa_source_occurrences_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      zsa_validation_cases: {
        Row: {
          analysis_run_id: string | null
          analysis_snapshot: Json
          case_name: string
          created_at: string
          game_id: string | null
          game_name: string
          id: string
          line2_occurrence_id: string | null
          line2_values: number[]
          line3_occurrence_id: string | null
          line3_values: number[] | null
          provider: string
          result_date: string | null
          validation_status: string
          winning_numbers: number[]
          winning_positions: number[] | null
        }
        Insert: {
          analysis_run_id?: string | null
          analysis_snapshot: Json
          case_name: string
          created_at?: string
          game_id?: string | null
          game_name: string
          id?: string
          line2_occurrence_id?: string | null
          line2_values: number[]
          line3_occurrence_id?: string | null
          line3_values?: number[] | null
          provider: string
          result_date?: string | null
          validation_status?: string
          winning_numbers: number[]
          winning_positions?: number[] | null
        }
        Update: {
          analysis_run_id?: string | null
          analysis_snapshot?: Json
          case_name?: string
          created_at?: string
          game_id?: string | null
          game_name?: string
          id?: string
          line2_occurrence_id?: string | null
          line2_values?: number[]
          line3_occurrence_id?: string | null
          line3_values?: number[] | null
          provider?: string
          result_date?: string | null
          validation_status?: string
          winning_numbers?: number[]
          winning_positions?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "zsa_validation_cases_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "zsa_analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zsa_validation_cases_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zsa_validation_cases_line2_occurrence_id_fkey"
            columns: ["line2_occurrence_id"]
            isOneToOne: false
            referencedRelation: "zsa_source_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zsa_validation_cases_line3_occurrence_id_fkey"
            columns: ["line3_occurrence_id"]
            isOneToOne: false
            referencedRelation: "zsa_source_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      zsa_winning_result_revisions: {
        Row: {
          confirmed_result_id: string
          created_at: string
          group_id: string
          id: string
          proposed_winning_numbers: number[]
          proposed_winning_positions: number[] | null
          review_status: string
          source_text: string
        }
        Insert: {
          confirmed_result_id: string
          created_at?: string
          group_id: string
          id?: string
          proposed_winning_numbers: number[]
          proposed_winning_positions?: number[] | null
          review_status?: string
          source_text: string
        }
        Update: {
          confirmed_result_id?: string
          created_at?: string
          group_id?: string
          id?: string
          proposed_winning_numbers?: number[]
          proposed_winning_positions?: number[] | null
          review_status?: string
          source_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "zsa_winning_result_revisions_confirmed_result_id_fkey"
            columns: ["confirmed_result_id"]
            isOneToOne: false
            referencedRelation: "zsa_winning_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zsa_winning_result_revisions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "zsa_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      zsa_winning_results: {
        Row: {
          confirmation_status: string
          confirmed_at: string | null
          created_at: string
          group_id: string
          id: string
          result_date: string | null
          source_text: string | null
          source_type: string
          winning_numbers: number[]
          winning_positions: number[] | null
        }
        Insert: {
          confirmation_status?: string
          confirmed_at?: string | null
          created_at?: string
          group_id: string
          id?: string
          result_date?: string | null
          source_text?: string | null
          source_type?: string
          winning_numbers: number[]
          winning_positions?: number[] | null
        }
        Update: {
          confirmation_status?: string
          confirmed_at?: string | null
          created_at?: string
          group_id?: string
          id?: string
          result_date?: string | null
          source_text?: string | null
          source_type?: string
          winning_numbers?: number[]
          winning_positions?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "zsa_winning_results_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "zsa_groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_zsa_source_import: {
        Args: {
          p_batch_id: string
          p_groups: Json
          p_occurrences: Json
          p_provider: string
          p_raw_text: string
          p_source_name: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
