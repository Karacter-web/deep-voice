import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createVoiceProfile,
  deleteVoiceProfile,
  listVoiceProfiles,
} from "@/lib/voice-profiles.functions";

export const voiceLibraryQueryKey = ["voice-profiles"] as const;

export function useVoiceLibrary() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: voiceLibraryQueryKey,
    queryFn: () => listVoiceProfiles(),
  });

  const createMutation = useMutation({
    mutationFn: createVoiceProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: voiceLibraryQueryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVoiceProfile({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: voiceLibraryQueryKey }),
  });

  return {
    voices: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    createVoice: (payload: Parameters<typeof createVoiceProfile>[0]["data"]) =>
      createMutation.mutateAsync({ data: payload }),
    deleteVoice: (id: string) => deleteMutation.mutateAsync(id),
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
