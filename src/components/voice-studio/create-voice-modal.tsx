import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, Mic, Square, X, FileAudio } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { createVoiceProfile } from "@/lib/voice-profiles.functions";
import { dispatchVoiceJob } from "@/lib/voice-jobs.functions";
import type { VoiceProfile } from "@/lib/voice-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (profile: VoiceProfile) => void;
}

const MIN_SAMPLES = 5;
const MAX_SAMPLES = 15;
const MAX_FILE_MB = 25;

type Sample = { id: string; file: File; url: string; source: "upload" | "record" };

export function CreateVoiceModal({ open, onOpenChange, onCreated }: Props) {
  const createFn = useServerFn(createVoiceProfile);
  const dispatchFn = useServerFn(dispatchVoiceJob);
  const qc = useQueryClient();

  const [mode, setMode] = useState<"clone" | "design" | "instant">("clone");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("en");
  const [gender, setGender] = useState("neutral");
  const [age, setAge] = useState("adult");
  const [style, setStyle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const reset = () => {
    samples.forEach((s) => URL.revokeObjectURL(s.url));
    setName(""); setDescription(""); setStyle(""); setPrompt("");
    setSamples([]);
  };

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const next: Sample[] = [];
    for (const file of incoming) {
      if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|ogg|webm|flac)$/i.test(file.name)) {
        toast.error(`${file.name}: not an audio file`);
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${file.name}: exceeds ${MAX_FILE_MB}MB`);
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        source: "upload",
      });
    }
    setSamples((prev) => [...prev, ...next].slice(0, MAX_SAMPLES));
  }

  function removeSample(id: string) {
    setSamples((prev) => {
      const found = prev.find((s) => s.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((s) => s.id !== id);
    });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: mime || "audio/webm" });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type });
        setSamples((prev) => [
          ...prev,
          { id: crypto.randomUUID(), file, url: URL.createObjectURL(blob), source: "record" },
        ].slice(0, MAX_SAMPLES));
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Microphone unavailable");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  async function submit() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (mode === "clone" && samples.length < MIN_SAMPLES) {
      toast.error(`Please provide at least ${MIN_SAMPLES} voice samples`);
      return;
    }
    setBusy(true);
    try {
      const params: Record<string, unknown> = {};
      if (mode === "design") Object.assign(params, { gender, age, style });
      if (mode === "instant") Object.assign(params, { prompt });

      const profile = await createFn({
        data: {
          name, description: description || undefined, mode, language,
          gender: mode === "design" ? gender : undefined,
          age: mode === "design" ? age : undefined,
          style: mode === "design" ? style : undefined,
          params,
        },
      });

      // Upload samples for clone mode
      if (mode === "clone" && samples.length > 0) {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error("Not signed in");
        const uploaded: string[] = [];
        for (const s of samples) {
          const path = `${uid}/${profile.id}/${Date.now()}-${s.file.name}`;
          const { error } = await supabase.storage
            .from("voice-samples")
            .upload(path, s.file, { upsert: false, contentType: s.file.type });
          if (error) throw new Error(`Upload failed: ${error.message}`);
          uploaded.push(path);
        }
        (params as Record<string, unknown>).sample_paths = uploaded;
      }

      const kind = mode === "clone" ? "clone_train" : mode === "design" ? "design_synth" : "instant_generate";
      await dispatchFn({
        data: { profileId: profile.id, kind, input: params as never },
      });

      toast.success("Voice queued for processing");
      qc.invalidateQueries({ queryKey: ["voice-profiles"] });
      onCreated?.(profile);
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create voice");
    } finally {
      setBusy(false);
    }
  }

  const cloneReady = samples.length >= MIN_SAMPLES;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { stopRecording(); reset(); } onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create voice</DialogTitle>
          <DialogDescription>Clone an existing voice, design one from traits, or describe it in plain English.</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="clone">Clone</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="instant">Instant</TabsTrigger>
          </TabsList>

          <div className="grid gap-3 mt-4">
            <div className="grid gap-1.5">
              <Label htmlFor="v-name">Name</Label>
              <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My voice" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="v-desc">Description (optional)</Label>
              <Input id="v-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["en","es","fr","de","it","pt","pl","tr","ru","nl","cs","ar","zh","ja","ko","hi"].map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TabsContent value="clone" className="m-0 grid gap-3">
              <div className="flex items-center justify-between">
                <Label>Voice samples</Label>
                <span className={`text-xs ${cloneReady ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {samples.length}/{MIN_SAMPLES} minimum · up to {MAX_SAMPLES}
                </span>
              </div>

              <div
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-muted-foreground/60 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              >
                <Upload className="size-5 mx-auto mb-1.5 text-muted-foreground" />
                <p className="text-sm">Drop audio files or click to browse</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  MP3, WAV, M4A, WEBM · up to {MAX_FILE_MB}MB each
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={recording ? "destructive" : "outline"}
                  size="sm"
                  onClick={recording ? stopRecording : startRecording}
                  className="gap-2"
                >
                  {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
                  {recording ? "Stop recording" : "Record sample"}
                </Button>
                {recording && (
                  <span className="text-xs text-destructive animate-pulse">● recording…</span>
                )}
              </div>

              {samples.length > 0 && (
                <ul className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {samples.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                      <FileAudio className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">{i + 1}. {s.file.name}</p>
                        <audio src={s.url} controls className="h-7 w-full mt-1" />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSample(s.id)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label="Remove sample"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-xs text-muted-foreground">
                Tip: use {MIN_SAMPLES}+ short clips (5–30s each) of clean, varied speech from the same speaker for best cloning quality.
              </p>
            </TabsContent>

            <TabsContent value="design" className="m-0 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["male","female","neutral"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Age</Label>
                  <Select value={age} onValueChange={setAge}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["child","young","adult","elderly"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-style">Style</Label>
                <Input id="v-style" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="warm, calm, narrator" />
              </div>
            </TabsContent>

            <TabsContent value="instant" className="m-0 grid gap-1.5">
              <Label htmlFor="v-prompt">Describe the voice</Label>
              <Textarea
                id="v-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A gravelly British detective in his 60s, slow and weary."
                rows={4}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || (mode === "clone" && !cloneReady)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create voice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
