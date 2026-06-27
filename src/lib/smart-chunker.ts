/**
 * SmartTextChunker — splits long text into ~maxChars-sized pieces on
 * sentence/clause boundaries so a streaming TTS engine can synthesize
 * gaplessly. Falls back to hard breaks for runaway lines.
 */
export interface SmartChunk {
  index: number;
  text: string;
}

const SENTENCE_RX = /[^.!?\n]+[.!?]+(?:["')\]]+)?|\s*\n+|[^.!?\n]+$/g;

export function smartChunk(input: string, maxChars = 220): SmartChunk[] {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const sentences = text.match(SENTENCE_RX)?.map((s) => s.trim()).filter(Boolean) ?? [text];

  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (s.length > maxChars) {
      if (buf) { chunks.push(buf); buf = ""; }
      for (let i = 0; i < s.length; i += maxChars) chunks.push(s.slice(i, i + maxChars));
      continue;
    }
    if ((buf + " " + s).trim().length > maxChars) {
      if (buf) chunks.push(buf);
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.map((text, index) => ({ index, text }));
}
