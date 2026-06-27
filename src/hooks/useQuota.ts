import { useQuery } from "@tanstack/react-query";
import { getVoiceQuota } from "@/lib/voice-profiles.functions";

export const quotaQueryKey = ["voice-quota"] as const;

export function useQuota() {
  const query = useQuery({
    queryKey: quotaQueryKey,
    queryFn: () => getVoiceQuota(),
    staleTime: 30_000,
  });

  const quota = query.data;
  const charsPct = quota
    ? Math.round((quota.used_chars / Math.max(quota.monthly_chars, 1)) * 100)
    : 0;
  const secsPct = quota
    ? Math.round((quota.used_seconds / Math.max(quota.monthly_seconds, 1)) * 100)
    : 0;

  return {
    quota,
    isLoading: query.isLoading,
    charsPct,
    secsPct,
    isNearLimit: charsPct >= 80,
    isAtLimit: charsPct >= 100,
  };
}
