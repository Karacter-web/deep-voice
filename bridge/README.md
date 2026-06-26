# Deep Call Prank — Desktop Bridge (reference)

The browser cannot inject audio into Discord / Telegram / WhatsApp Desktop.
This `bridge/` folder is a **reference Python implementation** that runs on
the user's machine and pipes audio:

```
mic → bridge → POST /api/public/bridge/stream → RVC → converted audio → virtual cable → target app
```

## What's here

- `mic_bridge.py` — captures the system mic, chunks audio, signs each
  request with HMAC-SHA256, and writes the converted audio to the default
  output device (or a virtual cable).
- `discord_bot.py` — `discord.py` voice client variant that streams
  converted audio into a Discord voice channel.
- `requirements.txt` — Python deps.

## Setup

1. **Virtual audio cable**
   - Windows: <https://vb-audio.com/Cable/>
   - macOS: <https://existential.audio/blackhole/>
   - Linux: `pactl load-module module-null-sink sink_name=DeepCall`
2. Point the target app's microphone input at the virtual cable.
3. `pip install -r requirements.txt`
4. Set environment variables (see below) and run `python mic_bridge.py`.

## Environment

| Variable | Description |
| --- | --- |
| `DEEPCALL_URL` | Base URL of the deployed app (e.g. `https://project--<id>.lovable.app`) |
| `DEEPCALL_USER_ID` | Supabase user id (from profile page) |
| `DEEPCALL_VOICE_ID` | Voice model id to convert into |
| `DEEPCALL_HMAC_SECRET` | Same value as the server's `BRIDGE_HMAC_SECRET` |
| `DEEPCALL_OUTPUT_DEVICE` | Optional sounddevice index for the virtual cable |

## Signature scheme

For every chunk POSTed to `/api/public/bridge/stream`:

```
ts        = int(time.time())
body_hash = sha256(audio_bytes).hexdigest()
sig       = hmac_sha256(secret, f"{ts}.{user_id}.{voice_id}.{body_hash}").hexdigest()
```

Sent as headers:

```
X-Bridge-User:      <user_id>
X-Bridge-Voice:     <voice_id>
X-Bridge-Timestamp: <ts>
X-Bridge-Signature: <sig>
Content-Type:       audio/webm        # or audio/wav
```

The server rejects requests older than 5 minutes and rate-limits each
user to 120 requests/minute.

## Ethics

You are responsible for getting consent from every party on a call before
using this. See `../README.md` and `../SECURITY.md`.
