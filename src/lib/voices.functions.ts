import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Kick off training for a voice model. Forwards sample storage paths to the
 * self-hosted RVC trainer at RVC_ENDPOINT. When the endpoint is not configured
 * we mark the model "training" and return — useful for local development.
 */
export const dispatchTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { voiceModelId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: model, error: modelErr } = await supabase
      .from("voice_models")
      .select("id, name, source_language, target_language, character_preset, status")
      .eq("id", data.voiceModelId)
      .eq("user_id", userId)
      .maybeSingle();
    if (modelErr) throw new Error(modelErr.message);
    if (!model) throw new Error("Voice model not found");

    const { data: samples, error: sampleErr } = await supabase
      .from("voice_samples")
      .select("id, storage_path, duration_seconds")
      .eq("voice_model_id", data.voiceModelId)
      .eq("user_id", userId);
    if (sampleErr) throw new Error(sampleErr.message);
    if (!samples?.length) throw new Error("Add at least one voice sample before training.");

    await supabase
      .from("voice_models")
      .update({ status: "training" })
      .eq("id", data.voiceModelId)
      .eq("user_id", userId);

    const endpoint = process.env.RVC_ENDPOINT;
    if (!endpoint) {
      return {
        ok: true as const,
        dispatched: false as const,
        message:
          "Training queued locally. Configure RVC_ENDPOINT to dispatch to your trainer.",
      };
    }

    try {
      const res = await fetch(`${endpoint.replace(/\/$/, "")}/train`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model_id: model.id,
          user_id: userId,
          name: model.name,
          source_language: model.source_language,
          target_language: model.target_language,
          character_preset: model.character_preset,
          samples: samples.map((s) => ({ id: s.id, path: s.storage_path, duration: s.duration_seconds })),
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Trainer responded ${res.status}: ${txt.slice(0, 200)}`);
      }
      return { ok: true as const, dispatched: true as const, message: "Training started." };
    } catch (e) {
      await supabase
        .from("voice_models")
        .update({ status: "failed" })
        .eq("id", data.voiceModelId)
        .eq("user_id", userId);
      throw e instanceof Error ? e : new Error(String(e));
    }
  });

/**
 * Synthesize a short phrase with a trained voice. Returns a base64 wav clip
 * the browser can play. Falls back to an explanatory error if no synth endpoint.
 */
export const synthesizePhrase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { voiceModelId: string; text: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const text = data.text.trim();
    if (!text) throw new Error("Text is required");
    if (text.length > 500) throw new Error("Keep test phrases under 500 chars");

    const { data: model, error } = await supabase
      .from("voice_models")
      .select("id, status, provider, settings")
      .eq("id", data.voiceModelId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!model) throw new Error("Voice model not found");
    if (model.status !== "ready") throw new Error("Voice is not ready yet. Train it first.");

    const endpoint = process.env.RVC_ENDPOINT;
    if (!endpoint) {
      throw new Error(
        "No RVC_ENDPOINT configured. Add one in project secrets to enable test synthesis.",
      );
    }

    const res = await fetch(`${endpoint.replace(/\/$/, "")}/synthesize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model_id: model.id, user_id: userId, text }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Synth responded ${res.status}: ${txt.slice(0, 200)}`);
    }
    const buf = await res.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return { audioBase64: b64, mimeType: res.headers.get("content-type") ?? "audio/wav" };
  });
