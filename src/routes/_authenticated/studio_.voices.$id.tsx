import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Play, Square, Trash2, Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { RouteError, RouteNotFound } from "@/components/route-error";

import { getVoiceProfile, deleteVoiceProfile, updateVoiceProfile } from "@/lib/voice-profiles.functions";
import { useVoiceJobStatus, useVoiceStream } from "@/hooks/use-voice-studio";

export const Route = createFileRoute("/_authenticated/studio_/voices/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Voice ${params.id.slice(0, 8)} — Voice Studio` },
      { name: "description", content: "Edit, preview, and stream from this voice profile." },
    ],
  }),
  component: VoiceEditorPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const STATUS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline", processing: "secondary", ready: "default", failed: "destructive", archived: "outline",
};

function VoiceEditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getFn = useServerFn(getVoiceProfile);
  const delFn = useServerFn(deleteVoiceProfile);
  const updFn = useServerFn(updateVoiceProfile);

  const profileQ = useQuery({
    queryKey: ["voice-profile", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const job = useVoiceJobStatus(id);
  const stream = useVoiceStream();
  const [text, setText] = useState("Hello! This is a preview of my voice.");

  if (profileQ.isLoading) {
    return <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">
      <Skeleton className="h-8 w-1/3" /><Skeleton className="h-40 w-full" />
    </div>;
  }
  if (profileQ.isError || !profileQ.data) {
    return <div className="max-w-3xl mx-auto px-6 py-10">Voice not found.</div>;
  }
  const p = profileQ.data;
  const isProcessing = p.status === "processing" || (job && (job.status === "queued" || job.status === "running"));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/studio/voices"><ArrowLeft className="h-4 w-4" />Voices</Link>
        </Button>
        <h1 className="font-semibold truncate">{p.name}</h1>
        <Badge className="ml-2" variant={STATUS[p.status] ?? "outline"}>{p.status}</Badge>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
            <CardDescription>{p.description || `${p.mode} · ${p.language}`}</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Mode</span><div>{p.mode}</div></div>
            <div><span className="text-muted-foreground">Language</span><div>{p.language}</div></div>
            {p.gender && <div><span className="text-muted-foreground">Gender</span><div>{p.gender}</div></div>}
            {p.age && <div><span className="text-muted-foreground">Age</span><div>{p.age}</div></div>}
            {p.style && <div className="sm:col-span-2"><span className="text-muted-foreground">Style</span><div>{p.style}</div></div>}
          </CardContent>
        </Card>

        {isProcessing && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Processing
              </CardTitle>
              <CardDescription>
                {job ? `${job.kind} · ${job.status}` : "Queued"}
              </CardDescription>
            </CardHeader>
            <CardContent><Progress value={job?.progress ?? 10} /></CardContent>
          </Card>
        )}

        {job?.status === "failed" && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Job failed</CardTitle>
              <CardDescription>{job.error ?? "Unknown error"}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview &amp; stream</CardTitle>
            <CardDescription>Streams TTS audio gaplessly via SSE. Stubs to silence when HF endpoints are unset.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="synth-text">Text</Label>
              <Textarea id="synth-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              {!stream.playing ? (
                <Button onClick={() => stream.play({ profileId: p.id, text, language: p.language })} disabled={!text.trim()}>
                  <Play className="h-4 w-4" /> Play
                </Button>
              ) : (
                <Button variant="destructive" onClick={stream.stop}>
                  <Square className="h-4 w-4" /> Stop
                </Button>
              )}
              {stream.progress && (
                <span className="text-xs text-muted-foreground">
                  chunk {stream.progress.index + 1} / {stream.progress.total}
                </span>
              )}
            </div>
            {stream.error && <p className="text-sm text-destructive">{stream.error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Manage</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await updFn({ data: { id: p.id, patch: { status: "archived" } } });
                qc.invalidateQueries({ queryKey: ["voice-profile", id] });
                qc.invalidateQueries({ queryKey: ["voice-profiles"] });
                toast.success("Archived");
              }}
            >
              <Archive className="h-4 w-4" />Archive
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!confirm("Delete this voice profile? This cannot be undone.")) return;
                await delFn({ data: { id: p.id } });
                qc.invalidateQueries({ queryKey: ["voice-profiles"] });
                toast.success("Deleted");
                navigate({ to: "/studio/voices" });
              }}
            >
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
