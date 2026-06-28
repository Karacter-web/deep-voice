import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus, Sparkles, Mic, Wand2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { RouteError, RouteNotFound } from "@/components/route-error";
import { CreateVoiceModal } from "@/components/voice-studio/create-voice-modal";
import { useQuota, useVoiceLibrary } from "@/hooks/use-voice-studio";

export const Route = createFileRoute("/_authenticated/studio_/voices")({
  head: () => ({
    meta: [
      { title: "Voice Studio — Deep Call Prank" },
      { name: "description", content: "Create and manage AI voice profiles: clone, design, or describe." },
      { property: "og:title", content: "Voice Studio — Deep Call Prank" },
      { property: "og:description", content: "Clone, design, or describe voices and stream them with low latency." },
    ],
  }),
  component: VoiceStudioPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const STATUS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline", processing: "secondary", ready: "default", failed: "destructive", archived: "outline",
};
const MODE_ICON: Record<string, typeof Mic> = { clone: Mic, design: Wand2, instant: MessageSquare };

function VoiceStudioPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const lib = useVoiceLibrary();
  const quota = useQuota();

  const pctChars = quota.data
    ? Math.min(100, Math.round((quota.data.used_chars / Math.max(1, quota.data.monthly_chars)) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/studio" })}>
          <ArrowLeft className="h-4 w-4" /> Studio
        </Button>
        <h1 className="font-semibold">Voice Studio</h1>
        <div className="ml-auto">
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New voice</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly usage</CardTitle>
            <CardDescription>
              {quota.data
                ? `${quota.data.used_chars.toLocaleString()} / ${quota.data.monthly_chars.toLocaleString()} characters used · tier: ${quota.data.tier}`
                : "Loading quota…"}
            </CardDescription>
          </CardHeader>
          <CardContent><Progress value={pctChars} /></CardContent>
        </Card>

        {lib.isLoading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
          </div>
        )}

        {lib.data?.length === 0 && (
          <Card className="border-dashed">
            <CardHeader>
              <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <CardTitle className="mt-2">No voices yet</CardTitle>
              <CardDescription>Clone a reference sample, design from traits, or describe one in plain English.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Create your first voice</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lib.data?.map((p) => {
            const Icon = MODE_ICON[p.mode] ?? Sparkles;
            return (
              <Link key={p.id} to="/studio/voices/$id" params={{ id: p.id }} className="block">
                <Card className="h-full transition hover:border-primary">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">{p.name}</CardTitle>
                      </div>
                      <Badge variant={STATUS[p.status] ?? "outline"}>{p.status}</Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {p.description || `${p.mode} · ${p.language}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Updated {new Date(p.updated_at).toLocaleDateString()}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>

      <CreateVoiceModal
        open={open}
        onOpenChange={setOpen}
        onCreated={(p) => navigate({ to: "/studio/voices/$id", params: { id: p.id } })}
      />
    </div>
  );
}
