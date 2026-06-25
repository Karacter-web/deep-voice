import { createFileRoute } from "@tanstack/react-router";

/**
 * SSE endpoint: accepts a single audio chunk (multipart/form-data, field "file"),
 * forwards it to the configured Whisper server, and streams the resulting
 * transcript back word-by-word as `data:` events. Closes with `event: done`.
 *
 * Auth: requires a Supabase bearer token in the Authorization header. We don't
 * expose this under /api/public because it consumes Whisper compute.
 */
export const Route = createFileRoute("/api/stream/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.toLowerCase().startsWith("bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }

        // Validate the bearer with Supabase before doing any work.
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
        );
        const { data: userRes, error: userErr } = await supabase.auth.getUser(auth.slice(7));
        if (userErr || !userRes.user) return new Response("Unauthorized", { status: 401 });

        const endpoint = process.env.WHISPER_ENDPOINT;
        if (!endpoint) return new Response("WHISPER_ENDPOINT not configured", { status: 503 });

        const inForm = await request.formData();
        const file = inForm.get("file");
        if (!(file instanceof Blob)) return new Response("file required", { status: 400 });

        const outForm = new FormData();
        outForm.append("file", file, "chunk.webm");

        const stream = new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder();
            const send = (event: string, data: string) =>
              controller.enqueue(enc.encode(`event: ${event}\ndata: ${data}\n\n`));
            try {
              const res = await fetch(`${endpoint.replace(/\/$/, "")}/inference`, {
                method: "POST",
                body: outForm,
              });
              if (!res.ok) {
                send("error", JSON.stringify({ status: res.status, message: (await res.text()).slice(0, 200) }));
                controller.close();
                return;
              }
              const json = (await res.json()) as { text?: string };
              const text = (json.text ?? "").trim();
              // Emit word-by-word so the client renders a streaming transcript.
              const words = text.split(/\s+/).filter(Boolean);
              for (const w of words) {
                send("partial", JSON.stringify({ word: w }));
                await new Promise((r) => setTimeout(r, 40));
              }
              send("done", JSON.stringify({ text }));
            } catch (e) {
              send("error", JSON.stringify({ message: (e as Error).message }));
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
