import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { CHARACTER_PRESETS, LANGUAGES } from "@/lib/voice-presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RouteError, RouteNotFound } from "@/components/route-error";

export const Route = createFileRoute("/_authenticated/voices/new")({
  head: () => ({
    meta: [
      { title: "New voice — Deep Call Prank" },
      { name: "description", content: "Create a new voice model from samples." },
      { property: "og:title", content: "New voice — Deep Call Prank" },
    ],
  }),
  component: NewVoicePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function NewVoicePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [preset, setPreset] = useState("custom");
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("en");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      const { data, error } = await supabase
        .from("voice_models")
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          character_preset: preset === "custom" ? null : preset,
          source_language: sourceLang,
          target_language: targetLang,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      toast.success("Voice created. Upload samples next.");
      navigate({ to: "/voices/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/voices" })}>
          <ArrowLeft className="h-4 w-4" />
          Voice Lab
        </Button>
        <h1 className="font-semibold">New voice</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Describe the voice</CardTitle>
            <CardDescription>
              Choose a character preset and a target language. You'll add samples on the next screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Granny Edith" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes for your own reference."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Character preset</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHARACTER_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label} <span className="text-muted-foreground">· {p.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Source language</Label>
                <Select value={sourceLang} onValueChange={setSourceLang}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target language</Label>
                <Select value={targetLang} onValueChange={setTargetLang}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => navigate({ to: "/voices" })}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create voice
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
