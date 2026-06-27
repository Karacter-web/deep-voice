// Local JSON type without `| undefined` (supabase's Json includes it,
// which TanStack's serializable validator rejects).
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface VoiceProfile {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  mode: "clone" | "design" | "instant";
  status: "draft" | "processing" | "ready" | "failed" | "archived";
  language: string;
  gender: string | null;
  age: string | null;
  style: string | null;
  params: Record<string, unknown>;
  artifacts: Record<string, unknown>;
  preview_path: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface VoiceJob {
  id: string;
  user_id: string;
  profile_id: string | null;
  kind: "clone_train" | "design_synth" | "instant_generate" | "enhance" | "diarize" | "preview";
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string | null;
  progress: number;
  attempts: number;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceQuota {
  user_id: string;
  tier: string;
  monthly_chars: number;
  monthly_seconds: number;
  used_chars: number;
  used_seconds: number;
  period_started_at: string;
  updated_at: string;
}
