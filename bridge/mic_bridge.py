"""Mic → DeepCall → virtual cable bridge.

Captures audio in short chunks, POSTs each chunk to the app's
`/api/public/bridge/stream` endpoint with an HMAC signature, and plays
the converted response on the configured output device.

Reference implementation only — no warranty, see SECURITY.md.
"""
from __future__ import annotations

import hashlib
import hmac
import io
import os
import time
import wave
from typing import Optional

import numpy as np
import requests
import sounddevice as sd
from dotenv import load_dotenv

load_dotenv()

URL = os.environ["DEEPCALL_URL"].rstrip("/") + "/api/public/bridge/stream"
USER_ID = os.environ["DEEPCALL_USER_ID"]
VOICE_ID = os.environ["DEEPCALL_VOICE_ID"]
SECRET = os.environ["DEEPCALL_HMAC_SECRET"].encode()
OUTPUT_DEVICE: Optional[int] = (
    int(os.environ["DEEPCALL_OUTPUT_DEVICE"])
    if os.environ.get("DEEPCALL_OUTPUT_DEVICE")
    else None
)

SAMPLE_RATE = 16_000
CHUNK_SECONDS = 2.0


def encode_wav(samples: np.ndarray) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes((samples * 32767).astype("<i2").tobytes())
    return buf.getvalue()


def sign(ts: int, body: bytes) -> str:
    body_hash = hashlib.sha256(body).hexdigest()
    msg = f"{ts}.{USER_ID}.{VOICE_ID}.{body_hash}".encode()
    return hmac.new(SECRET, msg, hashlib.sha256).hexdigest()


def post_chunk(body: bytes) -> bytes:
    ts = int(time.time())
    headers = {
        "Content-Type": "audio/wav",
        "X-Bridge-User": USER_ID,
        "X-Bridge-Voice": VOICE_ID,
        "X-Bridge-Timestamp": str(ts),
        "X-Bridge-Signature": sign(ts, body),
    }
    r = requests.post(URL, data=body, headers=headers, timeout=30)
    r.raise_for_status()
    return r.content


def play(audio_bytes: bytes) -> None:
    # Assume the server returned a WAV; decode to int16 mono.
    with wave.open(io.BytesIO(audio_bytes), "rb") as w:
        frames = w.readframes(w.getnframes())
        rate = w.getframerate()
    samples = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32767.0
    sd.play(samples, samplerate=rate, device=OUTPUT_DEVICE, blocking=True)


def main() -> None:
    print(f"[deepcall] streaming to {URL} as voice {VOICE_ID}")
    frames_per_chunk = int(SAMPLE_RATE * CHUNK_SECONDS)
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32") as stream:
        while True:
            samples, _ = stream.read(frames_per_chunk)
            wav = encode_wav(samples[:, 0])
            try:
                converted = post_chunk(wav)
                play(converted)
            except Exception as e:  # noqa: BLE001
                print(f"[deepcall] chunk failed: {e}")


if __name__ == "__main__":
    main()
