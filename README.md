# Deep Call Prank

An open-source, AI-powered live voice changer & voice-cloning lab for developers experimenting with deep-fake / prank voice calls over Telegram, WhatsApp, Discord, and direct browser streams.

> **Educational / research use only.** See [Ethics & Legal](#ethics--legal).

---

## Features

- Email/password auth + Google & GitHub OAuth (via Supabase)
- Persistent sessions, profile management, settings
- **Voice Lab** — upload voice samples, train/fine-tune voice models, save & reuse
- In-browser live voice changer demo (mic → STT → voice transform → playback)
- Pluggable open-source backend: `whisper.cpp` for STT, `Coqui TTS` / `RVC` for voice conversion
- Call sessions log
- Secrets stored server-side (TanStack server functions + Supabase secrets) — never exposed to the client
- Row-Level Security on every table

---

## Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, TanStack Start (Router + Query), Tailwind v4, shadcn/ui |
| Backend | TanStack Start server functions (`createServerFn`) on Cloudflare Workers runtime |
| Database / Auth / Storage | Supabase (Postgres + RLS + Storage) |
| STT (recommended) | `whisper.cpp` (self-hosted) |
| Voice conversion (recommended) | Coqui TTS / RVC (self-hosted GPU) |

---

## Quick Start

```bash
# clone & install
git clone <your-fork>
cd deep-call-prank
npm install        # or: bun install

# run dev
npm run dev        # or: bun run dev
```

Open <http://localhost:8080>.

> The Lovable preview sandbox uses `bun` natively. For self-hosting outside Lovable, `npm` works equivalently — both lockfiles are kept in sync.

### Environment

The Supabase project is already connected. `.env` is auto-populated with:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

Server-only secrets (added via Lovable's secret manager, **never** committed):

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
LOVABLE_API_KEY
WHISPER_ENDPOINT          # your self-hosted whisper.cpp http server
RVC_ENDPOINT              # your self-hosted RVC / Coqui http server
```

---

## Enable OAuth Providers

OAuth buttons are wired in the UI but require provider configuration in your Supabase dashboard:

1. Open **Authentication → Providers** in Supabase.
2. Enable **Google** and **GitHub**.
3. Add your OAuth client IDs/secrets from Google Cloud Console / GitHub Developer Settings.
4. Add the redirect URL shown in Supabase to each provider's allowed callbacks.
5. Add your site URL under **Authentication → URL Configuration**.

---

## Database

All schema lives in `supabase/migrations/`. Tables:

| Table | Purpose |
| --- | --- |
| `profiles` | username, full name, avatar, bio (auto-created on signup) |
| `user_roles` | separate roles table (`admin` / `moderator` / `user`) — prevents privilege escalation |
| `voice_models` | saved voice models (name, language, character preset, status) |
| `voice_samples` | audio clips in `voice-samples/` bucket |
| `call_sessions` | live session log (provider, duration) |
| `user_settings` | per-user defaults & preferences |

Every table has RLS enforcing `auth.uid() = user_id`. Roles are checked via the `public.has_role()` security-definer function (no recursive RLS).

### Storage buckets

- `voice-samples` — private; user reads/writes only files under `{auth.uid()}/...`
- `avatars` — public; user writes only their own folder

---

## Self-Hosted Voice Backend

The browser cannot run live voice conversion at acceptable latency. Run these locally:

### 1. whisper.cpp (STT)

```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp && make
./models/download-ggml-model.sh base
./build/bin/whisper-server --model models/ggml-base.bin --host 0.0.0.0 --port 9000
```

Set `WHISPER_ENDPOINT=http://localhost:9000` as a server secret.

### 2. RVC / Coqui TTS (voice conversion)

Use the upstream projects' own install instructions:
- RVC WebUI: <https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI>
- Coqui TTS: <https://github.com/coqui-ai/TTS>

Expose an HTTP endpoint that accepts `{ audio, model_id, target_voice }` and returns transformed PCM/WAV bytes. Set `RVC_ENDPOINT` accordingly.

---

## Live Call Bridge (Telegram / WhatsApp / Discord)

**Browsers cannot inject audio into a third-party call app.** This requires a desktop bridge running locally:

```
  [Mic] → [Deep Call Prank desktop bridge]
        → whisper.cpp (STT)
        → RVC (voice convert)
        → [Virtual Audio Cable / BlackHole / VB-Cable]
        → [Telegram / WhatsApp / Discord input device]
```

Suggested stack:

| Platform | Bridge | Note |
| --- | --- | --- |
| Discord | `discord.py` voice bot, or virtual mic | Bot route is most TOS-friendly |
| Telegram | `pytdlib` userbot + virtual mic | Userbots violate Telegram TOS — risky |
| WhatsApp | virtual mic into WhatsApp Desktop | No official voice API |

A reference Python bridge is tracked in `TODO.md`.

---

## Sandbox / Security Hardening

For experimenting safely on a dev workstation:

- Run the voice backends in **Docker** with `--network=host` removed; expose only the HTTP port you need.
- Run the desktop call bridge inside a **separate user account** or a VM so the virtual audio cable can't bleed into your real microphone.
- Keep `SUPABASE_SERVICE_ROLE_KEY` and all third-party tokens in Lovable's secret manager — they are read only inside TanStack server functions (`process.env` on the server). They are never bundled into the browser.
- RLS is on for every table. The client uses the publishable (anon) key.
- Enable **Leaked Password Protection** in Supabase Auth settings (recommended).

---

## Project Scripts

```bash
npm run dev          # vite dev server
npm run build        # production build
npm run build:dev    # development-mode build (used by Lovable preview)
npm run lint         # eslint
npm run typecheck    # tsgo --noEmit
```

---

## Ethics & Legal

Voice cloning and live voice modification can be used to deceive people and commit fraud. This project is intended for:

- Security research & deep-fake detection work
- Comedy / prank calls **where all parties consent**
- Accessibility (voice restoration, language translation)
- Game / VR character voice

**You are responsible** for complying with local laws on impersonation, wiretapping, and recording consent. The authors accept no liability for misuse.

---

## License

[MIT](./LICENSE)
