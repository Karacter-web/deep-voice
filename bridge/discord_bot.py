"""Discord voice variant of the DeepCall bridge.

Joins the configured Discord voice channel, captures the user's mic via
sounddevice, sends each chunk through the DeepCall server, and plays the
converted audio back into the voice channel.

Requires a bot token + `discord.py[voice]` + opus libs installed on the
host. Reference implementation only.
"""
from __future__ import annotations

import asyncio
import io
import os
import wave

import discord
import numpy as np
import sounddevice as sd
from discord.ext import commands

from mic_bridge import CHUNK_SECONDS, SAMPLE_RATE, encode_wav, post_chunk

TOKEN = os.environ["DEEPCALL_DISCORD_TOKEN"]
GUILD_ID = int(os.environ["DEEPCALL_DISCORD_GUILD"])
CHANNEL_ID = int(os.environ["DEEPCALL_DISCORD_VOICE_CHANNEL"])

intents = discord.Intents.default()
intents.voice_states = True
bot = commands.Bot(command_prefix="!", intents=intents)


class WavSource(discord.AudioSource):
    def __init__(self, data: bytes) -> None:
        with wave.open(io.BytesIO(data), "rb") as w:
            self._rate = w.getframerate()
            self._frames = w.readframes(w.getnframes())
        self._pos = 0
        # discord wants 48kHz stereo s16le 20ms frames; resample naïvely.
        samples = np.frombuffer(self._frames, dtype="<i2").astype(np.float32)
        if self._rate != 48_000:
            ratio = 48_000 / self._rate
            new_len = int(len(samples) * ratio)
            samples = np.interp(
                np.linspace(0, len(samples), new_len, endpoint=False),
                np.arange(len(samples)),
                samples,
            )
        stereo = np.repeat(samples[:, None], 2, axis=1).astype("<i2")
        self._buf = stereo.tobytes()

    def read(self) -> bytes:
        frame = 3840  # 20ms * 48kHz * 2ch * 2 bytes
        chunk = self._buf[self._pos : self._pos + frame]
        self._pos += frame
        if len(chunk) < frame:
            chunk += b"\0" * (frame - len(chunk))
        return chunk if self._pos - frame < len(self._buf) else b""


async def capture_and_stream(vc: discord.VoiceClient) -> None:
    loop = asyncio.get_event_loop()
    frames_per_chunk = int(SAMPLE_RATE * CHUNK_SECONDS)
    stream = sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32")
    stream.start()
    try:
        while vc.is_connected():
            samples, _ = await loop.run_in_executor(None, stream.read, frames_per_chunk)
            wav = encode_wav(samples[:, 0])
            try:
                converted = await loop.run_in_executor(None, post_chunk, wav)
            except Exception as e:  # noqa: BLE001
                print(f"[deepcall] chunk failed: {e}")
                continue
            if not vc.is_playing():
                vc.play(WavSource(converted))
            while vc.is_playing():
                await asyncio.sleep(0.05)
    finally:
        stream.stop()
        stream.close()


@bot.event
async def on_ready() -> None:
    print(f"[deepcall] logged in as {bot.user}")
    guild = bot.get_guild(GUILD_ID)
    channel = guild.get_channel(CHANNEL_ID) if guild else None
    if not channel:
        print("[deepcall] voice channel not found")
        return
    vc = await channel.connect()
    await capture_and_stream(vc)


if __name__ == "__main__":
    bot.run(TOKEN)
