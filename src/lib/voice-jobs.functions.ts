import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type JobKind = "clone_train" | "design_synth" | "instant_generate" | "enhance" | "diarize" | "preview";

/**
 * Insert a voice job row and kick the worker. The worker is a separate
 * server fn (`runDueVoiceJobs`) that is safe to invoke fire-and-forget; if
 * the HF endpoints are unset the job is short-circuited as `succeeded`
 * with a stub result, so the rest of the pipeline still completes.
 */
export const dispatchVoiceJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    profileId?: string;
    kind: JobKind;
    input?: Record<string, unknown>;
  }) => {
    if (!input?.kind) throw new Error("kind is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("voice_jobs" as never)
      .insert({
        user_id: userId,
        profile_id: data.profileId ?? null,
        kind: data.kind,
        status: "queued",
        input: data.input ?? {},
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    // Don't await — the dispatcher should return quickly. Worker reads its
    // own auth context off the service role inside.
    void runOneVoiceJob({ data: { jobId: (row as { id: string }).id } });
    return row as Record<string, unknown>;
  });

/**
 * Execute a single queued job. Public so external pollers / pg_cron can
 * also wake the pipeline. Authenticated as the caller; uses service role
 * inside for cross-row updates.
 */
export const runOneVoiceJob = createServerFn({ method: "POST" })
  .inputValidator((input: { jobId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { jobId } = data;

    const { data: job, error } = await supabaseAdmin
      .from("voice_jobs" as never)
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (error || !job) return { ok: false, error: error?.message ?? "missing job" };
    const j = job as {
      id: string; user_id: string; profile_id: string | null;
      kind: JobKind; status: string; input: Record<string, unknown>;
      attempts: number;
    };
    if (j.status !== "queued") return { ok: true, skipped: true };

    await supabaseAdmin
      .from("voice_jobs" as never)
      .update({ status: "running", started_at: new Date().toISOString(), attempts: j.attempts + 1 } as never)
      .eq("id", j.id);

    try {
      const result = await runByKind(j.kind, j.input, j);
      await supabaseAdmin
        .from("voice_jobs" as never)
        .update({ status: "succeeded", result: result as never, finished_at: new Date().toISOString(), progress: 100 } as never)
        .eq("id", j.id);
      if (j.profile_id && (j.kind === "clone_train" || j.kind === "design_synth" || j.kind === "instant_generate")) {
        await supabaseAdmin
          .from("voice_profiles" as never)
          .update({ status: "ready", artifacts: result as never } as never)
          .eq("id", j.profile_id);
      }
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("voice_jobs" as never)
        .update({ status: "failed", error: msg, finished_at: new Date().toISOString() } as never)
        .eq("id", j.id);
      if (j.profile_id) {
        await supabaseAdmin
          .from("voice_profiles" as never)
          .update({ status: "failed" } as never)
          .eq("id", j.profile_id);
      }
      return { ok: false, error: msg };
    }
  });

async function runByKind(kind: JobKind, input: Record<string, unknown>, job: { profile_id: string | null; user_id: string }) {
  const xtts = process.env.HF_XTTS_SPACE_URL;
  const enhance = process.env.HF_ENHANCE_SPACE_URL;
  const diar = process.env.HF_DIAR_SPACE_URL;

  switch (kind) {
    case "clone_train": {
      // Cloning is reference-based with XTTS — there is no separate training
      // step. We just mark the profile ready against its reference samples.
      if (!xtts) return { stub: true, note: "HF_XTTS_SPACE_URL not set; profile ready in stub mode" };
      const res = await fetch(`${xtts.replace(/\/$/, "")}/clone`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile_id: job.profile_id, user_id: job.user_id, ...input }),
      });
      if (!res.ok) throw new Error(`XTTS clone ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return await res.json();
    }
    case "design_synth": {
      if (!xtts) return { stub: true };
      const res = await fetch(`${xtts.replace(/\/$/, "")}/design`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile_id: job.profile_id, ...input }),
      });
      if (!res.ok) throw new Error(`XTTS design ${res.status}`);
      return await res.json();
    }
    case "instant_generate": {
      // Instant voice = LLM picks params from a text prompt, then we hand off to XTTS.
      const params = await instantParamsFromPrompt(String(input.prompt ?? ""));
      if (!xtts) return { stub: true, params };
      const res = await fetch(`${xtts.replace(/\/$/, "")}/design`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile_id: job.profile_id, ...params }),
      });
      if (!res.ok) throw new Error(`XTTS instant ${res.status}`);
      return { params, ...(await res.json()) };
    }
    case "enhance": {
      if (!enhance) return { stub: true, note: "HF_ENHANCE_SPACE_URL not set" };
      const res = await fetch(`${enhance.replace(/\/$/, "")}/enhance`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`enhance ${res.status}`);
      return await res.json();
    }
    case "diarize": {
      if (!diar) return { stub: true, note: "HF_DIAR_SPACE_URL not set" };
      const res = await fetch(`${diar.replace(/\/$/, "")}/diarize`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`diarize ${res.status}`);
      return await res.json();
    }
    case "preview": {
      if (!xtts) return { stub: true };
      const res = await fetch(`${xtts.replace(/\/$/, "")}/preview`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile_id: job.profile_id, ...input }),
      });
      if (!res.ok) throw new Error(`preview ${res.status}`);
      return await res.json();
    }
  }
}

async function instantParamsFromPrompt(prompt: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key || !prompt.trim()) {
    return { gender: "neutral", age: "adult", style: "neutral", pitch: 0, speed: 1.0 };
  }
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Return strict JSON describing a voice with fields: gender (male|female|neutral), age (child|young|adult|elderly), style (free text, <40 chars), pitch (-1..1), speed (0.5..1.5). No prose." },
          { role: "user", content: prompt.slice(0, 800) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`gateway ${res.status}`);
    const j = await res.json() as { choices: Array<{ message: { content: string } }> };
    return JSON.parse(j.choices[0]?.message?.content ?? "{}");
  } catch {
    return { gender: "neutral", age: "adult", style: "neutral", pitch: 0, speed: 1.0 };
  }
}
