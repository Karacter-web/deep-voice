import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LogOut, Mic, Radio, Settings, Sparkles, Square, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { signOutClean } from "@/lib/sign-out";
import { convertVoice, endCallSession, startCallSession } from "@/lib/audio.functions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RouteError, RouteNotFound } from "@/components/route-error";

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({
    meta: [
      { title: "Studio — Deep Call Prank" },
      { name: "description", content: "Live voice changer: stream your mic and hear it converted." },
      { property: "og:title", content: "Studio — Deep Call Prank" },
      { property: "og:description", content: "Live voice changer: stream your mic and hear it converted." },
    ],
  }),
  component: Studio,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const CHUNK_MS = 4000;

function Studio() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();

  
  const convertFn = useServerFn(convertVoice);
  const startFn = useServerFn(startCallSession);
  const endFn = useServerFn(endCallSession);

  const voicesQuery = useQuery({
    queryKey: ["voice-models", user.id, "ready"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_models")
        .select("id, name, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [voiceId, setVoiceId] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [outputs, setOutputs] = useState<string[]>([]);

  const sessionRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
  }, []);

  async function blobToB64(blob: Blob): Promise<string> {
    const buf = await blob.arrayBuffer();
    let s = "";
    const view = new Uint8Array(buf);
    for (let i = 0; i < view.length; i++) s += String.fromCharCode(view[i]);
    return btoa(s);
  }

  async function streamTranscribe(blob: Blob) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    const form = new FormData();
    form.append("file", blob, "chunk.webm");
    const res = await fetch("/api/stream/transcribe", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok || !res.body) return;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let partial = "";
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const events = buf.split("\n\n");
      buf = events.pop() ?? "";
      for (const ev of events) {
        const lines = ev.split("\n");
        const evName = lines.find((l) => l.startsWith("event: "))?.slice(7) ?? "";
        const dataLine = lines.find((l) => l.startsWith("data: "))?.slice(6) ?? "";
        if (!dataLine) continue;
        if (evName === "partial") {
          try {
            const { word } = JSON.parse(dataLine) as { word: string };
            partial += (partial ? " " : "") + word;
            setTranscript((prev) => {
              const next = [...prev];
              next[next.length - 1] = partial;
              return next;
            });
          } catch { /* ignore */ }
        } else if (evName === "done") {
          try {
            const { text } = JSON.parse(dataLine) as { text: string };
            if (text) {
              setTranscript((prev) => {
                const next = [...prev];
                next[next.length - 1] = text;
                return [...next, ""];
              });
            }
          } catch { /* ignore */ }
        }
      }
    }
  }

  async function handleChunk(blob: Blob) {
    if (blob.size < 1000) return;
    // Add a placeholder line that the SSE handler will fill in.
    setTranscript((prev) => (prev.length === 0 || prev[prev.length - 1] !== "" ? [...prev, ""] : prev));
    void streamTranscribe(blob).catch((e) => console.warn("transcribe stream failed", e));

    if (voiceId) {
      try {
        const audioBase64 = await blobToB64(blob);
        const mimeType = blob.type || "audio/webm";
        const c = await convertFn({
          data: { audioBase64, mimeType, voiceModelId: voiceId, sessionId: sessionRef.current ?? undefined },
        });
        const url = `data:${c.mimeType};base64,${c.audioBase64}`;
        setOutputs((prev) => [url, ...prev].slice(0, 8));
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        const audio = new Audio(url);
        audio.play().catch(() => {});
      } catch (e) {
        console.warn("convert failed", e);
        toast.error((e as Error).message);
      }
    }
  }

  async function startSession() {
    if (!consent) {
      toast.error("Please confirm consent before starting.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "" });
      rec.ondataavailable = (e) => { if (e.data.size > 0) void handleChunk(e.data); };
      rec.start(CHUNK_MS);
      recorderRef.current = rec;
      sessionStartRef.current = Date.now();
      setTranscript([]);
      setOutputs([]);
      setRecording(true);
      try {
        const s = await startFn({ data: { voiceModelId: voiceId || null } });
        sessionRef.current = s.id;
      } catch (e) {
        console.warn("session start failed", e);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function stopSession() {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
    if (sessionRef.current) {
      try {
        await endFn({
          data: {
            sessionId: sessionRef.current,
            durationSeconds: (Date.now() - sessionStartRef.current) / 1000,
          },
        });
      } catch (e) {
        console.warn("session end failed", e);
      }
      sessionRef.current = null;
    }
  }

  const readyVoices = voicesQuery.data?.filter((v) => v.status === "ready") ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-semibold tracking-tight inline-flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Mic className="h-4 w-4" />
          </span>
          Deep Call Prank
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/voices"><Sparkles className="h-4 w-4" />Voice Lab</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/profile"><User className="h-4 w-4" />Profile</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/settings"><Settings className="h-4 w-4" />Settings</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => signOutClean(qc, navigate)}>
            <LogOut className="h-4 w-4" />Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Live changer</h1>
          <p className="text-muted-foreground mt-2">
            Captures your mic in {CHUNK_MS / 1000}s chunks, transcribes them, and converts to your chosen voice.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Radio className="h-4 w-4" />Session</CardTitle>
            <CardDescription>Pick a trained voice and start streaming.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Voice model</Label>
              <Select value={voiceId} onValueChange={setVoiceId} disabled={recording}>
                <SelectTrigger><SelectValue placeholder={readyVoices.length ? "Select a voice" : "No trained voices yet"} /></SelectTrigger>
                <SelectContent>
                  {readyVoices.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {readyVoices.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Train one in <Link to="/voices" className="underline">Voice Lab</Link> first. Transcription still works without a voice.
                </p>
              )}
            </div>

            <div className="flex items-start gap-2">
              <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} disabled={recording} />
              <Label htmlFor="consent" className="text-xs font-normal leading-snug">
                I confirm everyone in this call has consented to voice modification, and I will not use this to defraud or impersonate anyone.
              </Label>
            </div>

            <div className="flex gap-2">
              {recording ? (
                <Button variant="destructive" onClick={stopSession}>
                  <Square className="h-4 w-4" />Stop
                </Button>
              ) : (
                <Button onClick={startSession} disabled={!consent}>
                  <Mic className="h-4 w-4" />Start session
                </Button>
              )}
              {recording && <Badge variant="secondary" className="animate-pulse">Live</Badge>}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Transcript</CardTitle></CardHeader>
            <CardContent>
              {transcript.length === 0 ? (
                <p className="text-sm text-muted-foreground">Partial transcripts appear here as you talk.</p>
              ) : (
                <div className="space-y-1 text-sm max-h-72 overflow-y-auto">
                  {transcript.map((t, i) => <p key={i}>{t}</p>)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Output</CardTitle></CardHeader>
            <CardContent>
              {outputs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Converted clips appear here.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {outputs.map((u, i) => <audio key={i} src={u} controls className="w-full" />)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
