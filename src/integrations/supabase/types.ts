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
      voice_embeddings: {
        Row: {
          created_at: string
          embedding: string | null
          id: string
          kind: string
          meta: Json
          profile_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          id?: string
          kind?: string
          meta?: Json
          profile_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          id?: string
          kind?: string
          meta?: Json
          profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_embeddings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_jobs: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          kind: Database["public"]["Enums"]["voice_job_kind"]
          profile_id: string | null
          progress: number
          result: Json
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["voice_job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind: Database["public"]["Enums"]["voice_job_kind"]
          profile_id?: string | null
          progress?: number
          result?: Json
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["voice_job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind?: Database["public"]["Enums"]["voice_job_kind"]
          profile_id?: string | null
          progress?: number
          result?: Json
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["voice_job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_jobs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
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
      voice_profiles: {
        Row: {
          age: string | null
          artifacts: Json
          created_at: string
          description: string | null
          gender: string | null
          id: string
          is_public: boolean
          language: string
          mode: Database["public"]["Enums"]["voice_profile_mode"]
          name: string
          params: Json
          preview_path: string | null
          status: Database["public"]["Enums"]["voice_profile_status"]
          style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: string | null
          artifacts?: Json
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          is_public?: boolean
          language?: string
          mode?: Database["public"]["Enums"]["voice_profile_mode"]
          name: string
          params?: Json
          preview_path?: string | null
          status?: Database["public"]["Enums"]["voice_profile_status"]
          style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: string | null
          artifacts?: Json
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          is_public?: boolean
          language?: string
          mode?: Database["public"]["Enums"]["voice_profile_mode"]
          name?: string
          params?: Json
          preview_path?: string | null
          status?: Database["public"]["Enums"]["voice_profile_status"]
          style?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_quotas: {
        Row: {
          monthly_chars: number
          monthly_seconds: number
          period_started_at: string
          tier: string
          updated_at: string
          used_chars: number
          used_seconds: number
          user_id: string
        }
        Insert: {
          monthly_chars?: number
          monthly_seconds?: number
          period_started_at?: string
          tier?: string
          updated_at?: string
          used_chars?: number
          used_seconds?: number
          user_id: string
        }
        Update: {
          monthly_chars?: number
          monthly_seconds?: number
          period_started_at?: string
          tier?: string
          updated_at?: string
          used_chars?: number
          used_seconds?: number
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
      voice_usage_logs: {
        Row: {
          action: string
          characters: number
          cost_units: number
          created_at: string
          id: string
          job_id: string | null
          meta: Json
          profile_id: string | null
          seconds: number
          user_id: string
        }
        Insert: {
          action: string
          characters?: number
          cost_units?: number
          created_at?: string
          id?: string
          job_id?: string | null
          meta?: Json
          profile_id?: string | null
          seconds?: number
          user_id: string
        }
        Update: {
          action?: string
          characters?: number
          cost_units?: number
          created_at?: string
          id?: string
          job_id?: string | null
          meta?: Json
          profile_id?: string | null
          seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_usage_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "voice_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_usage_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_voice_quota: {
        Args: { _chars?: number; _seconds?: number; _user_id: string }
        Returns: boolean
      }
      ensure_voice_quota: {
        Args: { _user_id: string }
        Returns: {
          monthly_chars: number
          monthly_seconds: number
          period_started_at: string
          tier: string
          updated_at: string
          used_chars: number
          used_seconds: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "voice_quotas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      voice_job_kind:
        | "clone_train"
        | "design_synth"
        | "instant_generate"
        | "enhance"
        | "diarize"
        | "preview"
      voice_job_status:
        | "queued"
        | "running"
        | "succeeded"
        | "failed"
        | "cancelled"
      voice_model_status: "draft" | "training" | "ready" | "failed"
      voice_profile_mode: "clone" | "design" | "instant"
      voice_profile_status:
        | "draft"
        | "processing"
        | "ready"
        | "failed"
        | "archived"
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
      voice_job_kind: [
        "clone_train",
        "design_synth",
        "instant_generate",
        "enhance",
        "diarize",
        "preview",
      ],
      voice_job_status: [
        "queued",
        "running",
        "succeeded",
        "failed",
        "cancelled",
      ],
      voice_model_status: ["draft", "training", "ready", "failed"],
      voice_profile_mode: ["clone", "design", "instant"],
      voice_profile_status: [
        "draft",
        "processing",
        "ready",
        "failed",
        "archived",
      ],
    },
  },
} as const
