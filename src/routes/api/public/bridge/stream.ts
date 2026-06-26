// Public ingress for the desktop call bridge (see /bridge).
//
// Authenticates the caller with HMAC-SHA256 over the raw body using
// BRIDGE_HMAC_SECRET. The bridge sends:
//   POST /api/public/bridge/stream
//   X-Bridge-User: <supabase user id>
//   X-Bridge-Voice: <voice_model_id>
//   X-Bridge-Timestamp: <unix seconds>
//   X-Bridge-Signature: hex(hmac_sha256(secret, `${ts}.${userId}.${voiceId}.${bodySha256}`))
//   Content-Type: audio/webm | audio/wav | audio/ogg
//   <raw audio bytes>
//
// On success returns the converted audio (mime from RVC_ENDPOINT) and a
// watermark token in the `X-Watermark` response header. Replays older than
// 5 minutes are rejected.

import { createFileRoute } from "@tanstack/react-router";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { signWatermark, watermarkWav } from "@/lib/watermark";
import { enforceRateLimit } from "@/lib/rate-limit";

const MAX_SKEW_MS = 5 * 60 * 1000;

function hexEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Bridge-User, X-Bridge-Voice, X-Bridge-Timestamp, X-Bridge-Signature",
} as const;

export const Route = createFileRoute("/api/public/bridge/stream")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const secret = process.env.BRIDGE_HMAC_SECRET;
        const rvc = process.env.RVC_ENDPOINT;
        if (!secret) return new Response("Bridge not configured", { status: 503, headers: CORS });
        if (!rvc) return new Response("RVC endpoint missing", { status: 503, headers: CORS });

        const userId = request.headers.get("x-bridge-user") ?? "";
        const voiceId = request.headers.get("x-bridge-voice") ?? "";
        const ts = Number(request.headers.get("x-bridge-timestamp") ?? "0");
        const sig = request.headers.get("x-bridge-signature") ?? "";
        if (!userId || !voiceId || !ts || !sig) {
          return new Response("Missing bridge headers", { status: 400, headers: CORS });
        }
        if (Math.abs(Date.now() - ts * 1000) > MAX_SKEW_MS) {
          return new Response("Stale request", { status: 401, headers: CORS });
        }

        const bodyBuf = Buffer.from(await request.arrayBuffer());
        const bodyHash = createHash("sha256").update(bodyBuf).digest("hex");
        const expected = createHmac("sha256", secret)
          .update(`${ts}.${userId}.${voiceId}.${bodyHash}`)
          .digest("hex");
        if (!hexEq(sig, expected)) {
          return new Response("Bad signature", { status: 401, headers: CORS });
        }

        try {
          enforceRateLimit({ key: `bridge:${userId}`, limit: 120, windowMs: 60_000 });
        } catch (e) {
          return new Response((e as Error).message, { status: 429, headers: CORS });
        }

        const form = new FormData();
        form.append(
          "file",
          new Blob([bodyBuf], { type: request.headers.get("content-type") ?? "audio/webm" }),
          "in.webm",
        );
        form.append("model_id", voiceId);
        const upstream = await fetch(`${rvc.replace(/\/$/, "")}/convert`, {
          method: "POST",
          body: form,
        });
        if (!upstream.ok) {
          const t = await upstream.text();
          return new Response(`RVC ${upstream.status}: ${t.slice(0, 200)}`, {
            status: 502,
            headers: CORS,
          });
        }
        const audioType = upstream.headers.get("content-type") ?? "audio/wav";
        let audio = await upstream.arrayBuffer();
        const token = signWatermark(
          { userId, voiceModelId: voiceId, issuedAt: Date.now() },
          secret,
        );
        if (audioType.includes("wav")) audio = watermarkWav(audio, token);

        return new Response(audio, {
          status: 200,
          headers: {
            ...CORS,
            "Content-Type": audioType,
            "X-Watermark": token,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
