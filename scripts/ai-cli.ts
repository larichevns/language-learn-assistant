/**
 * Phase-1 AI harness. Exercises the context engine against the Gemini free tier
 * with NO database and NO UI — envelope from JSON seed data, real streaming,
 * propose → apply.
 *
 *   npm run ai -- envelope --scope GRAMMAR_TOPIC:Perfekt "Почему gehen с sein?"
 *   npm run ai -- chat "Объясни Akkusativ на примере"
 *   npm run ai -- propose "Добавь слово der Tisch — стол, Plural Tische"
 *   npm run ai -- summarize
 *   npm run ai -- health
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AIError,
  applyProposal,
  assembleEnvelope,
  buildEnvelope,
  GeminiProvider,
  getFeature,
  interpolate,
  parseProposeCall,
  proposeToolDecl,
  type CompletionRequest,
  type Seed,
  type ToolCall,
  type Usage,
} from '../lib/ai/index';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// ── minimal .env loader (so `npx tsx` just works) ────────────────────────────
function loadEnv(): void {
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) return;
  // Shell env wins over the file; within the file, a later line wins over an
  // earlier one (so an appended real key overrides a copied empty placeholder).
  const fromFile = new Set<string>();
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || !m[1]) continue;
    const key = m[1];
    const val = (m[2] ?? '').replace(/^["']|["']$/g, '');
    if (key in process.env && !fromFile.has(key)) continue;
    process.env[key] = val;
    fromFile.add(key);
  }
}

function parseArgs(argv: string[]): { flags: Record<string, string>; positional: string[] } {
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

function loadSeed(): Seed {
  return JSON.parse(readFileSync(resolve(ROOT, 'scripts/seed-ai.json'), 'utf8')) as Seed;
}

function requireKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error(C.red('GEMINI_API_KEY is not set. Add it to .env.'));
    process.exit(1);
  }
  return key;
}

function resolveScope(seed: Seed, scope: string | undefined): { scopeType: string; scopeObject?: unknown } {
  if (!scope) return { scopeType: seed.thread.scopeType ?? 'GLOBAL' };
  const type = scope.split(':')[0] ?? 'GLOBAL';
  const scopeObject = seed.scopeObjects?.[scope];
  return { scopeType: type, scopeObject };
}

function printUsage(usage: Usage | undefined, opts: { background?: boolean } = {}): void {
  if (!usage) return;
  const cache = usage.cachedTokens ? `, cached ${usage.cachedTokens}` : '';
  const tag = opts.background ? C.dim(' (background, not billed)') : '';
  console.log(
    C.dim(`\n— tokens: in ${usage.inputTokens}, out ${usage.outputTokens}${cache}, total ${usage.totalTokens}`) + tag,
  );
}

function printCard(call: ToolCall): void {
  try {
    const parsed = parseProposeCall(call);
    const applied = applyProposal(parsed);
    console.log(C.green(`\n┌─ Proposal · ${applied.op} ${applied.targetType}`));
    console.log(C.green('│ ') + C.bold(applied.summary));
    console.log(C.green('│ ') + C.dim('distilled row (validated, DB-shaped):'));
    for (const line of JSON.stringify(applied.row, null, 2).split('\n')) {
      console.log(C.green('│ ') + line);
    }
    console.log(C.green('└─ [Apply] [Refine] [Discard]'));
  } catch (err) {
    console.log(C.red(`\n✗ Invalid proposal: ${(err as Error).message}`));
    console.log(C.dim(JSON.stringify(call.args, null, 2)));
  }
}

// ── commands ─────────────────────────────────────────────────────────────────
function cmdEnvelope(seed: Seed, message: string, scope: string | undefined, feature: string): void {
  const { scopeType, scopeObject } = resolveScope(seed, scope);
  const data = assembleEnvelope(seed, {
    scopeType,
    featureSlug: feature,
    scopeObject,
    userMessage: message || '(—)',
  });
  const env = buildEnvelope(data);
  console.log(C.cyan('═══ systemInstruction (layer 01) ═══'));
  console.log(env.systemInstruction);
  env.messages.forEach((m, i) => {
    console.log(C.cyan(`\n═══ message[${i}] role=${m.role} ═══`));
    console.log(m.content);
  });
}

async function cmdChat(seed: Seed, message: string, scope: string | undefined, feature: string): Promise<void> {
  const provider = new GeminiProvider(requireKey());
  const f = getFeature(feature);
  const { scopeType, scopeObject } = resolveScope(seed, scope);
  const data = assembleEnvelope(seed, { scopeType, featureSlug: feature, scopeObject, userMessage: message });
  const env = buildEnvelope(data);

  const req: CompletionRequest = {
    modelId: f.model,
    systemInstruction: env.systemInstruction,
    messages: env.messages,
    tools: [proposeToolDecl],
    toolChoice: 'auto',
    reasoningEffort: f.reasoningEffort,
  };

  console.log(C.dim(`(${f.model}, scope ${scopeType})\n`));
  const toolCalls: ToolCall[] = [];
  let usage: Usage | undefined;
  let finish: string | undefined;
  for await (const chunk of provider.stream(req)) {
    if (chunk.textDelta) process.stdout.write(chunk.textDelta);
    if (chunk.toolCall) toolCalls.push(chunk.toolCall);
    if (chunk.usage) usage = chunk.usage;
    if (chunk.finishReason) finish = chunk.finishReason;
  }
  if (finish && finish !== 'STOP') console.log(C.yellow(`\n[finishReason: ${finish}]`));
  for (const call of toolCalls) {
    if (call.name === 'propose') printCard(call);
  }
  printUsage(usage);
}

async function cmdPropose(seed: Seed, message: string, scope: string | undefined): Promise<void> {
  const provider = new GeminiProvider(requireKey());
  const f = getFeature('tutor_chat');
  const { scopeType, scopeObject } = resolveScope(seed, scope);
  const data = assembleEnvelope(seed, {
    scopeType,
    featureSlug: 'tutor_chat',
    scopeObject,
    userMessage: message,
  });
  const env = buildEnvelope(data);

  const req: CompletionRequest = {
    modelId: f.model,
    systemInstruction: env.systemInstruction,
    messages: env.messages,
    tools: [proposeToolDecl],
    toolChoice: 'auto',
    reasoningEffort: 'low',
  };

  const res = await provider.complete(req);
  if (res.text.trim()) console.log(res.text.trim());
  const proposeCalls = res.toolCalls.filter((c) => c.name === 'propose');
  if (!proposeCalls.length) {
    console.log(C.yellow('\n(no proposal emitted — try a clearer instruction like «добавь слово …»)'));
  }
  for (const call of proposeCalls) printCard(call);
  printUsage(res.usage);
}

async function cmdSummarize(seed: Seed): Promise<void> {
  const provider = new GeminiProvider(requireKey());
  const f = getFeature('thread_summarize');
  const dialogue = seed.thread.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
  const userPrompt = interpolate(f.userPromptTemplate ?? '{{dialogue}}', { dialogue });

  const req: CompletionRequest = {
    modelId: f.model,
    systemInstruction: f.systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    reasoningEffort: f.reasoningEffort,
  };

  console.log(C.dim(`(${f.model}, thread_summarize)\n`));
  const res = await provider.complete(req);
  console.log(res.text.trim());
  printUsage(res.usage, { background: true });
}

async function cmdHealth(): Promise<void> {
  const provider = new GeminiProvider(requireKey());
  const h = await provider.healthCheck();
  console.log(h.ok ? C.green('✓ Gemini reachable') : C.red(`✗ Gemini: ${h.detail ?? 'unreachable'}`));
}

function help(): void {
  console.log(
    [
      C.bold('LLA AI harness (Phase 1)'),
      '',
      'Commands:',
      '  envelope [--scope T[:key]] [--feature F] <message>   print the assembled 5-layer envelope',
      '  chat [--scope T[:key]] [--feature F] <message>       stream a Gemini answer (+ proposals)',
      '  propose [--scope T[:key]] <instruction>              force a propose → apply round-trip',
      '  summarize                                            run the background thread summarizer',
      '  health                                               check Gemini reachability',
      '',
      'Scopes: GLOBAL, GRAMMAR_TOPIC:Perfekt, VOCAB_ENTRY:aufstehen (see scripts/seed-ai.json)',
      'Features: tutor_chat, homework_correct, exercise_generate, vocab_extract, grammar_explain',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  loadEnv();
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const command = positional[0] ?? 'help';
  const message = positional.slice(1).join(' ');
  const scope = flags.scope;
  const feature = flags.feature ?? 'tutor_chat';
  const seed = loadSeed();

  try {
    switch (command) {
      case 'envelope':
        cmdEnvelope(seed, message, scope, feature);
        break;
      case 'chat':
        await cmdChat(seed, message, scope, feature);
        break;
      case 'propose':
        await cmdPropose(seed, message, scope);
        break;
      case 'summarize':
        await cmdSummarize(seed);
        break;
      case 'health':
        await cmdHealth();
        break;
      default:
        help();
    }
  } catch (err) {
    if (err instanceof AIError) {
      console.error(C.red(`\nAIError[${err.kind}]${err.status ? ` (${err.status})` : ''}: ${err.message}`));
      if (err.retryAfterMs) console.error(C.yellow(`Retry after ~${Math.ceil(err.retryAfterMs / 1000)}s`));
      process.exit(2);
    }
    throw err;
  }
}

void main();
