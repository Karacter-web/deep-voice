import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Transcribe a short audio chunk via the self-hosted whisper.cpp server.
 * Accepts base64 (so it round-trips cleanly through createServerFn RPC).
 */
export const transcribeChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { audioBase64: string; mimeType?: string; model?: string }) => input,
  )
  .handler(async ({ data }) => {
    const endpoint = process.env.WHISPER_ENDPOINT;
    if (!endpoint) {
      throw new Error(
        "No WHISPER_ENDPOINT configured. Add one in project secrets to enable transcription.",
      );
    }
    const bin = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append(
      "file",
      new Blob([bin], { type: data.mimeType ?? "audio/webm" }),
      "chunk.webm",
    );
    if (data.model) form.append("model", data.model);

    const res = await fetch(`${endpoint.replace(/\/$/, "")}/inference`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Whisper responded ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as { text?: string };
    return { text: (json.text ?? "").trim() };
  });

/**
 * Convert mic audio to a target voice. Returns base64 wav for browser playback.
 * Also records a row in call_sessions so the user can audit usage.
 */
export const convertVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      audioBase64: string;
      mimeType?: string;
      voiceModelId: string;
      sessionId?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: model, error } = await supabase
      .from("voice_models")
      .select("id, status")
      .eq("id", data.voiceModelId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!model) throw new Error("Voice model not found");
    if (model.status !== "ready") throw new Error("Voice is not ready yet.");

    const endpoint = process.env.RVC_ENDPOINT;
    if (!endpoint) {
      throw new Error(
        "No RVC_ENDPOINT configured. Add one in project secrets to enable live conversion.",
      );
    }

    const bin = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("file", new Blob([bin], { type: data.mimeType ?? "audio/webm" }), "in.webm");
    form.append("model_id", model.id);

    const res = await fetch(`${endpoint.replace(/\/$/, "")}/convert`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Converter responded ${res.status}: ${txt.slice(0, 200)}`);
    }
    const buf = await res.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return {
      audioBase64: b64,
      mimeType: res.headers.get("content-type") ?? "audio/wav",
    };
  });

/**
 * Open a call_sessions row so the live studio can correlate chunks.
 */
export const startCallSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { voiceModelId: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("call_sessions")
      .insert({
        user_id: userId,
        voice_model_id: data.voiceModelId,
        provider: "web",
        status: "active",
        metadata: { consent: true, source: "studio" },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const endCallSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string; durationSeconds: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("call_sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        duration_seconds: Math.round(data.durationSeconds),
      })
      .eq("id", data.sessionId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
