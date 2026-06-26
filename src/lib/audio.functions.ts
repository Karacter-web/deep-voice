import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "@/lib/rate-limit";
import { signWatermark, watermarkWav } from "@/lib/watermark";

/**
 * Transcribe a short audio chunk via the self-hosted whisper.cpp server.
 * Accepts base64 (so it round-trips cleanly through createServerFn RPC).
 */
export const transcribeChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { audioBase64: string; mimeType?: string; model?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    enforceRateLimit({
      key: `transcribeChunk:${context.userId}`,
      limit: 60,
      windowMs: 60_000,
    });
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
    enforceRateLimit({
      key: `convertVoice:${userId}`,
      limit: 120,
      windowMs: 60_000,
    });

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
    let buf = await res.arrayBuffer();
    const mimeType = res.headers.get("content-type") ?? "audio/wav";

    // Watermark WAV output with a signed provenance token.
    const secret = process.env.BRIDGE_HMAC_SECRET;
    let watermark: string | null = null;
    if (secret && mimeType.includes("wav")) {
      watermark = signWatermark(
        {
          userId,
          voiceModelId: model.id,
          sessionId: data.sessionId,
          issuedAt: Date.now(),
        },
        secret,
      );
      buf = watermarkWav(buf, watermark);
    }

    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return { audioBase64: b64, mimeType, watermark };
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

/**
 * Transcribe a stored voice sample via Whisper and persist the text on the row.
 * Uses a signed URL so the whisper server can fetch the sample directly when
 * it supports URL inputs; otherwise we download then forward as multipart.
 */
export const transcribeSample = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sampleId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sample, error } = await supabase
      .from("voice_samples")
      .select("id, storage_path, mime_type")
      .eq("id", data.sampleId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sample) throw new Error("Sample not found");

    const endpoint = process.env.WHISPER_ENDPOINT;
    if (!endpoint) {
      throw new Error("No WHISPER_ENDPOINT configured. Add one in project secrets.");
    }

    const dl = await supabase.storage.from("voice-samples").download(sample.storage_path);
    if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "Sample missing in storage");
    const blob = dl.data;

    const form = new FormData();
    form.append("file", new Blob([await blob.arrayBuffer()], { type: sample.mime_type ?? "audio/webm" }), "sample.webm");
    const res = await fetch(`${endpoint.replace(/\/$/, "")}/inference`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Whisper responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { text?: string };
    const text = (json.text ?? "").trim();

    await supabase.from("voice_samples").update({ transcript: text }).eq("id", sample.id);
    return { text };
  });
