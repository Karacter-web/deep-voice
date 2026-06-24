import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Radio, Settings, LogOut, Sparkles } from "lucide-react";
import { signOutClean } from "@/lib/sign-out";

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({ meta: [{ title: "Studio — Deep Call Prank" }] }),
  component: Studio,
});

function Studio() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-semibold tracking-tight inline-flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Mic className="h-4 w-4" />
          </span>
          Deep Call Prank
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={() => signOutClean(qc, navigate)}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to the lab</h1>
        <p className="text-muted-foreground mt-2">
          Your studio is ready. Voice Lab and live changer modules are coming online in later phases.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          <ComingSoon icon={<Sparkles className="h-5 w-5" />} title="Voice Lab" desc="Train, fine-tune, and save voice models." />
          <ComingSoon icon={<Radio className="h-5 w-5" />} title="Live Changer" desc="Stream mic → modified output in realtime." />
          <Link to="/profile" className="block">
            <Card className="h-full transition hover:border-primary">
              <CardHeader>
                <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
                  <Settings className="h-5 w-5" />
                </div>
                <CardTitle className="mt-2">Profile & Settings</CardTitle>
                <CardDescription>Manage your account, defaults, and avatar.</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-xs uppercase tracking-wider text-primary">Ready →</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}

function ComingSoon({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
          {icon}
        </div>
        <CardTitle className="mt-2">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Coming soon</span>
      </CardContent>
    </Card>
  );
}
