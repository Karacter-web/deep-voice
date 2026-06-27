import { useState } from "react";
import { Mic2, Plus } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { listVoiceProfiles } from "@/lib/voice-profiles.functions";
import { VoiceCard } from "@/components/voice-studio/VoiceCard";
import { CreateVoiceModal } from "@/components/voice-studio/CreateVoiceModal";
import { useVoiceLibrary, voiceLibraryQueryKey } from "@/hooks/useVoiceLibrary";
import { useVoiceJobStatus } from "@/hooks/useVoiceJobStatus";
import { useQuota } from "@/hooks/useQuota";

export const Route = createFileRoute("/_authenticated/studio/voices")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: voiceLibraryQueryKey,
      queryFn: () => listVoiceProfiles(),
    }),
  component: VoiceStudioPage,
  head: () => ({ meta: [{ title: "Voice studio" }] }),
});

function VoiceStudioPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { voices, isLoading, deleteVoice } = useVoiceLibrary();
  const { getJobStatus } = useVoiceJobStatus();
  const { quota, charsPct, isNearLimit, isAtLimit } = useQuota();

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      {/* Quota bar */}
      {quota && quota.used_chars > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {quota.used_chars.toLocaleString()} of{" "}
              {quota.monthly_chars.toLocaleString()} chars used this month
            </span>
            <span
              className={
                isAtLimit
                  ? "text-destructive font-medium"
                  : isNearLimit
                  ? "text-amber-500 font-medium"
                  : ""
              }
            >
              {charsPct}%
            </span>
          </div>
          <Progress
            value={charsPct}
            className={`h-1 ${isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-amber-500" : ""}`}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Voice studio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create and manage your voice models
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          disabled={isAtLimit}
          className="gap-2"
        >
          <Plus className="size-4" />
          Create voice
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : voices.length === 0 ? (
        <EmptyState onCreate={() => setModalOpen(true)} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {voices.map((voice) => (
            <VoiceCard
              key={voice.id}
              voice={voice}
              onDelete={deleteVoice}
              jobStatus={getJobStatus(voice.id)}
            />
          ))}
        </div>
      )}

      <CreateVoiceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={(id) => {
          setModalOpen(false);
          console.log("Voice created:", id);
        }}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="size-14 rounded-full bg-muted flex items-center justify-center">
        <Mic2 className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">Create your first voice</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Upload samples to clone a voice, design one with sliders, or describe
          it in plain text.
        </p>
      </div>
      <Button onClick={onCreate} className="gap-2">
        <Plus className="size-4" />
        Create voice
      </Button>
    </div>
  );
}
