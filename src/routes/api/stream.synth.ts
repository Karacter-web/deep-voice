import { createFileRoute } from "@tanstack/react-router";
import { smartChunk } from "@/lib/smart-chunker";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * SSE streaming TTS endpoint.
 *
 * POST /api/stream/synth { profileId, text, voice?, language? }
 * Streams events:
 *   event: chunk   data: { index, total, audioBase64, mime }
 *   event: done    data: { totalChars }
 *   event: error   data: { message }
 *
 * Auth: requires a Supabase user bearer token (Authorization: Bearer <jwt>).
 * Quota: enforced via consume_voice_quota RPC before each chunk.
 * Without HF_XTTS_SPACE_URL configured, emits silence stubs so the client
 * can still exercise the gapless playback path.
 */
export const Route = createFileRoute("/api/stream/synth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const sb = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claim, error: claimErr } = await sb.auth.getClaims(token);
        if (claimErr || !claim?.claims?.sub) return new Response("Unauthorized", { status: 401 });
        const userId = claim.claims.sub as string;

        let body: { profileId?: string; text?: string; language?: string; voice?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const text = (body.text ?? "").trim();
        if (!text) return new Response("text required", { status: 400 });
        if (text.length > 5000) return new Response("text too long", { status: 413 });

        const chunks = smartChunk(text, 220);
        const total = chunks.length;
        const xtts = process.env.HF_XTTS_SPACE_URL;
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          async start(controller) {
            const send = (event: string, data: unknown) =>
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

            try {
              for (const ch of chunks) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: ok, error } = await (sb as any).rpc("consume_voice_quota", {
                  _user_id: userId,
                  _chars: ch.text.length,
                  _seconds: 0,
                });
                if (error) { send("error", { message: error.message }); break; }
                if (!ok) { send("error", { message: "Monthly character quota exceeded" }); break; }

                let audioBase64 = "";
                let mime = "audio/wav";
                if (xtts) {
                  const res = await fetch(`${xtts.replace(/\/$/, "")}/synthesize`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      profile_id: body.profileId, text: ch.text, language: body.language ?? "en", voice: body.voice,
                    }),
                  });
                  if (!res.ok) { send("error", { message: `synth ${res.status}` }); break; }
                  mime = res.headers.get("content-type") ?? mime;
                  const buf = new Uint8Array(await res.arrayBuffer());
                  let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
                  audioBase64 = btoa(bin);
                } else {
                  // 200ms silence WAV stub so the client wiring is testable.
                  audioBase64 = SILENCE_WAV_BASE64;
                }
                send("chunk", { index: ch.index, total, audioBase64, mime, text: ch.text });

                await sb.from("voice_usage_logs" as never).insert({
                  user_id: userId,
                  profile_id: body.profileId ?? null,
                  action: "synth",
                  characters: ch.text.length,
                } as never);
              }
              send("done", { totalChars: text.length });
            } catch (e) {
              send("error", { message: e instanceof Error ? e.message : String(e) });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
          },
        });
      },
    },
  },
});

// 200ms of silence at 16kHz mono — fixed harmless WAV stub.
const SILENCE_WAV_BASE64 =
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";
