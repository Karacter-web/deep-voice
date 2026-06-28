import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listVoiceProfiles, getVoiceQuota } from "@/lib/voice-profiles.functions";
import type { VoiceJob, VoiceProfile, VoiceQuota } from "@/lib/voice-types";

export function useVoiceLibrary() {
  const fn = useServerFn(listVoiceProfiles);
  return useQuery<VoiceProfile[]>({
    queryKey: ["voice-profiles"],
    queryFn: () => fn({ data: undefined as never }),
  });
}

export function useQuota() {
  const fn = useServerFn(getVoiceQuota);
  return useQuery<VoiceQuota>({
    queryKey: ["voice-quota"],
    queryFn: () => fn({ data: undefined as never }),
    staleTime: 30_000,
  });
}

/**
 * Subscribe to a profile's job rows in realtime. Returns the most recent job.
 */
export function useVoiceJobStatus(profileId: string | null | undefined) {
  const qc = useQueryClient();
  const [job, setJob] = useState<VoiceJob | null>(null);

  useEffect(() => {
    if (!profileId) return;
    let active = true;
    // initial fetch
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("voice_jobs")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active && data) setJob(data as VoiceJob);
    })();

    const channel = supabase
      .channel(`voice-jobs:${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "voice_jobs", filter: `profile_id=eq.${profileId}` },
        (payload) => {
          const next = (payload.new ?? payload.old) as VoiceJob;
          setJob(next);
          if (next?.status === "succeeded" || next?.status === "failed") {
            qc.invalidateQueries({ queryKey: ["voice-profiles"] });
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [profileId, qc]);

  return job;
}

/**
 * Gapless playback of base64 WAV chunks streamed from /api/stream/synth via SSE.
 */
export function useVoiceStream() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nextStartRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ index: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(
    async (opts: { profileId?: string; text: string; language?: string }) => {
      stop();
      setError(null);
      setProgress(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = ctxRef.current ?? new Ctx();
      ctxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      nextStartRef.current = ctx.currentTime + 0.05;

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) { setError("Not signed in"); return; }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setPlaying(true);

      try {
        const res = await fetch("/api/stream/synth", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(opts),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) { setError(`synth ${res.status}`); setPlaying(false); return; }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const eLine = frame.split("\n").find((l) => l.startsWith("event: "));
            const dLine = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!eLine || !dLine) continue;
            const event = eLine.slice(7).trim();
            const data = JSON.parse(dLine.slice(6));
            if (event === "chunk") {
              setProgress({ index: data.index, total: data.total });
              await scheduleChunk(ctx, nextStartRef, data.audioBase64 as string);
            } else if (event === "error") {
              setError(String(data.message ?? "error"));
            } else if (event === "done") {
              // wait for last chunk to finish
              const waitMs = Math.max(0, (nextStartRef.current - ctx.currentTime) * 1000);
              setTimeout(() => setPlaying(false), waitMs + 50);
              return;
            }
          }
        }
        setPlaying(false);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
        setPlaying(false);
      }
    },
    [stop],
  );

  useEffect(() => () => { abortRef.current?.abort(); ctxRef.current?.close().catch(() => {}); }, []);

  return { play, stop, playing, error, progress };
}

async function scheduleChunk(
  ctx: AudioContext,
  nextStartRef: React.MutableRefObject<number>,
  b64: string,
) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const audio = await ctx.decodeAudioData(buf.buffer.slice(0));
  const src = ctx.createBufferSource();
  src.buffer = audio;
  src.connect(ctx.destination);
  const startAt = Math.max(nextStartRef.current, ctx.currentTime + 0.02);
  src.start(startAt);
  nextStartRef.current = startAt + audio.duration;
}
