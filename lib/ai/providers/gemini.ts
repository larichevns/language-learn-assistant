/**
 * Google Gemini provider (v1beta REST). Free-tier friendly:
 *  - reasoning effort → thinking budget (2.5 family) / thinking level (3.x)
 *  - implicit prefix caching via byte-stable layer order (see envelope/builder)
 *  - 429 RESOURCE_EXHAUSTED surfaced with retryAfterMs; never auto-retried here
 *
 * Reference behavior ported from ToonyGamy/toonygamy-ai/app/providers/gemini.py.
 */
import type {
  CompletionChunk,
  CompletionRequest,
  CompletionResponse,
  Message,
  ReasoningEffort,
  ToolCall,
  ToolChoice,
  Usage,
} from '../types';
import { AIError, BaseProvider } from './base';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const GEMINI_25_THINKING_BUDGET: Record<ReasoningEffort, number> = {
  minimal: 0,
  low: 1024,
  medium: 8192,
  high: 24576,
};

/** reasoning effort → Gemini thinkingConfig (2.5 = int budget, 3.x = string level). */
export function mapThinking(
  effort: ReasoningEffort | undefined,
  modelId: string,
): Record<string, unknown> {
  if (!effort) return {};
  if (modelId.startsWith('gemini-2.5')) {
    return { thinkingConfig: { thinkingBudget: GEMINI_25_THINKING_BUDGET[effort] } };
  }
  return { thinkingConfig: { thinkingLevel: effort } };
}

/** Magic-byte MIME sniff for image/PDF parts when a type wasn't supplied. */
export function detectMime(dataBase64: string): string {
  const buf = Buffer.from(dataBase64.slice(0, 24), 'base64');
  const hex = buf.subarray(0, 4).toString('hex');
  if (hex.startsWith('89504e47')) return 'image/png';
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('47494638')) return 'image/gif';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF') return 'image/webp';
  if (hex.startsWith('25504446')) return 'application/pdf';
  return 'application/octet-stream';
}

function mapToolChoice(choice: ToolChoice | undefined): string {
  switch (choice) {
    case 'any':
      return 'ANY';
    case 'none':
      return 'NONE';
    default:
      return 'AUTO';
  }
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
}
interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

/** Map normalized messages → Gemini contents, coalescing consecutive same-role turns. */
function toContents(messages: Message[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const m of messages) {
    const role: 'user' | 'model' = m.role === 'model' ? 'model' : 'user';
    const parts: GeminiPart[] = [];
    for (const img of m.images ?? []) {
      parts.push({
        inline_data: {
          mime_type: img.mimeType || detectMime(img.dataBase64),
          data: img.dataBase64,
        },
      });
    }
    if (m.content) parts.push({ text: m.content });
    if (!parts.length) continue;
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push(...parts);
    } else {
      contents.push({ role, parts });
    }
  }
  return contents;
}

function mapUsage(u: Record<string, number> | undefined): Usage {
  const input = u?.promptTokenCount ?? 0;
  const output = u?.candidatesTokenCount ?? 0;
  return {
    inputTokens: input,
    outputTokens: output,
    cachedTokens: u?.cachedContentTokenCount ?? 0,
    thinkingTokens: u?.thoughtsTokenCount ?? 0,
    totalTokens: u?.totalTokenCount ?? input + output,
  };
}

export class GeminiProvider extends BaseProvider {
  readonly slug = 'gemini';
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string = DEFAULT_BASE_URL) {
    super();
    if (!apiKey) throw new AIError('AUTH', 'Gemini API key is missing');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private url(modelId: string, op: string): string {
    return `${this.baseUrl}/models/${modelId}:${op}`;
  }

  private headers(): Record<string, string> {
    return { 'x-goog-api-key': this.apiKey };
  }

  private buildBody(req: CompletionRequest): Record<string, unknown> {
    const body: Record<string, unknown> = { contents: toContents(req.messages) };
    if (req.systemInstruction) {
      body.systemInstruction = { parts: [{ text: req.systemInstruction }] };
    }
    if (req.tools?.length) {
      body.tools = [{ functionDeclarations: req.tools }];
      body.toolConfig = { functionCallingConfig: { mode: mapToolChoice(req.toolChoice) } };
    }
    const gen: Record<string, unknown> = {};
    if (req.temperature != null) gen.temperature = req.temperature;
    if (req.maxOutputTokens != null) gen.maxOutputTokens = req.maxOutputTokens;
    if (req.responseMimeType) gen.responseMimeType = req.responseMimeType;
    if (req.responseSchema) gen.responseSchema = req.responseSchema;
    Object.assign(gen, mapThinking(req.reasoningEffort, req.modelId));
    if (Object.keys(gen).length) body.generationConfig = gen;
    if (req.cachedContent) body.cachedContent = req.cachedContent;
    return body;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const res = await this.postJson(
      this.url(req.modelId, 'generateContent'),
      this.buildBody(req),
      this.headers(),
      req.signal,
    );
    const data = (await res.json()) as {
      candidates?: Array<{ content?: GeminiContent; finishReason?: string }>;
      usageMetadata?: Record<string, number>;
    };
    const cand = data.candidates?.[0];
    let text = '';
    const toolCalls: ToolCall[] = [];
    for (const p of cand?.content?.parts ?? []) {
      if (typeof p.text === 'string') text += p.text;
      if (p.functionCall) toolCalls.push({ name: p.functionCall.name, args: p.functionCall.args ?? {} });
    }
    return {
      text,
      toolCalls,
      usage: mapUsage(data.usageMetadata),
      finishReason: cand?.finishReason,
      modelId: req.modelId,
    };
  }

  async *stream(req: CompletionRequest): AsyncGenerator<CompletionChunk, void, unknown> {
    const res = await this.postJson(
      `${this.url(req.modelId, 'streamGenerateContent')}?alt=sse`,
      this.buildBody(req),
      this.headers(),
      req.signal,
    );
    const reader = res.body?.getReader();
    if (!reader) throw new AIError('UPSTREAM', 'No response body for stream');

    const decoder = new TextDecoder();
    let buffer = '';
    let lastUsage: Usage | undefined;
    let lastFinish: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const json = line.slice(5).trim();
        if (!json || json === '[DONE]') continue;
        let chunk: {
          candidates?: Array<{ content?: GeminiContent; finishReason?: string }>;
          usageMetadata?: Record<string, number>;
        };
        try {
          chunk = JSON.parse(json);
        } catch {
          continue;
        }
        const cand = chunk.candidates?.[0];
        for (const p of cand?.content?.parts ?? []) {
          if (typeof p.text === 'string' && p.text) yield { textDelta: p.text };
          if (p.functionCall)
            yield { toolCall: { name: p.functionCall.name, args: p.functionCall.args ?? {} } };
        }
        if (cand?.finishReason) lastFinish = cand.finishReason;
        if (chunk.usageMetadata) lastUsage = mapUsage(chunk.usageMetadata);
      }
    }
    if (lastUsage || lastFinish) yield { usage: lastUsage, finishReason: lastFinish };
  }

  async countTokens(req: CompletionRequest): Promise<number> {
    const body: Record<string, unknown> = { contents: toContents(req.messages) };
    if (req.systemInstruction) {
      body.systemInstruction = { parts: [{ text: req.systemInstruction }] };
    }
    const res = await this.postJson(this.url(req.modelId, 'countTokens'), body, this.headers(), req.signal);
    const data = (await res.json()) as { totalTokens?: number };
    return data.totalTokens ?? 0;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, { headers: this.headers() });
      return res.ok ? { ok: true } : { ok: false, detail: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }
}
