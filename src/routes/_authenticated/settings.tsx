import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, TriangleAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { signOutClean } from "@/lib/sign-out";
import { deleteAccount } from "@/lib/account.functions";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const STT_MODELS = [
  { value: "whisper-tiny", label: "Whisper Tiny (fastest)" },
  { value: "whisper-base", label: "Whisper Base" },
  { value: "whisper-small", label: "Whisper Small" },
  { value: "whisper-medium", label: "Whisper Medium" },
  { value: "whisper-large-v3", label: "Whisper Large v3 (best)" },
];

function applyTheme(theme: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}

import { RouteError, RouteNotFound } from "@/components/route-error";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Deep Call Prank" },
      { name: "description", content: "Defaults for voice, STT model, theme, and account." },
      { property: "og:title", content: "Settings — Deep Call Prank" },
    ],
  }),
  component: SettingsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const deleteAccountFn = useServerFn(deleteAccount);

  const settingsQuery = useQuery({
    queryKey: ["user-settings", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("default_voice_model_id, stt_model, theme")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const voicesQuery = useQuery({
    queryKey: ["voice-models", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_models")
        .select("id, name, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [theme, setTheme] = useState("system");
  const [sttModel, setSttModel] = useState("whisper-base");
  const [defaultVoice, setDefaultVoice] = useState<string>("__none");
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (settingsQuery.data) {
      setTheme(settingsQuery.data.theme || "system");
      setSttModel(settingsQuery.data.stt_model || "whisper-base");
      setDefaultVoice(settingsQuery.data.default_voice_model_id || "__none");
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_settings")
        .update({
          theme,
          stt_model: sttModel,
          default_voice_model_id: defaultVoice === "__none" ? null : defaultVoice,
        })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["user-settings", user.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteAccountFn();
    },
    onSuccess: async () => {
      toast.success("Account deleted");
      await signOutClean(qc, navigate);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/studio" })}>
          <ArrowLeft className="h-4 w-4" />
          Studio
        </Button>
        <h1 className="font-semibold">Settings</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Defaults applied to new sessions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {THEMES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Speech-to-text model</Label>
              <Select value={sttModel} onValueChange={setSttModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STT_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Forwarded to your self-hosted <code>whisper.cpp</code> endpoint.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Default voice model</Label>
              <Select value={defaultVoice} onValueChange={setDefaultVoice}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {voicesQuery.data?.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} <span className="text-muted-foreground">· {v.status}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {voicesQuery.data?.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  You haven't trained any voices yet. Create one in Voice Lab.
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="h-4 w-4" />
              Danger zone
            </CardTitle>
            <CardDescription>
              Permanently delete your account, voice models, samples, and call history.
              This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Type <strong>DELETE</strong> to confirm. All your data and uploaded audio
                    will be removed immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmText !== "DELETE" || deleteMutation.isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      deleteMutation.mutate();
                    }}
                  >
                    {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Permanently delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
