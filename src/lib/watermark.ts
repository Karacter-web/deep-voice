// Lightweight provenance watermark for generated audio.
//
// We don't implement true spread-spectrum embedding here (that needs a DSP
// pipeline). Instead we tag generated WAV files with a `LIST` / `INFO`
// chunk containing a signed token so downstream tools / detection systems
// can prove the clip came from this app.
//
// For non-WAV outputs (mp3/webm) we just return the input unchanged —
// callers should prefer WAV for traceable output.

import { createHmac } from "crypto";

const MAGIC = "DCPR"; // Deep Call Prank Receipt

export interface WatermarkPayload {
  userId: string;
  voiceModelId: string;
  sessionId?: string;
  issuedAt: number;
}

export function signWatermark(payload: WatermarkPayload, secret: string) {
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", secret).update(body).digest("hex").slice(0, 32);
  return `${MAGIC}:${Buffer.from(body).toString("base64")}:${sig}`;
}

/**
 * Append an INFO/ICMT chunk to a WAV buffer carrying the watermark token.
 * Returns the input unchanged if the buffer isn't a RIFF/WAVE file.
 */
export function watermarkWav(input: ArrayBuffer, token: string): ArrayBuffer {
  const view = new DataView(input);
  if (input.byteLength < 12) return input;
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (riff !== "RIFF" || wave !== "WAVE") return input;

  const tokenBytes = new TextEncoder().encode(token + "\0");
  // LIST chunk: 'LIST' + size(4) + 'INFO' + 'ICMT' + size(4) + data
  const icmtSize = tokenBytes.byteLength + (tokenBytes.byteLength % 2); // pad to even
  const listSize = 4 /*INFO*/ + 4 /*ICMT*/ + 4 /*icmtSize*/ + icmtSize;
  const chunk = new Uint8Array(8 + listSize);
  const cv = new DataView(chunk.buffer);
  chunk.set(new TextEncoder().encode("LIST"), 0);
  cv.setUint32(4, listSize, true);
  chunk.set(new TextEncoder().encode("INFO"), 8);
  chunk.set(new TextEncoder().encode("ICMT"), 12);
  cv.setUint32(16, tokenBytes.byteLength, true);
  chunk.set(tokenBytes, 20);

  const out = new Uint8Array(input.byteLength + chunk.byteLength);
  out.set(new Uint8Array(input), 0);
  out.set(chunk, input.byteLength);
  // Update RIFF size (bytes 4-7) to reflect appended chunk.
  const outView = new DataView(out.buffer);
  const oldRiffSize = view.getUint32(4, true);
  outView.setUint32(4, oldRiffSize + chunk.byteLength, true);
  return out.buffer;
}
