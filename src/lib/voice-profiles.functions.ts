import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VoiceProfile, VoiceQuota } from "./voice-types";

type Mode = "clone" | "design" | "instant";

interface CreatePayload {
  name: string;
  description?: string;
  mode: Mode;
  language?: string;
  gender?: string;
  age?: string;
  style?: string;
  params?: Record<string, unknown>;
  is_public?: boolean;
}

// The generated Database type doesn't yet know about the Voice Studio
// tables (added via docs/voice-studio-schema.sql). Cast through unknown
// so RLS still applies but we get clean DTOs out.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = (c: unknown) => c as any;

export const listVoiceProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VoiceProfile[]> => {
    const { data, error } = await sbAny(context.supabase)
      .from("voice_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as VoiceProfile[];
  });

export const getVoiceProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<VoiceProfile> => {
    const { data: row, error } = await sbAny(context.supabase)
      .from("voice_profiles").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Voice profile not found");
    return row as VoiceProfile;
  });

export const createVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreatePayload) => {
    if (!input.name?.trim()) throw new Error("Name is required");
    if (!["clone", "design", "instant"].includes(input.mode)) throw new Error("Invalid mode");
    return input;
  })
  .handler(async ({ data, context }): Promise<VoiceProfile> => {
    const { data: row, error } = await sbAny(context.supabase)
      .from("voice_profiles")
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        description: data.description ?? null,
        mode: data.mode,
        language: data.language ?? "en",
        gender: data.gender ?? null,
        age: data.age ?? null,
        style: data.style ?? null,
        params: data.params ?? {},
        is_public: !!data.is_public,
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as VoiceProfile;
  });

export const updateVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Partial<CreatePayload> & { status?: string } }) => input)
  .handler(async ({ data, context }): Promise<VoiceProfile> => {
    const { data: row, error } = await sbAny(context.supabase)
      .from("voice_profiles").update(data.patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return row as VoiceProfile;
  });

export const deleteVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await sbAny(context.supabase)
      .from("voice_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getVoiceQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VoiceQuota> => {
    const { data, error } = await sbAny(context.supabase).rpc("ensure_voice_quota", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return data as VoiceQuota;
  });
