import { useState } from "react";
import { ArrowLeft, Loader2, Play, Square, Trash2 } from "lucide-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  deleteVoiceProfile,
  getVoiceProfile,
  updateVoiceProfile,
} from "@/lib/voice-profiles.functions";
import { dispatchVoiceJob } from "@/lib/voice-jobs.functions";
import { VoiceSettingsSliders } from "@/components/voice-studio/VoiceSettingsSliders";
import { useVoiceStream } from "@/hooks/useVoiceStream";
import { voiceLibraryQueryKey } from "@/hooks/useVoiceLibrary";

export const Route = createFileRoute("/_authenticated/studio/voices/$id")({
  loader: ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData({
      queryKey: ["voice-profile", params.id],
      queryFn: () => getVoiceProfile({ data: { id: params.id } }),
    }),
  component: VoiceEditorPage,
  head: () => ({ meta: [{ title: "Edit voice" }] }),
});

const DEFAULT_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style_exaggeration: 0.0,
  speed: 1.0,
};

function VoiceEditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: voice, isLoading } = useQuery({
    queryKey: ["voice-profile", id],
    queryFn: () => getVoiceProfile({ data: { id } }),
  });

  const params =
    voice?.params && typeof voice.params === "object" && !Array.isArray(voice.params)
      ? (voice.params as Record<string, number>)
      : {};

  const [settings, setSettings] = useState({
    stability: (params.stability as number) ?? DEFAULT_SETTINGS.stability,
    similarity_boost: (params.similarity_boost as number) ?? DEFAULT_SETTINGS.similarity_boost,
    style_exaggeration: (params.style_exaggeration as number) ?? DEFAULT_SETTINGS.style_exaggeration,
    speed: (params.speed as number) ?? DEFAULT_SETTINGS.speed,
  });
  const [previewText, setPreviewText] = useState(
    "Hello, this is a preview of my voice model."
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(voice?.name ?? "");

  const { synthesize, stop, isPlaying } = useVoiceStream();

  const updateMutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateVoiceProfile>[0]["data"]["patch"]) =>
      updateVoiceProfile({ data: { id, patch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voice-profile", id] });
      qc.invalidateQueries({ queryKey: voiceLibraryQueryKey });
      toast.success("Voice updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteVoiceProfile({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: voiceLibraryQueryKey });
      navigate({ to: "/studio/voices" });
      toast.success("Voice deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  async function handleSaveSettings() {
    await updateMutation.mutateAsync({ params: settings as unknown as Record<string, unknown> });
  }

  async function handleSaveName() {
    if (!nameValue.trim() || nameValue === voice?.name) {
      setIsEditingName(false);
      return;
    }
    await updateMutation.mutateAsync({ name: nameValue.trim() });
    setIsEditingName(false);
  }

  async function handlePreview() {
    if (!previewText.trim() || !voice) return;
    try {
      await synthesize(voice.id, previewText, settings);
    } catch {
      toast.error("Preview failed. Check that your HF space is running.");
    }
  }

  async function handleRegeneratePreview() {
    if (!voice) return;
    await dispatchVoiceJob({
      data: { profileId: voice.id, kind: "preview", input: {} },
    });
    toast.success("Preview regeneration queued");
  }

  if (isLoading || !voice) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      {/* Back */}
      <Link
        to="/studio/voices"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit"
      >
        <ArrowLeft className="size-4" />
        Voice studio
      </Link>

      {/* Name + status */}
      <div className="flex items-center gap-3 flex-wrap">
        {isEditingName ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setIsEditingName(false);
              }}
              className="text-2xl font-semibold h-auto py-0 border-0 border-b rounded-none focus-visible:ring-0 px-0"
            />
          </div>
        ) : (
          <h1
            className="text-2xl font-semibold cursor-pointer hover:opacity-70 transition-opacity"
            onClick={() => {
              setNameValue(voice.name);
              setIsEditingName(true);
            }}
            title="Click to rename"
          >
            {voice.name}
          </h1>
        )}
        <Badge variant="outline" className="capitalize">
          {voice.mode}
        </Badge>
        <Badge
          variant={
            voice.status === "ready"
              ? "default"
              : voice.status === "failed"
              ? "destructive"
              : "secondary"
          }
          className="capitalize"
        >
          {voice.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
        {/* Left: preview player */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-medium mb-2">Test this voice</h2>
            <Textarea
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              rows={3}
              placeholder="Enter text to synthesize..."
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {previewText.length}/500
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={isPlaying ? stop : handlePreview}
              disabled={voice.status !== "ready"}
              className="gap-2"
            >
              {isPlaying ? (
                <>
                  <Square className="size-4" /> Stop
                </>
              ) : (
                <>
                  <Play className="size-4" /> Synthesize
                </>
              )}
            </Button>
            {isPlaying && (
              <span className="text-xs text-muted-foreground animate-pulse">
                Streaming audio...
              </span>
            )}
          </div>

          {voice.description && (
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm mt-1">{voice.description}</p>
            </div>
          )}

          <Separator className="mt-4" />

          {/* Danger zone */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateMutation.mutate({ status: "archived" })
                }
                disabled={voice.status === "archived"}
              >
                Archive voice
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5">
                    <Trash2 className="size-3.5" />
                    Delete voice
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete voice</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{voice.name}" and cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {/* Right: settings */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">Voice settings</h2>
          <VoiceSettingsSliders
            settings={settings}
            onChange={(key, value) =>
              setSettings((prev) => ({ ...prev, [key]: value }))
            }
            onPreview={handlePreview}
          />
          <Button
            onClick={handleSaveSettings}
            disabled={updateMutation.isPending}
            variant="outline"
            className="mt-2"
          >
            {updateMutation.isPending && (
              <Loader2 className="size-4 mr-2 animate-spin" />
            )}
            Save settings
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleRegeneratePreview}
          >
            Regenerate preview clip
          </Button>
        </div>
      </div>
    </div>
  );
}
