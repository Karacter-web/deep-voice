import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createVoiceProfile } from "@/lib/voice-profiles.functions";
import { dispatchVoiceJob } from "@/lib/voice-jobs.functions";
import type { VoiceProfile } from "@/lib/voice-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (profile: VoiceProfile) => void;
}

export function CreateVoiceModal({ open, onOpenChange, onCreated }: Props) {
  const createFn = useServerFn(createVoiceProfile);
  const dispatchFn = useServerFn(dispatchVoiceJob);
  const qc = useQueryClient();

  const [mode, setMode] = useState<"clone" | "design" | "instant">("clone");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("en");
  const [gender, setGender] = useState("neutral");
  const [age, setAge] = useState("adult");
  const [style, setStyle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName(""); setDescription(""); setStyle(""); setPrompt("");
  };

  async function submit() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    try {
      const params: Record<string, unknown> = {};
      if (mode === "design") Object.assign(params, { gender, age, style });
      if (mode === "instant") Object.assign(params, { prompt });

      const profile = await createFn({
        data: {
          name, description: description || undefined, mode, language,
          gender: mode === "design" ? gender : undefined,
          age: mode === "design" ? age : undefined,
          style: mode === "design" ? style : undefined,
          params,
        },
      });

      const kind = mode === "clone" ? "clone_train" : mode === "design" ? "design_synth" : "instant_generate";
      await dispatchFn({
        data: { profileId: profile.id, kind, input: params as never },
      });

      toast.success("Voice queued for processing");
      qc.invalidateQueries({ queryKey: ["voice-profiles"] });
      onCreated?.(profile);
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create voice");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create voice</DialogTitle>
          <DialogDescription>Clone an existing voice, design one from traits, or describe it in plain English.</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="clone">Clone</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="instant">Instant</TabsTrigger>
          </TabsList>

          <div className="grid gap-3 mt-4">
            <div className="grid gap-1.5">
              <Label htmlFor="v-name">Name</Label>
              <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My voice" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="v-desc">Description (optional)</Label>
              <Input id="v-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["en","es","fr","de","it","pt","pl","tr","ru","nl","cs","ar","zh","ja","ko","hi"].map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TabsContent value="clone" className="m-0">
              <p className="text-sm text-muted-foreground">
                After creation you'll upload reference samples on the voice's page. 30s of clean speech is enough for XTTS.
              </p>
            </TabsContent>

            <TabsContent value="design" className="m-0 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["male","female","neutral"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Age</Label>
                  <Select value={age} onValueChange={setAge}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["child","young","adult","elderly"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-style">Style</Label>
                <Input id="v-style" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="warm, calm, narrator" />
              </div>
            </TabsContent>

            <TabsContent value="instant" className="m-0 grid gap-1.5">
              <Label htmlFor="v-prompt">Describe the voice</Label>
              <Textarea
                id="v-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A gravelly British detective in his 60s, slow and weary."
                rows={4}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create voice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
