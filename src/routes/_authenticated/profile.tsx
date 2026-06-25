import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RouteError, RouteNotFound } from "@/components/route-error";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Deep Call Prank" },
      { name: "description", content: "Edit your username, name, bio, and avatar." },
      { property: "og:title", content: "Profile — Deep Call Prank" },
    ],
  }),
  component: ProfilePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const profileQuery = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, bio, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (profileQuery.data) {
      setUsername(profileQuery.data.username ?? "");
      setFullName(profileQuery.data.full_name ?? "");
      setBio(profileQuery.data.bio ?? "");
    }
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: username.trim() || null,
          full_name: fullName.trim() || null,
          bio: bio.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: pub.publicUrl })
        .eq("id", user.id);
      if (error) throw error;
      return pub.publicUrl;
    },
    onSuccess: () => {
      toast.success("Avatar updated");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (fullName || username || user.email || "?")
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/studio" })}>
          <ArrowLeft className="h-4 w-4" />
          Studio
        </Button>
        <h1 className="font-semibold">Profile</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Avatar</CardTitle>
            <CardDescription>PNG, JPG, or WebP. Stored in the public <code>avatars</code> bucket.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profileQuery.data?.avatar_url ?? undefined} alt="" />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) avatarMutation.mutate(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={avatarMutation.isPending}
              >
                {avatarMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload new
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>How others see you inside the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. nightowl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder="Voice tinkerer, occasional prankster."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button asChild variant="ghost">
                <Link to="/settings">Open settings →</Link>
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
