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

## Phase 5 — Voice Lab ✅
- [x] `/voices` — list user's voice models with status badges
- [x] `/voices/new` — create model (name, source lang, target lang, character preset)
- [x] `/voices/$id` — model detail
  - [x] Upload samples (drag-drop file picker, mic record) → `voice-samples/{uid}/{modelId}/...`
  - [x] Sample list with playback (signed URL), delete
  - [x] Transcript preview per sample (on-demand button → Whisper)
  - [x] "Train" button → server function dispatches to `RVC_ENDPOINT`, updates status
  - [x] "Test voice" — synth a phrase via `synthesizePhrase`
- [x] Character presets (anime girl, deep villain, robotic, child, elderly, narrator, newscaster) in `src/lib/voice-presets.ts`

## Phase 6 — Live Voice Changer (browser demo) ✅
- [x] `/studio` page rewritten as live changer
- [x] `MediaRecorder` mic capture in 4s chunks (webm)
- [x] Server function `transcribeChunk()` → forwards to `WHISPER_ENDPOINT`
- [x] Server function `convertVoice()` → forwards to `RVC_ENDPOINT`
- [x] Streaming SSE for partial transcripts (`/api/stream/transcribe`)
- [x] Playback in browser via `Audio` element / `AudioContext`
- [x] Push session row into `call_sessions` (start/end server fns)
- [x] Consent checkbox before any session starts

## Phase 7 — Server functions & secrets
- [x] `src/lib/audio.functions.ts` — `transcribeChunk`, `transcribeSample`, `convertVoice`, `startCallSession`, `endCallSession`
- [x] `src/lib/voices.functions.ts` — `dispatchTraining`, `synthesizePhrase`
- [x] `src/routes/api/stream.transcribe.ts` — SSE proxy to Whisper
- [x] Add secrets via Lovable secret manager: `WHISPER_ENDPOINT`, `RVC_ENDPOINT`
- [ ] Optional: `ELEVENLABS_API_KEY` fallback

## Phase 8 — Desktop call bridge (out-of-repo reference)
- [x] `bridge/` Python reference implementation
  - [x] Mic capture → chunked POST to app's `/api/public/bridge/stream` (`bridge/mic_bridge.py`)
  - [x] Receive converted audio → write to virtual cable / default device
  - [x] Discord bot variant (`bridge/discord_bot.py`)
  - [x] Setup docs for VB-Cable (Win), BlackHole (Mac), PulseAudio loopback (Linux) — see `bridge/README.md`
- [x] Public server route `src/routes/api/public/bridge/stream.ts` with HMAC signature verify (+ replay protection + per-user rate limit)

## Phase 9 — Polish
- [x] Sitemap.xml + robots.txt
- [x] OG metadata per route
- [x] Empty states & loading skeletons
- [x] Toast notifications (sonner)
- [x] Mobile responsive pass
- [x] Error boundary on every route with loader

## Phase 10 — Hardening
- [x] Rate limit voice-conversion server functions per user (`src/lib/rate-limit.ts`, applied to `convertVoice`, `transcribeChunk`, and the bridge route). **Note:** in-memory per-worker limiter, not durable — back with Redis/Postgres for production.
- [x] Audit log table for sensitive actions — SQL provided at `docs/audit-log.sql` for manual review (schema kept unchanged per user request)
- [ ] Enable Supabase **Leaked Password Protection** (Auth settings → Password Strength) — dashboard-only
- [ ] Upgrade Postgres to latest patch (Supabase dashboard → Database → Upgrades) — dashboard-only
- [x] Watermark generated audio with signed provenance token (`src/lib/watermark.ts` — WAV `LIST/INFO/ICMT` chunk, HMAC over user + voice + session + issuedAt). Spread-spectrum DSP embedding remains a future upgrade.
- [x] Add explicit consent checkbox before any call session starts
- [x] Generated `BRIDGE_HMAC_SECRET` for signed bridge ingress

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

## Phase 11 — Voice Studio (Pass A: schema + server) ✅
- [x] Schema staged at `docs/voice-studio-schema.sql` — apply manually in Supabase SQL editor:
  - `voice_profiles`, `voice_embeddings` (pgvector, 192-d), `voice_jobs`, `voice_usage_logs`, `voice_quotas`
  - `ensure_voice_quota` + `consume_voice_quota` SQL helpers (security definer)
  - RLS owner-only policies + `service_role` grants
  - `voice_jobs` added to `supabase_realtime` publication
- [x] `src/lib/voice-types.ts` — `VoiceProfile`, `VoiceJob`, `VoiceQuota`, local `Json` type
- [x] `src/lib/voice-profiles.functions.ts` — CRUD: `listVoiceProfiles`, `getVoiceProfile`, `createVoiceProfile`, `updateVoiceProfile`, `deleteVoiceProfile`, `getVoiceQuota`
- [x] `src/lib/voice-jobs.functions.ts` — `dispatchVoiceJob` + `runOneVoiceJob` worker. Stubs `clone_train` / `design_synth` / `instant_generate` / `enhance` / `diarize` / `preview` when HF endpoints missing. Instant mode uses Lovable AI Gateway (`google/gemini-2.5-flash`) to derive voice params from a text prompt.
- [x] `src/lib/smart-chunker.ts` — sentence-aware chunker for streaming TTS
- [x] `src/routes/api/stream.synth.ts` — SSE TTS endpoint, per-chunk quota enforcement via `consume_voice_quota`, usage logged to `voice_usage_logs`. Emits silence stubs when `HF_XTTS_SPACE_URL` is unset.
- [ ] **Pending user action**: run `docs/voice-studio-schema.sql` in Supabase SQL editor before Pass B UI ships.

## Phase 12 — Voice Studio (Pass B: React UI) ✅
- [x] `/studio/voices` library grid + monthly-usage card (`src/routes/_authenticated/studio_.voices.tsx`)
- [x] `CreateVoiceModal` with Clone / Design / Instant tabs (`src/components/voice-studio/create-voice-modal.tsx`)
- [x] `/studio/voices/$id` editor — details, live job status, streaming preview, archive/delete (`src/routes/_authenticated/studio_.voices.$id.tsx`)
- [x] Hooks (`src/hooks/use-voice-studio.ts`): `useVoiceLibrary`, `useQuota`, `useVoiceJobStatus` (Supabase Realtime on `voice_jobs`), `useVoiceStream` (SSE + AudioContext gapless playback)
- [x] Routes use `studio_.voices*` trailing-underscore to opt out of the live-changer `/studio` layout

## Phase 13 — Create Voice UX (Clone samples) ✅
- [x] Drag/drop + file-picker upload in Clone tab (MP3/WAV/M4A/WEBM/FLAC, 25MB cap)
- [x] In-browser mic recording via `MediaRecorder` (webm/opus)
- [x] Enforce 5–15 samples before enabling "Create voice"
- [x] Per-sample inline audio player + remove button
- [x] Upload to `voice-samples/{uid}/{profileId}/…` and pass `sample_paths` into `clone_train`

## Phase 14 — Sample quality & guidance (next)
- [ ] Client-side audio validation: duration (min 3s / max 30s per clip), sample rate ≥ 16 kHz, mono check
- [ ] Loudness normalization preview (Web Audio `AnalyserNode` RMS + peak meter while recording)
- [ ] Auto-trim leading/trailing silence before upload (VAD via `@ricky0123/vad-web` or simple energy gate)
- [ ] Waveform thumbnail per sample (wavesurfer.js or custom canvas)
- [ ] Prompt user with a scripted read-aloud passage (phonetically balanced, ~30s) to hit coverage
- [ ] Quality score badge per clip (SNR estimate, clipping detector, background-noise warning)
- [ ] Resumable/chunked uploads with progress bars (tus-js-client or Supabase resumable uploads)
- [ ] Server-side re-encode to 24 kHz mono WAV via HF enhance space before training

## Phase 15 — Voice Studio polish
- [ ] Bulk sample management on `/studio/voices/$id` (add/replace/delete after creation, retrain button)
- [ ] "Regenerate preview" with custom text on the profile page
- [ ] Compare A/B previews between two profiles side-by-side
- [ ] Tag / favorite / search voices in the library
- [ ] Import from URL (YouTube/podcast clip) with an explicit "I have rights to this audio" checkbox
- [ ] Public voice marketplace (opt-in `is_public`, browse gallery, clone count)
- [ ] Per-profile pinned default settings (pitch, speed, style) applied to streaming synth

## Phase 16 — Realtime & platform
- [ ] Replace in-memory rate limiter with Postgres-backed token bucket (durable across workers)
- [ ] WebRTC path for live changer (lower latency than MediaRecorder 4s chunks)
- [ ] Barge-in / interrupt handling on streaming synth
- [ ] Multi-speaker diarized playback (route each speaker to a different voice)
- [ ] Background job queue via `pg_cron` hitting `/api/public/run-jobs` (retry + dead-letter)
- [ ] Webhook out on job state changes (`voice_jobs.status`)

## Phase 17 — Safety, provenance, compliance
- [ ] Mandatory consent recording: user must record themselves saying a one-time challenge phrase before cloning any voice (liveness + intent proof)
- [ ] Deepfake watermark verification tool page (`/verify` — upload audio, extract HMAC token)
- [ ] Blocklist of public-figure voice fingerprints (embedding similarity check against banlist before training)
- [ ] Per-user daily generation cap + abuse-report endpoint
- [ ] GDPR export/delete: single-click account data dump (profiles, samples, jobs, usage)
- [ ] Audit-log UI at `/settings/audit` reading `docs/audit-log.sql` table

## Phase 18 — Billing & tiers
- [ ] Stripe integration for tier upgrades (free / pro / studio) driving `voice_quotas.tier`
- [ ] Usage dashboard (chars/seconds over time, per-voice breakdown)
- [ ] Overage handling — soft cap with grace or hard stop per tier
- [ ] Prepaid credit packs for one-off heavy jobs (enhance, diarize)

## Phase 19 — DX & ops
- [ ] Playwright E2E: signup → create clone voice → stream preview
- [ ] Vitest unit tests for `smart-chunker`, `rate-limit`, `watermark`
- [ ] Sentry (or equivalent) wiring in `error-capture.ts`
- [ ] Structured logging with request IDs across server functions
- [ ] Storybook for `voice-studio/*` components
