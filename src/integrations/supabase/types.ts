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
      call_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          metadata: Json
          provider: Database["public"]["Enums"]["call_provider"]
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
          user_id: string
          voice_model_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json
          provider?: Database["public"]["Enums"]["call_provider"]
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          user_id: string
          voice_model_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json
          provider?: Database["public"]["Enums"]["call_provider"]
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          user_id?: string
          voice_model_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_voice_model_id_fkey"
            columns: ["voice_model_id"]
            isOneToOne: false
            referencedRelation: "voice_models"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      user_roles: {
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
      user_settings: {
        Row: {
          created_at: string
          default_voice_model_id: string | null
          preferences: Json
          stt_model: string
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_voice_model_id?: string | null
          preferences?: Json
          stt_model?: string
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_voice_model_id?: string | null
          preferences?: Json
          stt_model?: string
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_default_voice_model_id_fkey"
            columns: ["default_voice_model_id"]
            isOneToOne: false
            referencedRelation: "voice_models"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_models: {
        Row: {
          character_preset: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          provider: string
          sample_count: number
          settings: Json
          source_language: string
          status: Database["public"]["Enums"]["voice_model_status"]
          target_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_preset?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          provider?: string
          sample_count?: number
          settings?: Json
          source_language?: string
          status?: Database["public"]["Enums"]["voice_model_status"]
          target_language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_preset?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          provider?: string
          sample_count?: number
          settings?: Json
          source_language?: string
          status?: Database["public"]["Enums"]["voice_model_status"]
          target_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_samples: {
        Row: {
          created_at: string
          duration_seconds: number | null
          filename: string | null
          id: string
          mime_type: string | null
          sample_rate: number | null
          size_bytes: number | null
          storage_path: string
          transcript: string | null
          user_id: string
          voice_model_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          sample_rate?: number | null
          size_bytes?: number | null
          storage_path: string
          transcript?: string | null
          user_id: string
          voice_model_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          sample_rate?: number | null
          size_bytes?: number | null
          storage_path?: string
          transcript?: string | null
          user_id?: string
          voice_model_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_samples_voice_model_id_fkey"
            columns: ["voice_model_id"]
            isOneToOne: false
            referencedRelation: "voice_models"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      call_provider: "web" | "telegram" | "whatsapp" | "discord" | "other"
      call_status: "active" | "ended" | "failed"
      voice_model_status: "draft" | "training" | "ready" | "failed"
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
      app_role: ["admin", "moderator", "user"],
      call_provider: ["web", "telegram", "whatsapp", "discord", "other"],
      call_status: ["active", "ended", "failed"],
      voice_model_status: ["draft", "training", "ready", "failed"],
    },
  },
} as const
