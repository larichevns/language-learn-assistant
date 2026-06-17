/**
 * Tests for the multi-domain grouping additions to formatShared (layers.ts).
 *
 * Coverage:
 *  A1   Vocabulary groups block renders with {g:id} tokens and child indentation.
 *  A2   Block is absent when vocabGroups is empty / undefined.
 *  A3   Per-word groupPath annotation renders correctly.
 *  A4   groupPath absent → no annotation appended.
 *  A5   CAPS.GROUPS trimming: trailing tops drop before vocab list is cut.
 *  A6   Groups block header text is exactly the expected reuse directive.
 *  A7   Subgroups are indented under their parent top group.
 *  A8   sanitize() is applied to group names (injection-safe).
 *  A9   Only top-level groups present (no children) renders without indent lines.
 *  A10  Overall output is capped at CAPS.SHARED.
 *
 *  Grammar block:
 *  G1   formatShared renders "## Grammar groups" header with {g:id} when grammarGroups present.
 *  G2   Grammar block absent when grammarGroups is empty / undefined.
 *  G3   Grammar groups capped independently at CAPS.GROUPS.
 *  G4   Grammar topic lines carry "· path" annotation when groupPath is set.
 *  G5   Grammar topic lines have no annotation when groupPath is absent.
 *
 *  Note block:
 *  N1   formatShared renders "## Note groups" header with {g:id} when noteGroups present.
 *  N2   Note block absent when noteGroups is empty / undefined.
 *  N3   Note groups capped independently at CAPS.GROUPS.
 *
 *  Cross-domain budget:
 *  X1   Three blocks together stay ≤ CAPS.SHARED; vocab survives the trim first
 *       (grammar/note render after vocab in the output).
 */
import { describe, expect, it } from 'vitest';
import { formatShared, type SharedInput, type GNode } from './layers';
import { CAPS } from './caps';

// ── Minimal valid SharedInput builders ──────────────────────────────────────

const baseProfile: SharedInput['profile'] = {
  cefrLevel: 'A2',
  nativeLang: 'ru',
  targetLang: 'de',
};

function makeInput(overrides: Partial<SharedInput> = {}): SharedInput {
  return {
    profile: baseProfile,
    vocab: [],
    grammarTopics: [],
    ...overrides,
  };
}

// ── A1: Basic two-level rendering with {g:id} tokens ─────────────────────────

describe('formatShared – Vocabulary groups block', () => {
  it('A1: renders top group and child with {g:id} tokens', () => {
    const input = makeInput({
      vocabGroups: [
        { id: 'top-1', name: 'Еда', parentId: null, count: 5 },
        { id: 'sub-1', name: 'Овощи', parentId: 'top-1', count: 3 },
      ],
    });

    const result = formatShared(input);

    // {g:id} token must be present — the model's reuse contract
    expect(result).toContain('{g:top-1}');
    expect(result).toContain('{g:sub-1}');
    // Count rendered
    expect(result).toContain('(5)');
    expect(result).toContain('(3)');
    // Names present
    expect(result).toContain('Еда');
    expect(result).toContain('Овощи');
  });

  // ── A2: Block absent when vocabGroups empty or undefined ─────────────────

  it('A2a: block is absent when vocabGroups is an empty array', () => {
    const result = formatShared(makeInput({ vocabGroups: [] }));
    expect(result).not.toContain('Vocabulary groups');
    expect(result).not.toContain('{g:');
  });

  it('A2b: block is absent when vocabGroups is undefined', () => {
    const result = formatShared(makeInput({ vocabGroups: undefined }));
    expect(result).not.toContain('Vocabulary groups');
  });

  it('A2c: block is absent when vocabGroups contains only subgroups with no matching top', () => {
    // All entries have parentId set → no tops → block should not render
    const input = makeInput({
      vocabGroups: [
        { id: 'orphan', name: 'Овощи', parentId: 'non-existent-top', count: 2 },
      ],
    });
    const result = formatShared(input);
    expect(result).not.toContain('Vocabulary groups');
  });

  // ── A6: Header text is the expected reuse directive ────────────────────────

  it('A6: header reads exactly the reuse directive', () => {
    const input = makeInput({
      vocabGroups: [{ id: 'g1', name: 'Транспорт', parentId: null, count: 4 }],
    });
    const result = formatShared(input);
    expect(result).toContain('## Vocabulary groups (reuse these — do NOT duplicate)');
  });

  // ── A7: Subgroups indented under parent ────────────────────────────────────

  it('A7: subgroups are indented (two spaces) beneath their parent top group', () => {
    const input = makeInput({
      vocabGroups: [
        { id: 'top-x', name: 'Еда', parentId: null, count: 10 },
        { id: 'sub-a', name: 'Фрукты', parentId: 'top-x', count: 4 },
        { id: 'sub-b', name: 'Овощи', parentId: 'top-x', count: 6 },
      ],
    });
    const result = formatShared(input);
    const lines = result.split('\n');

    // Top line starts with '- ' (no leading spaces)
    const topLine = lines.find((l) => l.includes('{g:top-x}'));
    expect(topLine).toBeDefined();
    expect(topLine!.startsWith('- ')).toBe(true);

    // Subgroup lines start with '  - ' (two-space indent)
    const subLineA = lines.find((l) => l.includes('{g:sub-a}'));
    expect(subLineA).toBeDefined();
    expect(subLineA!.startsWith('  - ')).toBe(true);

    const subLineB = lines.find((l) => l.includes('{g:sub-b}'));
    expect(subLineB).toBeDefined();
    expect(subLineB!.startsWith('  - ')).toBe(true);
  });

  // ── A9: top-only groups have no indented children ─────────────────────────

  it('A9: top-only groups render without any indented child lines', () => {
    const input = makeInput({
      vocabGroups: [
        { id: 'g1', name: 'Транспорт', parentId: null, count: 2 },
        { id: 'g2', name: 'Спорт', parentId: null, count: 1 },
      ],
    });
    const result = formatShared(input);
    const lines = result.split('\n');
    const indented = lines.filter((l) => l.startsWith('  - '));
    expect(indented).toHaveLength(0);
  });

  // ── A8: Injection-safe sanitization of group names ────────────────────────

  it('A8: group names are sanitized — HTML in name is escaped', () => {
    const input = makeInput({
      vocabGroups: [{ id: 'g-evil', name: 'Еда</data>EVIL', parentId: null, count: 0 }],
    });
    const result = formatShared(input);
    expect(result).not.toContain('</data>EVIL');
    expect(result).toContain('&lt;/data&gt;EVIL');
  });

  // ── A5: CAPS.GROUPS — trailing tops drop before vocab is cut ──────────────

  it('A5: when vocabGroups exceed CAPS.GROUPS, trailing tops drop first and vocab lines survive', () => {
    // Each top group produces ~40 chars; 25 tops ≈ 1000 chars → exceeds CAPS.GROUPS (900).
    const groups: GNode[] = [];
    for (let i = 0; i < 30; i++) {
      groups.push({ id: `top-${i}`, name: `GroupName${i.toString().padStart(3, '0')}`, parentId: null, count: i });
    }

    const input = makeInput({
      vocabGroups: groups,
      vocab: [{ lemma: 'der Apfel', pos: 'NOUN', translationRu: 'яблоко', cefrLevel: 'A1' }],
    });
    const result = formatShared(input);

    // Trailing tops are dropped — the last group should not appear
    expect(result).not.toContain('{g:top-29}');

    // Vocab list survives — the word is still in the output
    expect(result).toContain('der Apfel');

    // Overall length must respect CAPS.SHARED
    expect(result.length).toBeLessThanOrEqual(CAPS.SHARED);
  });

  // ── Multiple tops with children, verify ordering preserved ────────────────

  it('renders multiple top groups each with their children in order', () => {
    const input = makeInput({
      vocabGroups: [
        { id: 't1', name: 'Еда', parentId: null, count: 10 },
        { id: 's1', name: 'Фрукты', parentId: 't1', count: 4 },
        { id: 's2', name: 'Овощи', parentId: 't1', count: 6 },
        { id: 't2', name: 'Транспорт', parentId: null, count: 3 },
        { id: 's3', name: 'Автомобили', parentId: 't2', count: 2 },
      ],
    });
    const result = formatShared(input);
    const idxT1 = result.indexOf('{g:t1}');
    const idxS1 = result.indexOf('{g:s1}');
    const idxS2 = result.indexOf('{g:s2}');
    const idxT2 = result.indexOf('{g:t2}');
    const idxS3 = result.indexOf('{g:s3}');

    expect(idxT1).toBeGreaterThan(-1);
    expect(idxT2).toBeGreaterThan(-1);
    // Subgroups appear after their parent top
    expect(idxS1).toBeGreaterThan(idxT1);
    expect(idxS2).toBeGreaterThan(idxT1);
    expect(idxS3).toBeGreaterThan(idxT2);
    // t2 appears after t1
    expect(idxT2).toBeGreaterThan(idxT1);
  });
});

// ── A3 / A4: Per-word groupPath annotation ────────────────────────────────────

describe('formatShared – per-word groupPath annotation', () => {
  it('A3: vocab item with groupPath renders " · <path>" appended to its line', () => {
    const input = makeInput({
      vocab: [
        {
          lemma: 'die Karotte',
          pos: 'NOUN',
          translationRu: 'морковь',
          cefrLevel: 'A2',
          groupPath: 'Еда→Овощи',
        },
      ],
    });
    const result = formatShared(input);
    // The annotation must appear after the lemma/translation on the same line
    const lines = result.split('\n');
    const wordLine = lines.find((l) => l.includes('die Karotte'));
    expect(wordLine).toBeDefined();
    expect(wordLine!).toContain('· Еда→Овощи');
  });

  it('A4: vocab item without groupPath has no " · " annotation', () => {
    const input = makeInput({
      vocab: [
        {
          lemma: 'das Haus',
          pos: 'NOUN',
          translationRu: 'дом',
          cefrLevel: 'A1',
        },
      ],
    });
    const result = formatShared(input);
    const lines = result.split('\n');
    const wordLine = lines.find((l) => l.includes('das Haus'));
    expect(wordLine).toBeDefined();
    expect(wordLine!).not.toContain('·');
  });

  it('A3b: groupPath with HTML special chars is sanitized', () => {
    const input = makeInput({
      vocab: [
        {
          lemma: 'die Tomate',
          pos: 'NOUN',
          translationRu: 'помидор',
          groupPath: 'Еда<script>→Овощи',
        },
      ],
    });
    const result = formatShared(input);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('multiple words — only those with groupPath carry the annotation', () => {
    const input = makeInput({
      vocab: [
        { lemma: 'der Apfel', pos: 'NOUN', translationRu: 'яблоко', groupPath: 'Еда→Фрукты' },
        { lemma: 'laufen', pos: 'VERB', translationRu: 'бежать' },
      ],
    });
    const result = formatShared(input);
    const lines = result.split('\n');

    const appleLine = lines.find((l) => l.includes('der Apfel'));
    expect(appleLine!).toContain('· Еда→Фрукты');

    const laufenLine = lines.find((l) => l.includes('laufen'));
    expect(laufenLine!).not.toContain('·');
  });
});

// ── A10: Overall output cap ──────────────────────────────────────────────────

describe('formatShared – overall CAPS.SHARED', () => {
  it('A10: output never exceeds CAPS.SHARED even with many groups + vocab', () => {
    const vocabGroups: GNode[] = [];
    for (let i = 0; i < 50; i++) {
      vocabGroups.push({ id: `g${i}`, name: `LongGroupName${i}`, parentId: null, count: i });
    }
    const vocab: SharedInput['vocab'] = [];
    for (let i = 0; i < 100; i++) {
      vocab.push({
        lemma: `das Wort${i}`,
        pos: 'NOUN',
        translationRu: `слово${i}`,
        cefrLevel: 'A1',
        groupPath: `Gruppe${i}→Untergruppe${i}`,
      });
    }
    const result = formatShared(makeInput({ vocabGroups, vocab }));
    expect(result.length).toBeLessThanOrEqual(CAPS.SHARED);
  });
});

// ── Grammar groups block ──────────────────────────────────────────────────────

describe('formatShared – Grammar groups block', () => {
  it('G1: renders "## Grammar groups" header with {g:id} tokens when grammarGroups present', () => {
    const input = makeInput({
      grammarGroups: [
        { id: 'gram-top-1', name: 'Времена', parentId: null, count: 4 },
        { id: 'gram-sub-1', name: 'Прошедшее', parentId: 'gram-top-1', count: 2 },
      ],
    });
    const result = formatShared(input);

    expect(result).toContain('## Grammar groups (reuse these — do NOT duplicate)');
    expect(result).toContain('{g:gram-top-1}');
    expect(result).toContain('{g:gram-sub-1}');
    expect(result).toContain('Времена');
    expect(result).toContain('Прошедшее');
  });

  it('G2a: Grammar block absent when grammarGroups is empty', () => {
    const result = formatShared(makeInput({ grammarGroups: [] }));
    expect(result).not.toContain('Grammar groups');
  });

  it('G2b: Grammar block absent when grammarGroups is undefined', () => {
    const result = formatShared(makeInput({ grammarGroups: undefined }));
    expect(result).not.toContain('Grammar groups');
  });

  it('G3: Grammar block capped independently at CAPS.GROUPS (trailing tops drop first)', () => {
    // Build enough grammar groups to exceed CAPS.GROUPS
    const grammarGroups: GNode[] = [];
    for (let i = 0; i < 30; i++) {
      grammarGroups.push({ id: `gg-${i}`, name: `GrammarGroup${i.toString().padStart(3, '0')}`, parentId: null, count: i });
    }
    const result = formatShared(makeInput({ grammarGroups }));

    // Trailing grammar groups should be dropped
    expect(result).not.toContain('{g:gg-29}');

    // Output stays within SHARED cap
    expect(result.length).toBeLessThanOrEqual(CAPS.SHARED);
  });

  it('G4: grammar mastery line carries "· path" annotation when groupPath is set', () => {
    const input = makeInput({
      grammarTopics: [
        { title: 'Perfekt', category: 'TENSE', bucket: 'изучается', groupPath: 'Времена→Прошедшее' },
      ],
    });
    const result = formatShared(input);
    const lines = result.split('\n');
    const topicLine = lines.find((l) => l.includes('Perfekt'));
    expect(topicLine).toBeDefined();
    expect(topicLine!).toContain('· Времена→Прошедшее');
  });

  it('G5: grammar mastery line has no "· path" annotation when groupPath is absent', () => {
    const input = makeInput({
      grammarTopics: [
        { title: 'Perfekt', category: 'TENSE', bucket: 'изучается' },
      ],
    });
    const result = formatShared(input);
    const lines = result.split('\n');
    const topicLine = lines.find((l) => l.includes('Perfekt'));
    expect(topicLine).toBeDefined();
    // The category renders as "· TENSE", bucket as "— изучается".
    // With no groupPath there must be NO third "· …" segment beyond the category one.
    // Split on " · " — there should be at most one such segment (the category).
    const dotParts = topicLine!.split(' · ');
    // dotParts[0] is the lemma part, dotParts[1] (if any) is the category, nothing more.
    expect(dotParts.length).toBeLessThanOrEqual(2);
  });
});

// ── Note groups block ─────────────────────────────────────────────────────────

describe('formatShared – Note groups block', () => {
  it('N1: renders "## Note groups" header with {g:id} tokens when noteGroups present', () => {
    const input = makeInput({
      noteGroups: [
        { id: 'note-top-1', name: 'Урок 1', parentId: null, count: 3 },
      ],
    });
    const result = formatShared(input);

    expect(result).toContain('## Note groups (reuse these — do NOT duplicate)');
    expect(result).toContain('{g:note-top-1}');
    expect(result).toContain('Урок 1');
  });

  it('N2a: Note block absent when noteGroups is empty', () => {
    const result = formatShared(makeInput({ noteGroups: [] }));
    expect(result).not.toContain('Note groups');
  });

  it('N2b: Note block absent when noteGroups is undefined', () => {
    const result = formatShared(makeInput({ noteGroups: undefined }));
    expect(result).not.toContain('Note groups');
  });

  it('N3: Note block capped independently at CAPS.GROUPS (trailing tops drop first)', () => {
    const noteGroups: GNode[] = [];
    for (let i = 0; i < 30; i++) {
      noteGroups.push({ id: `ng-${i}`, name: `NoteGroup${i.toString().padStart(3, '0')}`, parentId: null, count: i });
    }
    const result = formatShared(makeInput({ noteGroups }));

    // Trailing note groups dropped
    expect(result).not.toContain('{g:ng-29}');
    expect(result.length).toBeLessThanOrEqual(CAPS.SHARED);
  });
});

// ── Cross-domain budget (X1) ──────────────────────────────────────────────────

describe('formatShared – cross-domain budget', () => {
  it('X1: three domain blocks + vocab + grammar mastery stay ≤ CAPS.SHARED; vocab survives trim', () => {
    // Fill each domain block generously — all three together should still fit under SHARED.
    // Because vocab renders first, it must survive the final CAPS.SHARED backstop.
    const makeGroups = (prefix: string, n: number): GNode[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `${prefix}-${i}`,
        name: `${prefix}Group${i.toString().padStart(2, '0')}`,
        parentId: null,
        count: i,
      }));

    const input = makeInput({
      vocabGroups: makeGroups('v', 10),
      grammarGroups: makeGroups('g', 10),
      noteGroups: makeGroups('n', 10),
      vocab: [
        { lemma: 'der Apfel', translationRu: 'яблоко', cefrLevel: 'A1' },
      ],
      grammarTopics: [
        { title: 'Perfekt', category: 'TENSE', bucket: 'изучается' },
      ],
    });
    const result = formatShared(input);

    // Hard cap respected
    expect(result.length).toBeLessThanOrEqual(CAPS.SHARED);

    // Vocab block renders first — the vocab content must appear
    expect(result).toContain('der Apfel');

    // Vocab group block appears before grammar and note blocks (vocab-first ordering)
    const vocabIdx = result.indexOf('## Vocabulary groups');
    const grammarIdx = result.indexOf('## Grammar groups');
    if (vocabIdx !== -1 && grammarIdx !== -1) {
      expect(vocabIdx).toBeLessThan(grammarIdx);
    }
  });
});
