# Deep Call Prank — TODO

Tracking remaining work for v1 and beyond.

## Phase 1 — Foundations ✅
- [x] DB schema: profiles, user_roles, voice_models, voice_samples, call_sessions, user_settings
- [x] RLS policies on every table (`auth.uid() = user_id`)
- [x] `has_role()` security-definer function for role checks
- [x] Auto-create profile + default role + settings trigger on signup
- [x] Storage buckets: `voice-samples` (private), `avatars` (public) with RLS
- [x] README, TODO, LICENSE

## Phase 2 — Auth & Shell ✅
- [x] `/auth` page — sign in / sign up tabs (full name, username, email, password)
- [x] Google OAuth button (via Supabase `signInWithOAuth`)
- [x] GitHub OAuth button
- [x] Root `onAuthStateChange` listener (filter to `SIGNED_IN`/`SIGNED_OUT`/`USER_UPDATED`)
- [x] `_authenticated/` route layout (ssr: false, redirect to `/auth`)
- [x] Sign-out hygiene (cancel queries → clear cache → signOut → navigate) — `src/lib/sign-out.ts`
- [x] Placeholder `/studio` landing inside the protected subtree

## Phase 3 — Landing Page ✅
- [x] Hero: "Speak naturally. They hear someone else."
- [x] Feature grid: Voice Lab, Live Changer, Bridge Reference
- [x] How-it-works 4-step diagram (Capture → Transcribe → Convert → Route)
- [x] Ethics disclaimer block
- [x] CTA → `/auth`

## Phase 4 — Profile & Settings ✅
- [x] `/profile` — view/edit username, full_name, bio, avatar upload to `avatars` bucket
- [x] `/settings` — default voice model selector, STT model, theme
- [x] Account deletion (server function `deleteAccount` via `supabaseAdmin` + `requireSupabaseAuth`)
- [x] `SECURITY.md` disclosure policy

## Phase 5 — Voice Lab
- [ ] `/voices` — list user's voice models with status badges
- [ ] `/voices/new` — create model (name, source lang, target lang, character preset)
- [ ] `/voices/$id` — model detail
  - [ ] Upload samples (drag-drop, mic record) → `voice-samples/{uid}/{modelId}/...`
  - [ ] Sample list with playback, transcript preview, delete
  - [ ] "Train" button → server function dispatches to `RVC_ENDPOINT`, updates status
  - [ ] "Test voice" — synth a phrase
- [ ] Character presets seed (anime girl, deep villain, robotic, child, elderly, etc.)

## Phase 6 — Live Voice Changer (browser demo)
- [ ] `/studio` page
- [ ] `MediaRecorder` mic capture in chunks (webm/mp4)
- [ ] Server function `transcribeChunk()` → forwards to `WHISPER_ENDPOINT`
- [ ] Server function `convertVoice()` → forwards to `RVC_ENDPOINT`
- [ ] Streaming SSE for partial transcripts
- [ ] Playback in browser via `AudioContext`
- [ ] Push session row into `call_sessions`

## Phase 7 — Server functions & secrets
- [ ] `src/lib/whisper.functions.ts` — `transcribeAudio({data})`
- [ ] `src/lib/voice.functions.ts` — `convertVoice`, `synthesize`, `dispatchTraining`
- [ ] `src/lib/voices.functions.ts` — CRUD wrappers using `requireSupabaseAuth`
- [ ] Add secrets via Lovable secret manager: `WHISPER_ENDPOINT`, `RVC_ENDPOINT`
- [ ] Optional: `ELEVENLABS_API_KEY` fallback

## Phase 8 — Desktop call bridge (out-of-repo reference)
- [ ] `bridge/` Python reference implementation
  - [ ] Mic capture → chunked POST to app's `/api/public/bridge/stream`
  - [ ] Receive converted audio → write to virtual cable
  - [ ] Discord bot variant (`discord.py`)
  - [ ] Setup docs for VB-Cable (Win), BlackHole (Mac), PulseAudio loopback (Linux)
- [ ] Public server route `src/routes/api/public/bridge/stream.ts` with HMAC signature verify

## Phase 9 — Polish
- [ ] Sitemap.xml + robots.txt
- [ ] OG metadata per route
- [ ] Empty states & loading skeletons
- [ ] Toast notifications (sonner)
- [ ] Mobile responsive pass
- [ ] Error boundary on every route with loader

## Phase 10 — Hardening
- [ ] Rate limit voice-conversion server functions per user
- [ ] Audit log table for sensitive actions
- [ ] Enable Supabase **Leaked Password Protection** (Auth settings)
- [ ] Upgrade Postgres to latest patch (Supabase dashboard → Database → Upgrades)
- [ ] Watermark generated audio (inaudible spread-spectrum tag) for traceability
- [ ] Add explicit consent checkbox before any call session starts

## Suggested Implementations / References

- **Whisper streaming**: <https://github.com/ggerganov/whisper.cpp/tree/master/examples/server>
- **RVC realtime**: <https://github.com/w-okada/voice-changer>
- **Coqui XTTS v2** (zero-shot voice cloning): <https://github.com/coqui-ai/TTS>
- **Discord voice bot**: <https://discordpy.readthedocs.io/en/stable/api.html#voice>
- **Virtual audio**: VB-CABLE, BlackHole, PulseAudio `module-null-sink`
- **Deep-fake detection** (for the ethics defense angle): <https://github.com/yuezunli/celeb-deepfakeforensics>

## Known Limitations / Non-Goals

- Live voice injection into Telegram / WhatsApp / Discord **cannot** run from a browser. Always requires a local bridge.
- Telegram userbots violate TOS. We document the approach but ship the Discord-bot route only.
- WhatsApp has no official voice API; only the virtual-mic + WhatsApp Desktop route works.
- We never proxy a user's call audio through our servers without explicit consent recorded in `call_sessions.metadata`.
