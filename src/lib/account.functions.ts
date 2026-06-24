import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Delete the calling user's account. Removes the auth.users row, which
 * cascades to profiles / user_roles / user_settings / voice_models /
 * voice_samples / call_sessions via the FK constraints set up in the
 * initial migration.
 *
 * Requires the service-role key — runs through supabaseAdmin and is
 * gated by requireSupabaseAuth so only the owning user can trigger it.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const userId = context.userId;

    // Best-effort cleanup of storage objects (RLS doesn't apply to admin).
    const buckets = ["voice-samples", "avatars"] as const;
    await Promise.all(
      buckets.map(async (bucket) => {
        const { data: list } = await supabaseAdmin.storage
          .from(bucket)
          .list(userId, { limit: 1000 });
        if (!list?.length) return;
        const paths = list.map((f) => `${userId}/${f.name}`);
        await supabaseAdmin.storage.from(bucket).remove(paths);
      }),
    );

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });
