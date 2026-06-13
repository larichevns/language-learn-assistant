/**
 * Propose parsing + Apply dispatch. In Phase 1 the Apply distills a tool call
 * into the validated, DB-shaped structured object (no persistence). Phase 2
 * wraps `applyProposal` in a Prisma transaction that writes the real row.
 */
import type { ToolCall } from '../types';
import { isProposeTarget, PAYLOAD_SCHEMAS, type ProposeTargetType } from './tool';

export interface ParsedProposal {
  targetType: ProposeTargetType;
  op: 'CREATE' | 'UPDATE';
  targetId?: string;
  summary: string;
  payload: unknown;
}

export interface AppliedProposal {
  targetType: ProposeTargetType;
  op: 'CREATE' | 'UPDATE';
  targetId?: string;
  summary: string;
  /** validated, DB-shaped fields ready to persist */
  row: Record<string, unknown>;
}

/** Parse a raw `propose` tool call into a typed proposal (payload still unvalidated). */
export function parseProposeCall(call: ToolCall): ParsedProposal {
  const args = call.args as Record<string, unknown>;
  const targetTypeRaw = String(args.target_type ?? '');
  if (!isProposeTarget(targetTypeRaw)) {
    throw new Error(`Unknown propose target_type: ${targetTypeRaw}`);
  }
  const op = args.op === 'UPDATE' ? 'UPDATE' : 'CREATE';
  const summary = String(args.summary ?? '').trim() || '(no summary)';
  const targetId = args.target_id != null ? String(args.target_id) : undefined;

  let payload: unknown = args.payload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      // leave as string; validation will reject with a clear error
    }
  }

  return { targetType: targetTypeRaw, op, targetId, summary, payload };
}

/** Validate a proposal's payload against its target schema. Throws on mismatch. */
export function validatePayload(targetType: ProposeTargetType, payload: unknown): Record<string, unknown> {
  const schema = PAYLOAD_SCHEMAS[targetType];
  return schema.parse(payload) as Record<string, unknown>;
}

/**
 * Apply = validate + distill into structured fields. Idempotency, ownership and
 * persistence are added in Phase 2; here it proves the propose→apply contract.
 */
export function applyProposal(parsed: ParsedProposal): AppliedProposal {
  const row = validatePayload(parsed.targetType, parsed.payload);
  return {
    targetType: parsed.targetType,
    op: parsed.op,
    targetId: parsed.targetId,
    summary: parsed.summary,
    row,
  };
}
