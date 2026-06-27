import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/integrations/supabase/client";
import { voiceLibraryQueryKey } from "./useVoiceLibrary";
import type { VoiceJob } from "@/lib/voice-types";

type JobMap = Record<string, Pick<VoiceJob, "status" | "progress" | "error">>;

export function useVoiceJobStatus() {
  const qc = useQueryClient();
  const [jobStatuses, setJobStatuses] = useState<JobMap>({});
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("voice_jobs_status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "voice_jobs",
        },
        (payload) => {
          const job = payload.new as VoiceJob;
          setJobStatuses((prev) => ({
            ...prev,
            [job.id]: {
              status: job.status,
              progress: job.progress,
              error: job.error,
            },
          }));

          // Refresh voice library when a job finishes
          if (job.status === "succeeded" || job.status === "failed") {
            qc.invalidateQueries({ queryKey: voiceLibraryQueryKey });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return {
    jobStatuses,
    getJobStatus: (jobId: string) => jobStatuses[jobId] ?? null,
  };
}
