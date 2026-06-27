import { useCallback, useRef, useState } from "react";
import type { VoiceProfile } from "@/lib/voice-types";

type StreamSettings = {
  stability?: number;
  similarity_boost?: number;
  style_exaggeration?: number;
  speed?: number;
};

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function useVoiceStream() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  function getAudioCtx() {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }

  const playQueue = useCallback(() => {
    if (isPlayingRef.current || queueRef.current.length === 0) return;
    isPlayingRef.current = true;
    setIsPlaying(true);

    const ctx = getAudioCtx();
    const buffer = queueRef.current.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      if (queueRef.current.length > 0) {
        playQueue();
      } else {
        setIsPlaying(false);
        setCurrentChunk(0);
      }
    };
    source.start();
  }, []);

  const synthesize = useCallback(
    async (
      voiceId: string,
      text: string,
      settings: StreamSettings = {}
    ) => {
      // Cancel any in-flight stream
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      queueRef.current = [];
      isPlayingRef.current = false;
      setCurrentChunk(0);

      const ctx = getAudioCtx();

      const response = await fetch("/api/stream/synth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_id: voiceId, text, settings }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Synthesis request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          try {
            const parsed = JSON.parse(payload) as {
              chunk: number;
              audio: string;
            };
            setCurrentChunk(parsed.chunk);
            const arrayBuffer = base64ToArrayBuffer(parsed.audio);
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            queueRef.current.push(audioBuffer);
            playQueue(); // starts immediately on first chunk
          } catch {
            // malformed event — skip
          }
        }
      }
    },
    [playQueue]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    queueRef.current = [];
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentChunk(0);
    // Close and discard context so next play starts fresh
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  }, []);

  return { synthesize, stop, isPlaying, currentChunk };
}
