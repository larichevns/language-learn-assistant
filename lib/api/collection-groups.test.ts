/**
 * Tests for lib/api/collection-groups.ts — the domain-neutral DTOs and shared
 * utilities for the generic two-level taxonomy (group → subgroup) used by vocab,
 * grammar, and notes.
 *
 * Route-handler tests (409 dup, 422 depth, 404 cross-user) require a Next.js
 * request context and mocked prisma/session — infrastructure not present in this
 * project's test setup. Those cases are covered by ui-tester / E2E coverage.
 *
 * Coverage:
 *  C1  normGroupName trims and lowercases correctly.
 *  C2  normGroupName handles Cyrillic, German umlauts, mixed case.
 *  C3  normGroupName on the empty string returns empty string.
 *  C4  normGroupName strips leading/trailing whitespace only (does not collapse
 *      internal spaces — the uniqueness key is the full trimmed lowercased string).
 *  C5  normGroupName is consistent: same input always returns same output
 *      (deterministic dedup across apply-db and route handlers).
 *  C6  Two names that differ only in case produce the same nameNorm
 *      (demonstrates the dedup logic — findFirst on nameNorm catches dups).
 *
 *  parseDomain:
 *  P1  Valid domain strings ('VOCAB', 'GRAMMAR', 'NOTE') return themselves.
 *  P2  Invalid strings return null.
 *  P3  null input returns null.
 *  P4  Empty string returns null.
 *  P5  Case-sensitive: lowercase 'vocab' returns null.
 *
 *  COUNT_RELATION / ITEM_MODEL maps:
 *  M1  COUNT_RELATION maps each domain to the correct Prisma relation name.
 *  M2  ITEM_MODEL maps each domain to the correct Prisma model delegate key.
 *  M3  Every GroupDomainStr key is present in both maps.
 */
import { describe, expect, it } from 'vitest';
import { normGroupName, parseDomain, COUNT_RELATION, ITEM_MODEL, type GroupDomainStr } from './collection-groups';

// ── normGroupName (C1–C6) ──────────────────────────────────────────────────────

describe('normGroupName', () => {
  it('C1: trims leading/trailing whitespace and lowercases ASCII', () => {
    expect(normGroupName('  Essen  ')).toBe('essen');
    expect(normGroupName('Food')).toBe('food');
    expect(normGroupName('FOOD')).toBe('food');
  });

  it('C2: handles Cyrillic and German umlauts', () => {
    expect(normGroupName('Еда')).toBe('еда');
    expect(normGroupName('Übungen')).toBe('übungen');
    expect(normGroupName('Käse')).toBe('käse');
    expect(normGroupName('ÜBUNGEN')).toBe('übungen');
  });

  it('C3: empty string returns empty string', () => {
    expect(normGroupName('')).toBe('');
  });

  it('C4: internal whitespace is preserved (not collapsed)', () => {
    // Only trim, not collapse — "essen und trinken" stays as-is after lowercase
    expect(normGroupName('Essen und Trinken')).toBe('essen und trinken');
    expect(normGroupName('  Essen  und  Trinken  ')).toBe('essen  und  trinken');
  });

  it('C5: deterministic — same input always returns same output', () => {
    const a = normGroupName('Овощи');
    const b = normGroupName('Овощи');
    expect(a).toBe(b);
  });

  it('C6: names differing only in case produce the same nameNorm (dedup invariant)', () => {
    expect(normGroupName('Еда')).toBe(normGroupName('ЕДА'));
    expect(normGroupName('еда')).toBe(normGroupName('Еда'));
    expect(normGroupName('Food')).toBe(normGroupName('FOOD'));
    expect(normGroupName('Übungen')).toBe(normGroupName('ÜBUNGEN'));
  });

  it('trims but does not alter internal spaces — "  Мясо  " → "мясо"', () => {
    expect(normGroupName('  Мясо  ')).toBe('мясо');
  });

  it('applies trim before lowercase (consistent with create-or-reuse find-first)', () => {
    // This mirrors what apply-db does: p.group.trim() → normGroupName
    const raw = '  Freizeit  ';
    const trimmed = raw.trim();
    // normGroupName called on the ALREADY trimmed name (as in apply-db)
    expect(normGroupName(trimmed)).toBe('freizeit');
    // But normGroupName itself also trims, so calling on raw is fine too
    expect(normGroupName(raw)).toBe('freizeit');
  });
});

// ── parseDomain (P1–P5) ──────────────────────────────────────────────────────

describe('parseDomain', () => {
  it('P1: returns each valid domain string as-is', () => {
    expect(parseDomain('VOCAB')).toBe('VOCAB');
    expect(parseDomain('GRAMMAR')).toBe('GRAMMAR');
    expect(parseDomain('NOTE')).toBe('NOTE');
  });

  it('P2: returns null for invalid strings', () => {
    expect(parseDomain('INVALID')).toBeNull();
    expect(parseDomain('vocabulary')).toBeNull();
    expect(parseDomain('vocab_entry')).toBeNull();
    expect(parseDomain('CLASSES')).toBeNull();
  });

  it('P3: returns null for null input', () => {
    expect(parseDomain(null)).toBeNull();
  });

  it('P4: returns null for empty string', () => {
    expect(parseDomain('')).toBeNull();
  });

  it('P5: case-sensitive — lowercase variants return null', () => {
    expect(parseDomain('vocab')).toBeNull();
    expect(parseDomain('grammar')).toBeNull();
    expect(parseDomain('note')).toBeNull();
    expect(parseDomain('Vocab')).toBeNull();
  });
});

// ── COUNT_RELATION / ITEM_MODEL maps (M1–M3) ────────────────────────────────

describe('COUNT_RELATION', () => {
  it('M1: maps each domain to the correct Prisma _count relation name', () => {
    expect(COUNT_RELATION['VOCAB']).toBe('vocabEntries');
    expect(COUNT_RELATION['GRAMMAR']).toBe('grammarTopics');
    expect(COUNT_RELATION['NOTE']).toBe('classNotes');
  });

  it('M3: all three domain keys are present', () => {
    const domains: GroupDomainStr[] = ['VOCAB', 'GRAMMAR', 'NOTE'];
    for (const d of domains) {
      expect(COUNT_RELATION[d]).toBeDefined();
    }
  });
});

describe('ITEM_MODEL', () => {
  it('M2: maps each domain to the correct Prisma model delegate key', () => {
    expect(ITEM_MODEL['VOCAB']).toBe('vocabEntry');
    expect(ITEM_MODEL['GRAMMAR']).toBe('grammarTopic');
    expect(ITEM_MODEL['NOTE']).toBe('classNote');
  });

  it('M3: all three domain keys are present', () => {
    const domains: GroupDomainStr[] = ['VOCAB', 'GRAMMAR', 'NOTE'];
    for (const d of domains) {
      expect(ITEM_MODEL[d]).toBeDefined();
    }
  });
});

describe('COUNT_RELATION and ITEM_MODEL consistency', () => {
  it('every COUNT_RELATION key also has an ITEM_MODEL entry and vice versa', () => {
    const countKeys = Object.keys(COUNT_RELATION) as GroupDomainStr[];
    const modelKeys = Object.keys(ITEM_MODEL) as GroupDomainStr[];
    expect(countKeys.sort()).toEqual(modelKeys.sort());
  });
});
