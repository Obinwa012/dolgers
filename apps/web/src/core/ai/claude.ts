import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

export interface AiModels {
  /** Review classification and image checks: high volume, structured. */
  fast: string;
  /** Size charts and listing copy: fewer calls, more judgement. */
  careful: string;
}

export const DEFAULT_MODELS: AiModels = {
  fast: 'claude-sonnet-5-5',
  careful: 'claude-sonnet-5-5',
};

export type ImageInput = { mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string };
export type Part = { type: 'text'; text: string } | { type: 'image'; image: ImageInput };

/** The narrow interface the analyzers use, so tests can supply a fake. */
export interface StructuredModel {
  generate<T>(o: {
    model: string;
    system: string;
    parts: Part[];
    schema: z.ZodType<T>;
    maxTokens?: number;
  }): Promise<T>;
}

export class ClaudeModel implements StructuredModel {
  private readonly client: Anthropic;
  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    if (!apiKey) throw new Error('Claude API key is not set. Add it in Settings → Claude.');
    // Each dashboard request makes at most one model call, so keep retries and waits bounded.
    this.client = new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 });
  }

  async generate<T>(o: { model: string; system: string; parts: Part[]; schema: z.ZodType<T>; maxTokens?: number }): Promise<T> {
    const jsonSchema = z.toJSONSchema(o.schema) as Record<string, unknown>;
    delete jsonSchema.$schema;
    const content: Anthropic.ContentBlockParam[] = o.parts.map((p) =>
      p.type === 'text'
        ? { type: 'text', text: p.text }
        : { type: 'image', source: { type: 'base64', media_type: p.image.mediaType, data: p.image.data } },
    );
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.client.messages.create({
        model: o.model,
        max_tokens: o.maxTokens ?? 8000,
        system: o.system,
        messages: [{ role: 'user', content }],
        output_config: { format: { type: 'json_schema', schema: jsonSchema } },
      });
      const text = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
      try {
        return o.schema.parse(JSON.parse(text));
      } catch (e) {
        lastErr = new Error(`Model output failed validation (${res.stop_reason}): ${(e as Error).message}`);
      }
    }
    throw lastErr;
  }
}

/** Downloads an image and returns it in the form the API accepts. Returns null when unusable. */
export async function loadImage(url: string, fetchImpl: typeof fetch = fetch): Promise<ImageInput | null> {
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100 || buf.length > 4_500_000) return null;
    const mediaType = sniff(buf);
    return mediaType ? { mediaType, data: buf.toString('base64') } : null;
  } catch {
    return null;
  }
}

function sniff(b: Buffer): ImageInput['mediaType'] | null {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (b.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  return null;
}
