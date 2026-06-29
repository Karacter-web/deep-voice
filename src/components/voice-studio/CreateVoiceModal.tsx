import { useState } from "react";
import { Loader2, Upload, Mic, X, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createVoiceProfile } from "@/lib/voice-profiles.functions";
import { dispatchVoiceJob } from "@/lib/voice-jobs.functions";
import { supabase } from "@/integrations/supabase/client";
import { VoiceSettingsSliders } from "./VoiceSettingsSliders";
import { useVoiceLibrary } from "@/hooks/useVoiceLibrary";

interface CreateVoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (voiceId: string) => void;
}

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
];

const DEFAULT_DESIGN_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style_exaggeration: 0.0,
  speed: 1.0,
};

// ── Clone tab ────────────────────────────────────────────────────────────────

function CloneTab({
  onSuccess,
}: {
  onSuccess: (voiceId: string) => void;
}) {
  const { createVoice } = useVoiceLibrary();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const audio = Array.from(incoming).filter((f) =>
      f.type.startsWith("audio/")
    );
    setFiles((prev) => [...prev, ...audio].slice(0, 5));
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    mr.ondataavailable = (e) => chunks.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const file = new File([blob], `recording-${Date.now()}.webm`, {
        type: "audio/webm",
      });
      setFiles((prev) => [...prev, file].slice(0, 5));
      stream.getTracks().forEach((t) => t.stop());
    };
    mr.start();
    setRecorder(mr);
    setIsRecording(true);
    // Auto-stop after 30s
    setTimeout(() => {
      if (mr.state === "recording") mr.stop();
      setIsRecording(false);
    }, 30_000);
  }

  function stopRecording() {
    recorder?.stop();
    setIsRecording(false);
  }

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    if (files.length === 0)
      return setError("Upload or record at least one audio sample.");

    const shortFiles = files.filter((f) => f.size < 10 * 1024); // ~10 KB ≈ <1 s
    if (shortFiles.length === files.length)
      return setError("Samples are too short. Upload at least 10 seconds of audio.");

    setIsSubmitting(true);
    try {
      const profile = await createVoice({
        name: name.trim(),
        mode: "clone",
        language,
        status: "processing",
      } as Parameters<typeof createVoiceProfile>[0]["data"]);

      // Upload samples to Supabase Storage
      const { data: { user } } = await supabase.auth.getUser();
      await Promise.all(
        files.map((file) =>
          supabase.storage
            .from("voice-samples")
            .upload(`${user!.id}/${profile.id}/${file.name}`, file, {
              upsert: true,
            })
        )
      );

      // Dispatch clone job
      await dispatchVoiceJob({
        data: {
          profileId: profile.id,
          kind: "clone_train",
          input: { language },
        },
      });

      onSuccess(profile.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clone-name">Voice name</Label>
        <Input
          id="clone-name"
          placeholder="My cloned voice"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Language</Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => document.getElementById("clone-file-input")?.click()}
      >
        <Upload className="size-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag audio files here or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          MP3, WAV, M4A · max 5 files · min 10 seconds each
        </p>
        <input
          id="clone-file-input"
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between text-sm px-3 py-1.5 bg-muted rounded-md"
            >
              <span className="truncate max-w-[200px]">{f.name}</span>
              <button
                onClick={() =>
                  setFiles((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="ml-2 text-muted-foreground hover:text-foreground"
                aria-label="Remove file"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Mic record */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit gap-2"
        onClick={isRecording ? stopRecording : startRecording}
      >
        <Mic className={`size-4 ${isRecording ? "text-destructive animate-pulse" : ""}`} />
        {isRecording ? "Stop recording" : "Record mic (30s)"}
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button onClick={handleSubmit} disabled={isSubmitting} className="mt-2">
        {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
        Create and train
      </Button>
    </div>
  );
}

// ── Design tab ───────────────────────────────────────────────────────────────

function DesignTab({ onSuccess }: { onSuccess: (voiceId: string) => void }) {
  const { createVoice } = useVoiceLibrary();
  const [name, setName] = useState("");
  const [settings, setSettings] = useState(DEFAULT_DESIGN_SETTINGS);
  const [gender, setGender] = useState("neutral");
  const [age, setAge] = useState("adult");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSliderChange(
    key: keyof typeof DEFAULT_DESIGN_SETTINGS,
    value: number
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    setIsSubmitting(true);
    try {
      const profile = await createVoice({
        name: name.trim(),
        mode: "design",
        gender,
        age,
        params: settings as unknown as Record<string, unknown>,
        status: "processing",
      } as Parameters<typeof createVoiceProfile>[0]["data"]);

      await dispatchVoiceJob({
        data: {
          profileId: profile.id,
          kind: "design_synth",
          input: { gender, age, ...settings },
        },
      });

      onSuccess(profile.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="design-name">Voice name</Label>
        <Input
          id="design-name"
          placeholder="My designed voice"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Gender</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Age</Label>
          <Select value={age} onValueChange={setAge}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="child">Child</SelectItem>
              <SelectItem value="young">Young</SelectItem>
              <SelectItem value="adult">Adult</SelectItem>
              <SelectItem value="elderly">Elderly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <VoiceSettingsSliders
        settings={settings}
        onChange={handleSliderChange}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button onClick={handleSubmit} disabled={isSubmitting} className="mt-2">
        {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
        Create voice
      </Button>
    </div>
  );
}

// ── Instant tab ──────────────────────────────────────────────────────────────

function InstantTab({ onSuccess }: { onSuccess: (voiceId: string) => void }) {
  const { createVoice } = useVoiceLibrary();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    if (!prompt.trim()) return setError("Describe the voice you want.");
    setIsSubmitting(true);
    try {
      const profile = await createVoice({
        name: name.trim(),
        mode: "instant",
        description: prompt.trim(),
        status: "processing",
      } as Parameters<typeof createVoiceProfile>[0]["data"]);

      await dispatchVoiceJob({
        data: {
          profileId: profile.id,
          kind: "instant_generate",
          input: { prompt: prompt.trim() },
        },
      });

      onSuccess(profile.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="instant-name">Voice name</Label>
        <Input
          id="instant-name"
          placeholder="My instant voice"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="instant-prompt">Describe the voice</Label>
        <Textarea
          id="instant-prompt"
          placeholder="A calm British male narrator with a slight rasp and measured pace"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={800}
        />
        <p className="text-xs text-muted-foreground text-right">
          {prompt.length}/800
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button onClick={handleSubmit} disabled={isSubmitting} className="mt-2">
        {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
        Generate voice
      </Button>
    </div>
  );
}

// ── Modal shell ──────────────────────────────────────────────────────────────

export function CreateVoiceModal({
  open,
  onOpenChange,
  onCreated,
}: CreateVoiceModalProps) {
  function handleSuccess(voiceId: string) {
    onOpenChange(false);
    onCreated?.(voiceId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a voice</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="clone">
          <TabsList className="w-full">
            <TabsTrigger value="clone" className="flex-1">
              Clone
            </TabsTrigger>
            <TabsTrigger value="design" className="flex-1">
              Design
            </TabsTrigger>
            <TabsTrigger value="instant" className="flex-1">
              Instant
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clone" className="mt-4">
            <CloneTab onSuccess={handleSuccess} />
          </TabsContent>
          <TabsContent value="design" className="mt-4">
            <DesignTab onSuccess={handleSuccess} />
          </TabsContent>
          <TabsContent value="instant" className="mt-4">
            <InstantTab onSuccess={handleSuccess} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
