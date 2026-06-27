import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/** List all voice profiles owned by the current user. */
export const listVoiceProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("voice_profiles" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<Record<string, unknown>>;
  });

/** Fetch one voice profile by id (RLS scoped). */
export const getVoiceProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("voice_profiles" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Voice profile not found");
    return row as Record<string, unknown>;
  });

/** Create a new voice profile in draft state. */
export const createVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreatePayload) => {
    if (!input.name?.trim()) throw new Error("Name is required");
    if (!["clone", "design", "instant"].includes(input.mode)) throw new Error("Invalid mode");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("voice_profiles" as never)
      .insert({
        user_id: userId,
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
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Record<string, unknown>;
  });

/** Update mutable fields on a voice profile. */
export const updateVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Partial<CreatePayload> & { status?: string } }) => input)
  .handler(async ({ data, context }) => {
    const { id, patch } = data;
    const { data: row, error } = await context.supabase
      .from("voice_profiles" as never)
      .update(patch as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Record<string, unknown>;
  });

/** Delete a voice profile (and cascade embeddings/jobs/logs by FK). */
export const deleteVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("voice_profiles" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Get current user's quota row (creates + rolls period as needed). */
export const getVoiceQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("ensure_voice_quota", {
      _user_id: context.userId,
    } as never);
    if (error) throw new Error(error.message);
    return data as Record<string, unknown>;
  });
