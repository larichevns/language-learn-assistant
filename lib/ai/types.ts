/**
 * Core AI types — the provider-agnostic contract every feature speaks.
 * zod schemas validate data crossing boundaries; `CompletionRequest` adds a
 * non-serializable `AbortSignal` on top of its schema.
 */
import { z } from 'zod';

export const ReasoningEffortSchema = z.enum(['minimal', 'low', 'medium', 'high']);
export type ReasoningEffort = z.infer<typeof ReasoningEffortSchema>;

/** Normalized roles. Gemini uses `model`; OpenAI-style `assistant` maps to it. */
export const RoleSchema = z.enum(['user', 'model', 'system']);
export type Role = z.infer<typeof RoleSchema>;

export const ImagePartSchema = z.object({
  mimeType: z.string(),
  /** base64 (no data: prefix) */
  dataBase64: z.string(),
});
export type ImagePart = z.infer<typeof ImagePartSchema>;

export const MessageSchema = z.object({
  role: RoleSchema,
  content: z.string().default(''),
  images: z.array(ImagePartSchema).optional(),
});
export type Message = z.infer<typeof MessageSchema>;

/** A tool/function declaration. `parameters` is a Gemini-native JSON schema. */
export const ToolDeclSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()),
});
export type ToolDecl = z.infer<typeof ToolDeclSchema>;

export const ToolCallSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  args: z.record(z.unknown()),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const UsageSchema = z.object({
  inputTokens: z.number().default(0),
  outputTokens: z.number().default(0),
  cachedTokens: z.number().default(0),
  thinkingTokens: z.number().default(0),
  totalTokens: z.number().default(0),
});
export type Usage = z.infer<typeof UsageSchema>;

export const ToolChoiceSchema = z.enum(['auto', 'any', 'none']);
export type ToolChoice = z.infer<typeof ToolChoiceSchema>;

export const CompletionRequestSchema = z.object({
  modelId: z.string(),
  systemInstruction: z.string().optional(),
  messages: z.array(MessageSchema),
  tools: z.array(ToolDeclSchema).optional(),
  toolChoice: ToolChoiceSchema.optional(),
  reasoningEffort: ReasoningEffortSchema.optional(),
  temperature: z.number().optional(),
  maxOutputTokens: z.number().optional(),
  /** e.g. "application/json" for structured extraction */
  responseMimeType: z.string().optional(),
  /** Gemini-native response schema for structured output */
  responseSchema: z.record(z.unknown()).optional(),
  /** explicit-cache resource name (opt-in) */
  cachedContent: z.string().optional(),
});

export type CompletionRequest = z.infer<typeof CompletionRequestSchema> & {
  signal?: AbortSignal;
};

export interface CompletionResponse {
  text: string;
  toolCalls: ToolCall[];
  usage: Usage;
  finishReason?: string;
  modelId: string;
}

export interface CompletionChunk {
  textDelta?: string;
  toolCall?: ToolCall;
  usage?: Usage;
  finishReason?: string;
}

export interface Provider {
  readonly slug: string;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  stream(req: CompletionRequest): AsyncGenerator<CompletionChunk, void, unknown>;
  countTokens(req: CompletionRequest): Promise<number>;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
}

/** The empty Usage value (used as a reduce seed). */
export function emptyUsage(): Usage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    thinkingTokens: 0,
    totalTokens: 0,
  };
}
