import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mic, Square, Trash2, Upload, Volume2, Zap } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { dispatchTraining, synthesizePhrase } from "@/lib/voices.functions";
import { transcribeSample } from "@/lib/audio.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteError, RouteNotFound } from "@/components/route-error";

export const Route = createFileRoute("/_authenticated/voices/$id")({
  head: () => ({
    meta: [
      { title: "Voice — Deep Call Prank" },
      { name: "description", content: "Manage samples, train, and test a voice model." },
      { property: "og:title", content: "Voice — Deep Call Prank" },
    ],
  }),
  component: VoiceDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  training: "secondary",
  ready: "default",
  failed: "destructive",
};

function VoiceDetailPage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const dispatchTrainingFn = useServerFn(dispatchTraining);
  const synthesizeFn = useServerFn(synthesizePhrase);

  const modelQuery = useQuery({
    queryKey: ["voice-model", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_models")
        .select("id, name, description, status, character_preset, source_language, target_language, sample_count")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const samplesQuery = useQuery({
    queryKey: ["voice-samples", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_samples")
        .select("id, filename, storage_path, duration_seconds, size_bytes, transcript, created_at")
        .eq("voice_model_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const transcribeSampleFn = useServerFn(transcribeSample);
  const transcribeMutation = useMutation({
    mutationFn: (sampleId: string) => transcribeSampleFn({ data: { sampleId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["voice-samples", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop() || "webm";
      const path = `${user.id}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("voice-samples")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("voice_samples").insert({
        user_id: user.id,
        voice_model_id: id,
        storage_path: path,
        filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sample uploaded");
      qc.invalidateQueries({ queryKey: ["voice-samples", id] });
      qc.invalidateQueries({ queryKey: ["voice-model", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSampleMutation = useMutation({
    mutationFn: async (sample: { id: string; storage_path: string }) => {
      await supabase.storage.from("voice-samples").remove([sample.storage_path]);
      const { error } = await supabase.from("voice_samples").delete().eq("id", sample.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voice-samples", id] });
      qc.invalidateQueries({ queryKey: ["voice-model", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const trainMutation = useMutation({
    mutationFn: async () => dispatchTrainingFn({ data: { voiceModelId: id } }),
    onSuccess: (r) => {
      toast.success(r.message);
      qc.invalidateQueries({ queryKey: ["voice-model", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mic recording for new samples
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type });
        uploadMutation.mutate(file);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  // Test synth
  const [testText, setTestText] = useState("Hello, this is a test of my new voice.");
  const [testAudio, setTestAudio] = useState<string | null>(null);
  const synthMutation = useMutation({
    mutationFn: () => synthesizeFn({ data: { voiceModelId: id, text: testText } }),
    onSuccess: (r) => setTestAudio(`data:${r.mimeType};base64,${r.audioBase64}`),
    onError: (e: Error) => toast.error(e.message),
  });

  if (modelQuery.isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (!modelQuery.data) {
    return <div className="p-10">Voice not found.</div>;
  }
  const model = modelQuery.data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/voices" })}>
          <ArrowLeft className="h-4 w-4" />
          Voice Lab
        </Button>
        <h1 className="font-semibold">{model.name}</h1>
        <Badge variant={STATUS_VARIANT[model.status] ?? "outline"}>{model.status}</Badge>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Samples</CardTitle>
            <CardDescription>
              Upload clean speech (30s–2min total). The more variety, the better the clone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  files.forEach((f) => uploadMutation.mutate(f));
                  e.target.value = "";
                }}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload files
              </Button>
              {recording ? (
                <Button variant="destructive" onClick={stopRecording}>
                  <Square className="h-4 w-4" />Stop recording
                </Button>
              ) : (
                <Button variant="outline" onClick={startRecording}>
                  <Mic className="h-4 w-4" />Record mic
                </Button>
              )}
            </div>

            <div className="divide-y divide-border rounded-md border">
              {samplesQuery.data?.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No samples yet.</p>
              )}
              {samplesQuery.data?.map((s) => (
                <SampleRow
                  key={s.id}
                  sample={s}
                  onDelete={() => deleteSampleMutation.mutate(s)}
                  onTranscribe={() => transcribeMutation.mutate(s.id)}
                  transcribing={transcribeMutation.isPending && transcribeMutation.variables === s.id}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Train</CardTitle>
            <CardDescription>
              Dispatch samples to your self-hosted RVC trainer. Status updates here when done.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => trainMutation.mutate()}
              disabled={trainMutation.isPending || model.status === "training" || (samplesQuery.data?.length ?? 0) === 0}
            >
              {trainMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {model.status === "training" ? "Training in progress" : "Start training"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test voice</CardTitle>
            <CardDescription>Synthesize a short phrase to hear the result.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={testText} onChange={(e) => setTestText(e.target.value)} maxLength={500} />
            <div className="flex gap-2 items-center">
              <Button
                onClick={() => synthMutation.mutate()}
                disabled={synthMutation.isPending || model.status !== "ready"}
              >
                {synthMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                Synthesize
              </Button>
              {testAudio && <audio controls src={testAudio} className="flex-1" />}
            </div>
            {model.status !== "ready" && (
              <p className="text-xs text-muted-foreground">
                Available once the model is trained.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function SampleRow({
  sample,
  onDelete,
  onTranscribe,
  transcribing,
}: {
  sample: {
    id: string;
    filename: string | null;
    storage_path: string;
    size_bytes: number | null;
    duration_seconds: number | null;
    transcript: string | null;
  };
  onDelete: () => void;
  onTranscribe: () => void;
  transcribing: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage.from("voice-samples").createSignedUrl(sample.storage_path, 3600).then((r) => {
      if (!cancelled) setUrl(r.data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [sample.storage_path]);

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{sample.filename ?? sample.storage_path.split("/").pop()}</p>
          <p className="text-xs text-muted-foreground">
            {sample.size_bytes ? `${Math.round(sample.size_bytes / 1024)} KB` : "—"}
            {sample.duration_seconds ? ` · ${sample.duration_seconds.toFixed(1)}s` : ""}
          </p>
        </div>
        {url && <audio controls src={url} className="h-8 max-w-[220px]" />}
        <Button variant="ghost" size="sm" onClick={onTranscribe} disabled={transcribing} title="Transcribe">
          {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {sample.transcript && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">
          "{sample.transcript}"
        </p>
      )}
    </div>
  );
}

