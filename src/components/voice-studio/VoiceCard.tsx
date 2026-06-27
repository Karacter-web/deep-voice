import { useState } from "react";
import { Mic2, Settings, Trash2, Play, Square, Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import type { VoiceProfile } from "@/lib/voice-types";
import { useVoiceStream } from "@/hooks/useVoiceStream";
import type { useVoiceJobStatus } from "@/hooks/useVoiceJobStatus";

const MODE_LABELS: Record<VoiceProfile["mode"], string> = {
  clone: "Cloned",
  design: "Designed",
  instant: "Instant",
};

const STATUS_VARIANTS: Record
  VoiceProfile["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  processing: "secondary",
  ready: "default",
  failed: "destructive",
  archived: "outline",
};

interface VoiceCardProps {
  voice: VoiceProfile;
  onDelete: (id: string) => Promise<void>;
  jobStatus: ReturnType<ReturnType<typeof useVoiceJobStatus>["getJobStatus"]>;
}

const PREVIEW_TEXT = "Hello, this is a preview of my voice.";

export function VoiceCard({ voice, onDelete, jobStatus }: VoiceCardProps) {
  const navigate = useNavigate();
  const { synthesize, stop, isPlaying } = useVoiceStream();
  const [isDeleting, setIsDeleting] = useState(false);

  const isProcessing =
    voice.status === "processing" ||
    jobStatus?.status === "running" ||
    jobStatus?.status === "queued";

  const canPlay = voice.status === "ready";

  async function handlePlay() {
    if (isPlaying) {
      stop();
      return;
    }
    await synthesize(voice.id, PREVIEW_TEXT);
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete(voice.id);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <CardContent className="p-0 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Mic2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium text-sm truncate">{voice.name}</span>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {MODE_LABELS[voice.mode]}
          </Badge>
        </div>

        {/* Status + progress */}
        <div className="flex flex-col gap-1.5">
          <Badge
            variant={STATUS_VARIANTS[voice.status]}
            className="w-fit text-xs"
          >
            {isProcessing ? (
              <span className="flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" />
                Processing
              </span>
            ) : (
              voice.status.charAt(0).toUpperCase() + voice.status.slice(1)
            )}
          </Badge>
          {isProcessing && jobStatus && (
            <Progress value={jobStatus.progress} className="h-1" />
          )}
        </div>

        {/* Description */}
        {voice.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {voice.description}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 gap-1 text-xs"
            disabled={!canPlay}
            onClick={handlePlay}
            aria-label={isPlaying ? "Stop preview" : "Play preview"}
          >
            {isPlaying ? (
              <Square className="size-3" />
            ) : (
              <Play className="size-3" />
            )}
            {isPlaying ? "Stop" : "Preview"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 gap-1 text-xs"
            onClick={() =>
              navigate({ to: "/studio/voices/$id", params: { id: voice.id } })
            }
            aria-label="Edit voice"
          >
            <Settings className="size-3" />
            Edit
          </Button>

          <div className="ml-auto">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  disabled={isDeleting}
                  aria-label="Delete voice"
                >
                  {isDeleting ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Trash2 className="size-3" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete voice</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{voice.name}" and all its
                    samples. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
