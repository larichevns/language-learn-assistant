/** Public surface of the AI context engine. */
export * from './types';
export { sanitize, wrapData } from './envelope/sanitize';
export { CAPS, THREAD_TAIL, capText, estimateTokens } from './envelope/caps';
export {
  SYSTEM_PERSONA,
  FEATURE_ADDENDA,
  formatShared,
  formatUnit,
  formatScope,
  formatThreadSummary,
} from './envelope/layers';
export { buildEnvelope, type EnvelopeData, type BuiltEnvelope } from './envelope/builder';
export {
  assembleEnvelope,
  type Seed,
  type SeedVocab,
  type SeedGrammar,
  type AssembleOptions,
} from './envelope/context-manager';
export { AIError, BaseProvider, classifyHttp, parseRetryDelay } from './providers/base';
export { GeminiProvider, mapThinking, detectMime } from './providers/gemini';
export {
  proposeToolDecl,
  PROPOSE_TARGET_TYPES,
  PAYLOAD_SCHEMAS,
  isProposeTarget,
  type ProposeTargetType,
} from './propose/tool';
export {
  parseProposeCall,
  validatePayload,
  applyProposal,
  type ParsedProposal,
  type AppliedProposal,
} from './propose/dispatch';
export { interpolate, resolveTemplate, type TemplateVars } from './prompts/loader';
export { FEATURES, getFeature, type FeatureSpec } from './features/templates';
export { calculateCost, type Pricing } from './cost';
