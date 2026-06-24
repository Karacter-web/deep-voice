import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Mic,
  Radio,
  Wand2,
  ShieldAlert,
  ArrowRight,
  Waves,
  MessageSquare,
  Phone,
  Bot,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Deep Call Prank — AI voice changer for live calls" },
      {
        name: "description",
        content:
          "Educational dev tool: speak naturally, the other end hears a modified voice. Voice Lab, live browser changer, and Discord/Telegram bridge reference.",
      },
      { property: "og:title", content: "Deep Call Prank — AI voice changer for live calls" },
      {
        property: "og:description",
        content:
          "Train a voice, stream your mic, and ship the bridge — open-source whisper.cpp + RVC stack.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Mic className="h-4 w-4" />
          </span>
          Deep Call Prank
        </Link>
        <nav className="flex items-center gap-2">
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline"
          >
            GitHub
          </a>
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">Get started</Link>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="px-6 pt-20 pb-24 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Waves className="h-3 w-3" />
          Open-source · whisper.cpp + RVC
        </div>
        <h1 className="mt-6 text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
          Speak naturally.
          <br />
          <span className="text-primary">They hear someone else.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          An educational deep-voice / prank-call dev tool. Train a target voice, route your mic
          through a live converter, and pipe the output into Discord, WhatsApp Desktop, or any
          softphone — for consensual fun and detection research.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">
              Launch the lab <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="#how">See how it works</a>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-4">
          <Feature
            icon={<Wand2 className="h-5 w-5" />}
            title="Voice Lab"
            desc="Compose, fine-tune, and save target voices. Upload samples or record mic clips and let RVC/Coqui learn the timbre."
          />
          <Feature
            icon={<Radio className="h-5 w-5" />}
            title="Live Changer"
            desc="Browser mic → whisper.cpp STT → voice convert → playback, all streamed. Latency-tuned for real conversations."
          />
          <Feature
            icon={<Bot className="h-5 w-5" />}
            title="Bridge Reference"
            desc="Discord bot + virtual-cable docs (VB-Cable, BlackHole, PulseAudio) so the modified voice reaches the call."
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-6 pb-24 max-w-5xl mx-auto">
        <h2 className="text-3xl font-semibold tracking-tight text-center">How it works</h2>
        <p className="text-muted-foreground text-center mt-2">
          Four stages, all running on open-source models you control.
        </p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Step n={1} icon={<Mic className="h-4 w-4" />} title="Capture" desc="Mic → 200ms PCM chunks via MediaRecorder." />
          <Step n={2} icon={<MessageSquare className="h-4 w-4" />} title="Transcribe" desc="whisper.cpp streaming SST keeps context." />
          <Step n={3} icon={<Wand2 className="h-4 w-4" />} title="Convert" desc="RVC / Coqui XTTS swaps timbre to the trained voice." />
          <Step n={4} icon={<Phone className="h-4 w-4" />} title="Route" desc="Output to virtual cable → Discord/WA Desktop." />
        </div>
      </section>

      {/* Ethics */}
      <section className="px-6 pb-24 max-w-3xl mx-auto">
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-foreground">Use this responsibly.</p>
                <p className="text-muted-foreground">
                  This tool exists for security research, accessibility experiments, and consensual
                  pranks. Impersonating someone to defraud, harass, or deceive — including
                  unconsented recording — is illegal in most jurisdictions. Every call session
                  requires an explicit consent flag. Generated audio carries a traceability tag.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
        MIT licensed · Built for devs, not for fraud.
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
        <h3 className="mt-4 font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

function Step({ n, icon, title, desc }: { n: number; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
          {n}
        </span>
        {icon}
      </div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
