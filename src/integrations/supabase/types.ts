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
    PostgrestVersion: "14.5"
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
        }
        Insert: {
          created_at?: string
          game_name: string
          id?: string
          provider: string
        }
        Update: {
          created_at?: string
          game_name?: string
          id?: string
          provider?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
