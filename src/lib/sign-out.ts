import type { QueryClient } from "@tanstack/react-query";
import type { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sign-out hygiene: cancel in-flight queries → clear cache → signOut → navigate.
 * Prevents 401 storms against the cleared session and stops the back button
 * from restoring protected UI shells.
 */
export async function signOutClean(
  queryClient: QueryClient,
  navigate: ReturnType<typeof useNavigate>,
) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await supabase.auth.signOut();
  navigate({ to: "/auth", replace: true });
}
