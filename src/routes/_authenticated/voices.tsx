import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/voices")({
  head: () => ({ meta: [{ title: "Voice Lab — Deep Call Prank" }] }),
  component: VoicesPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  training: "secondary",
  ready: "default",
  failed: "destructive",
};

function VoicesPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const voicesQuery = useQuery({
    queryKey: ["voice-models", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_models")
        .select("id, name, description, status, character_preset, source_language, target_language, sample_count, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/studio" })}>
          <ArrowLeft className="h-4 w-4" />
          Studio
        </Button>
        <h1 className="font-semibold">Voice Lab</h1>
        <div className="ml-auto">
          <Button asChild>
            <Link to="/voices/new"><Plus className="h-4 w-4" />New voice</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {voicesQuery.isLoading && <p className="text-muted-foreground">Loading…</p>}

        {voicesQuery.data?.length === 0 && (
          <Card className="border-dashed">
            <CardHeader>
              <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <CardTitle className="mt-2">No voices yet</CardTitle>
              <CardDescription>
                Train your first voice model by uploading clean speech samples (30s–2min works well).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/voices/new"><Plus className="h-4 w-4" />Create voice</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voicesQuery.data?.map((v) => (
            <Link key={v.id} to="/voices/$id" params={{ id: v.id }} className="block">
              <Card className="h-full transition hover:border-primary">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{v.name}</CardTitle>
                    <Badge variant={STATUS_VARIANT[v.status] ?? "outline"}>{v.status}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {v.description || (v.character_preset ? `Preset: ${v.character_preset}` : "No description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground flex justify-between">
                  <span>{v.source_language} → {v.target_language}</span>
                  <span>{v.sample_count} sample{v.sample_count === 1 ? "" : "s"}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
