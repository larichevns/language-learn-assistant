/**
 * Tests for resolveGroupId (the domain-parametrized create-or-reuse taxonomy logic
 * in apply-db.ts).
 *
 * resolveGroupId is a private async helper; we test it through applyProposalDb which
 * runs inside prisma.$transaction. We vi.mock the db client so prisma.$transaction
 * receives our controlled mock tx. We also mock downstream helpers (record-attempt,
 * timeline, error-map) since VOCAB_ENTRY apply calls those — for group-routing tests
 * we only assert on the groupId that flows into `tx.vocabEntry.upsert` (VOCAB) or
 * `tx.grammarTopic.create/updateMany` (GRAMMAR).
 *
 * Coverage (VOCAB domain):
 *  B1  new group + new subgroup → creates both; entry.groupId === subId
 *  B2  REUSE by name: second apply with same names → no additional create calls
 *  B3  REUSE by id: payload carries groupId/subgroupId → reused, no create
 *  B4  leaf rule: group only (no subgroup) → groupId === topId
 *  B5  leaf rule: neither group nor subgroup → groupId === null (ungrouped)
 *  B6  MOVE: re-apply with different group → upsert update data carries new groupId
 *  B7  depth guard: subgroupId whose parent !== resolved top → ignored, falls back to topId
 *  B8  orphan subgroup: subgroup present but no group/groupId → word ungrouped, no stray top
 *  B9  idempotency: applying same payload twice → identical ids, no dup creates
 *  B10 ownership: groupId belonging to another user → ignored (find-first returns null)
 *
 * Coverage (domain isolation):
 *  D1  cross-domain id rejected: GRAMMAR payload with a VOCAB groupId → findFirst for
 *      domain:'GRAMMAR' misses → falls through to name-create / ungrouped
 *  D2  domain stamped on create: GRAMMAR create writes data.domain==='GRAMMAR';
 *      NOTE create writes data.domain==='NOTE'
 *  D3  same name, different domain, no collision: a GRAMMAR "Еда" create does NOT
 *      match a VOCAB "Еда" (domain discriminator is in the where clause)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock prisma BEFORE importing the module under test ──────────────────────
vi.mock('../../db/client', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

// Mock downstream helpers that VOCAB_ENTRY apply calls (irrelevant to group routing)
vi.mock('../../learning/record-attempt', () => ({ recordAttempt: vi.fn() }));
vi.mock('../../learning/timeline', () => ({ emitTimelineEvent: vi.fn() }));
vi.mock('../../learning/error-map', () => ({
  errorTypeToCategory: vi.fn(() => 'TENSE'),
  normalizeErrorType: vi.fn((v: string) => v),
}));

import { prisma } from '../../db/client';
import { applyProposalDb } from './apply-db';

// ── Mock Tx factory ──────────────────────────────────────────────────────────

/**
 * Creates a mock Prisma TransactionClient with collectionGroup, vocabEntry,
 * grammarTopic, and classNote stubbable. By default findFirst returns null
 * (not found) and create returns the given row.
 */
function makeTx(overrides: {
  collectionGroupFindFirst?: (...args: unknown[]) => unknown;
  collectionGroupCreate?: (...args: unknown[]) => unknown;
  vocabEntryUpsert?: (...args: unknown[]) => unknown;
  srsCardUpsert?: (...args: unknown[]) => unknown;
  grammarTopicCreate?: (...args: unknown[]) => unknown;
  grammarTopicUpdateMany?: (...args: unknown[]) => unknown;
  grammarCardUpsert?: (...args: unknown[]) => unknown;
  classNoteCreate?: (...args: unknown[]) => unknown;
  classNoteUpdateMany?: (...args: unknown[]) => unknown;
  courseFindFirst?: (...args: unknown[]) => unknown;
  proposalFindUnique?: (...args: unknown[]) => unknown;
  proposalUpdate?: (...args: unknown[]) => unknown;
}) {
  return {
    proposal: {
      findUnique: overrides.proposalFindUnique ?? vi.fn().mockResolvedValue(null),
      update: overrides.proposalUpdate ?? vi.fn().mockResolvedValue({}),
    },
    collectionGroup: {
      findFirst: overrides.collectionGroupFindFirst ?? vi.fn().mockResolvedValue(null),
      create: overrides.collectionGroupCreate ?? vi.fn().mockResolvedValue({ id: 'created-id' }),
    },
    vocabEntry: {
      upsert: overrides.vocabEntryUpsert ?? vi.fn().mockResolvedValue({ id: 'entry-id' }),
    },
    srsCard: {
      upsert: overrides.srsCardUpsert ?? vi.fn().mockResolvedValue({ id: 'srs-id' }),
    },
    grammarTopic: {
      create: overrides.grammarTopicCreate ?? vi.fn().mockResolvedValue({ id: 'grammar-id' }),
      updateMany: overrides.grammarTopicUpdateMany ?? vi.fn().mockResolvedValue({ count: 1 }),
    },
    grammarCard: {
      upsert: overrides.grammarCardUpsert ?? vi.fn().mockResolvedValue({ id: 'gc-id' }),
    },
    classNote: {
      create: overrides.classNoteCreate ?? vi.fn().mockResolvedValue({ id: 'note-id' }),
      updateMany: overrides.classNoteUpdateMany ?? vi.fn().mockResolvedValue({ count: 1 }),
    },
    course: {
      findFirst: overrides.courseFindFirst ?? vi.fn().mockResolvedValue({ id: 'course-id' }),
    },
    unit: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

/** A PENDING VOCAB_ENTRY proposal row that applyProposalDb loads first. */
function makeVocabProposalRow(payloadOverrides: Record<string, unknown> = {}) {
  return {
    id: 'prop-1',
    userId: 'user-A',
    status: 'PENDING',
    targetType: 'VOCAB_ENTRY',
    op: 'CREATE',
    targetId: null,
    threadId: null,
    payloadJson: {
      lemma: 'die Karotte',
      pos: 'NOUN',
      translationRu: 'морковь',
      gender: 'DIE',
      cefrLevel: 'A2',
      ...payloadOverrides,
    },
  };
}

/** A PENDING GRAMMAR_TOPIC proposal row (CREATE). */
function makeGrammarProposalRow(payloadOverrides: Record<string, unknown> = {}) {
  return {
    id: 'prop-g',
    userId: 'user-A',
    status: 'PENDING',
    targetType: 'GRAMMAR_TOPIC',
    op: 'CREATE',
    targetId: null,
    threadId: null,
    payloadJson: {
      title: 'Das Perfekt',
      category: 'TENSE',
      explanationRu: 'Прошедшее время в немецком',
      ...payloadOverrides,
    },
  };
}

/** A PENDING CLASS_NOTE proposal row (CREATE). */
function makeNoteProposalRow(payloadOverrides: Record<string, unknown> = {}) {
  return {
    id: 'prop-n',
    userId: 'user-A',
    status: 'PENDING',
    targetType: 'CLASS_NOTE',
    op: 'CREATE',
    targetId: null,
    threadId: null,
    payloadJson: {
      structured: { summary: 'Test note' },
      ...payloadOverrides,
    },
  };
}

/** Wire the mock prisma.$transaction to call the callback with the given tx. */
function wireTx(tx: ReturnType<typeof makeTx>) {
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
  );
}

const USER = 'user-A';
const PROP_ID = 'prop-1';
const GRAM_PROP_ID = 'prop-g';
const NOTE_PROP_ID = 'prop-n';

// ── B1: new group + new subgroup → creates both; entry.groupId === subId ─────

describe('B1 – new group and new subgroup are created; entry.groupId === subId', () => {
  it('creates top group then subgroup, routes word to subgroup id', async () => {
    const topId = 'new-top-id';
    const subId = 'new-sub-id';

    const collectionGroupFindFirst = vi.fn().mockResolvedValue(null); // nothing found → create
    const collectionGroupCreate = vi
      .fn()
      .mockResolvedValueOnce({ id: topId }) // first create → top
      .mockResolvedValueOnce({ id: subId }); // second create → sub

    const vocabEntryUpsert = vi.fn().mockResolvedValue({ id: 'entry-1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(makeVocabProposalRow({ group: 'Еда', subgroup: 'Овощи' })),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      vocabEntryUpsert,
    });
    wireTx(tx);

    await applyProposalDb(PROP_ID, USER);

    // Two creates: top group, then subgroup
    expect(collectionGroupCreate).toHaveBeenCalledTimes(2);

    // Top group created with parentId null, domain VOCAB, correct nameNorm
    expect(collectionGroupCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ parentId: null, nameNorm: 'еда', domain: 'VOCAB' }),
      }),
    );
    // Subgroup created with parentId === topId and domain VOCAB
    expect(collectionGroupCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ parentId: topId, nameNorm: 'овощи', domain: 'VOCAB' }),
      }),
    );

    // Word upserted with groupId === subId
    expect(vocabEntryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ groupId: subId }),
        update: expect.objectContaining({ groupId: subId }),
      }),
    );
  });
});

// ── B2: REUSE by name — second apply, same names → no new creates ─────────────

describe('B2 – name-based reuse: existing group found, no create called', () => {
  it('finds existing top and sub by name, does not create duplicates', async () => {
    const topId = 'existing-top';
    const subId = 'existing-sub';

    // findFirst always returns an existing row
    const collectionGroupFindFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: topId }) // top group found
      .mockResolvedValueOnce({ id: subId }); // subgroup found

    const collectionGroupCreate = vi.fn();
    const vocabEntryUpsert = vi.fn().mockResolvedValue({ id: 'entry-1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(makeVocabProposalRow({ group: 'Еда', subgroup: 'Овощи' })),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      vocabEntryUpsert,
    });
    wireTx(tx);

    await applyProposalDb(PROP_ID, USER);

    // No creates — both found
    expect(collectionGroupCreate).not.toHaveBeenCalled();

    // Entry routes to the found subId
    expect(vocabEntryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ groupId: subId }),
        update: expect.objectContaining({ groupId: subId }),
      }),
    );
  });
});

// ── B3: REUSE by id — explicit groupId/subgroupId → no creates ───────────────

describe('B3 – id-based reuse: payload carries groupId/subgroupId', () => {
  it('uses provided ids (finds by id), skips name lookup and create', async () => {
    const topId = 'top-explicit';
    const subId = 'sub-explicit';

    // findFirst returns the existing group for id-based queries
    const collectionGroupFindFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: topId }) // id-based top lookup → found
      .mockResolvedValueOnce({ id: subId, parentId: topId }); // id-based sub lookup → found

    const collectionGroupCreate = vi.fn();
    const vocabEntryUpsert = vi.fn().mockResolvedValue({ id: 'e1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(
        makeVocabProposalRow({ groupId: topId, subgroupId: subId }),
      ),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      vocabEntryUpsert,
    });
    wireTx(tx);

    await applyProposalDb(PROP_ID, USER);

    expect(collectionGroupCreate).not.toHaveBeenCalled();

    // Id-based lookup for top: where must include id === topId, domain:'VOCAB', and parentId: null
    expect(collectionGroupFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: topId, userId: USER, domain: 'VOCAB', parentId: null }),
      }),
    );

    // Entry gets subId
    expect(vocabEntryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ groupId: subId }),
        update: expect.objectContaining({ groupId: subId }),
      }),
    );
  });
});

// ── B4: leaf rule — group only (no subgroup) → groupId === topId ──────────────

describe('B4 – leaf rule: group but no subgroup → groupId equals topId', () => {
  it('creates top group, routes word to top (not sub)', async () => {
    const topId = 'only-top';

    const collectionGroupFindFirst = vi.fn().mockResolvedValue(null);
    const collectionGroupCreate = vi.fn().mockResolvedValue({ id: topId });
    const vocabEntryUpsert = vi.fn().mockResolvedValue({ id: 'e1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(makeVocabProposalRow({ group: 'Еда' })),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      vocabEntryUpsert,
    });
    wireTx(tx);

    await applyProposalDb(PROP_ID, USER);

    // Only one create (the top group)
    expect(collectionGroupCreate).toHaveBeenCalledTimes(1);

    // Word routes to topId, not a subgroup
    expect(vocabEntryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ groupId: topId }),
        update: expect.objectContaining({ groupId: topId }),
      }),
    );
  });
});

// ── B5: leaf rule — no group, no subgroup → groupId === null ──────────────────

describe('B5 – leaf rule: no group and no subgroup → entry is ungrouped', () => {
  it('routes word to null when neither group nor subgroup provided', async () => {
    const collectionGroupFindFirst = vi.fn();
    const collectionGroupCreate = vi.fn();
    const vocabEntryUpsert = vi.fn().mockResolvedValue({ id: 'e1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(makeVocabProposalRow({ group: null, subgroup: null })),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      vocabEntryUpsert,
    });
    wireTx(tx);

    await applyProposalDb(PROP_ID, USER);

    expect(collectionGroupFindFirst).not.toHaveBeenCalled();
    expect(collectionGroupCreate).not.toHaveBeenCalled();
    expect(vocabEntryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ groupId: null }),
        update: expect.objectContaining({ groupId: null }),
      }),
    );
  });
});

// ── B6: MOVE — re-apply with different group → upsert update carries new groupId

describe('B6 – MOVE: re-apply with a different group moves the word', () => {
  it('routes to new group on subsequent apply (last-write-wins via upsert update)', async () => {
    const newTopId = 'new-group-id';

    const collectionGroupFindFirst = vi.fn().mockResolvedValue(null);
    const collectionGroupCreate = vi.fn().mockResolvedValue({ id: newTopId });
    const vocabEntryUpsert = vi.fn().mockResolvedValue({ id: 'e1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(
        makeVocabProposalRow({ group: 'Транспорт', subgroup: null }),
      ),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      vocabEntryUpsert,
    });
    wireTx(tx);

    await applyProposalDb(PROP_ID, USER);

    // The upsert's UPDATE path must carry the new groupId so the word moves
    expect(vocabEntryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ groupId: newTopId }),
      }),
    );
  });
});

// ── B7: depth guard — subgroupId whose parent !== resolved top → ignored ──────

describe('B7 – depth guard: subgroupId with wrong parent is ignored', () => {
  it('falls back to topId when subgroupId parentId does not match resolved top', async () => {
    const topId = 'top-correct';
    const wrongSubId = 'sub-wrong-parent';

    // First findFirst (id-based top lookup) returns top
    // Second findFirst (id-based sub lookup) returns sub with DIFFERENT parentId
    const collectionGroupFindFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: topId }) // top found by id
      .mockResolvedValueOnce({ id: wrongSubId, parentId: 'some-other-top' }); // sub has wrong parent

    const collectionGroupCreate = vi.fn();
    const vocabEntryUpsert = vi.fn().mockResolvedValue({ id: 'e1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(
        makeVocabProposalRow({ groupId: topId, subgroupId: wrongSubId }),
      ),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      vocabEntryUpsert,
    });
    wireTx(tx);

    await applyProposalDb(PROP_ID, USER);

    // No creates (no name-based fallback either since no group/subgroup names given)
    expect(collectionGroupCreate).not.toHaveBeenCalled();

    // Word falls back to topId (not wrongSubId)
    expect(vocabEntryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ groupId: topId }),
        update: expect.objectContaining({ groupId: topId }),
      }),
    );
  });
});

// ── B8: orphan subgroup — subgroup present, no resolved top → ungrouped ───────

describe('B8 – orphan subgroup: subgroup name given but no top group resolved', () => {
  it('drops the subgroup and leaves word ungrouped; does NOT create a stray top', async () => {
    const collectionGroupFindFirst = vi.fn().mockResolvedValue(null);
    const collectionGroupCreate = vi.fn();
    const vocabEntryUpsert = vi.fn().mockResolvedValue({ id: 'e1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(
        // subgroup given but group and groupId both absent
        makeVocabProposalRow({ subgroup: 'Овощи', group: null, groupId: null }),
      ),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      vocabEntryUpsert,
    });
    wireTx(tx);

    await applyProposalDb(PROP_ID, USER);

    // No creates at all — no stray top group spawned
    expect(collectionGroupCreate).not.toHaveBeenCalled();

    // Word is ungrouped
    expect(vocabEntryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ groupId: null }),
        update: expect.objectContaining({ groupId: null }),
      }),
    );
  });
});

// ── B9: idempotency — same payload twice → same ids, no dup creates ───────────

describe('B9 – idempotency: applying the same payload twice yields the same groupId', () => {
  it('first apply creates; second apply finds (name-based) → no duplicate create', async () => {
    const topId = 'stable-top';
    const subId = 'stable-sub';

    // Simulate two sequential applies. Each apply calls findFirst twice.
    const collectionGroupFindFirst = vi
      .fn()
      // First apply: top not found → create; sub not found → create
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      // Second apply: top FOUND; sub FOUND
      .mockResolvedValueOnce({ id: topId })
      .mockResolvedValueOnce({ id: subId });

    const collectionGroupCreate = vi
      .fn()
      .mockResolvedValueOnce({ id: topId })
      .mockResolvedValueOnce({ id: subId });

    const vocabEntryUpsert = vi.fn().mockResolvedValue({ id: 'e1' });

    function makeApplyTx() {
      return makeTx({
        proposalFindUnique: vi.fn().mockResolvedValue(
          makeVocabProposalRow({ group: 'Еда', subgroup: 'Овощи' }),
        ),
        proposalUpdate: vi.fn().mockResolvedValue({}),
        collectionGroupFindFirst,
        collectionGroupCreate,
        vocabEntryUpsert,
      });
    }

    // First apply
    wireTx(makeApplyTx());
    await applyProposalDb(PROP_ID, USER);

    // Second apply
    wireTx(makeApplyTx());
    await applyProposalDb(PROP_ID, USER);

    // Only 2 creates total (one top + one sub), not 4
    expect(collectionGroupCreate).toHaveBeenCalledTimes(2);

    // Both applies route to the SAME subId
    const calls = vocabEntryUpsert.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![0]).toMatchObject({ create: { groupId: subId } });
    expect(calls[1]![0]).toMatchObject({ create: { groupId: subId } });
  });
});

// ── B10: ownership — foreign groupId → ignored ────────────────────────────────

describe('B10 – ownership: a groupId belonging to another user is ignored', () => {
  it('falls through to name-based lookup when id-scoped findFirst returns null for foreign id', async () => {
    const foreignGroupId = 'other-users-group';
    const createdTopId = 'created-for-user-A';

    const collectionGroupFindFirst = vi
      .fn()
      .mockResolvedValueOnce(null) // id-scoped lookup returns null (ownership filter)
      .mockResolvedValueOnce(null); // name-based lookup also returns null → create

    const collectionGroupCreate = vi.fn().mockResolvedValue({ id: createdTopId });
    const vocabEntryUpsert = vi.fn().mockResolvedValue({ id: 'e1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(
        makeVocabProposalRow({ groupId: foreignGroupId, group: 'Еда' }),
      ),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      vocabEntryUpsert,
    });
    wireTx(tx);

    await applyProposalDb(PROP_ID, USER);

    // A new group was created for the actual user (not using the foreign id)
    expect(collectionGroupCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER, parentId: null }),
      }),
    );

    // Entry does NOT get the foreign group id
    const upsertCall = vocabEntryUpsert.mock.calls[0]![0] as { create: { groupId: string } };
    expect(upsertCall.create.groupId).toBe(createdTopId);
    expect(upsertCall.create.groupId).not.toBe(foreignGroupId);
  });
});

// ── Whitespace-only group name treated as "not provided" ──────────────────────

describe('edge case – whitespace-only group name is treated as absent', () => {
  it('does not create a group for a whitespace-only group name', async () => {
    const collectionGroupFindFirst = vi.fn();
    const collectionGroupCreate = vi.fn();
    const vocabEntryUpsert = vi.fn().mockResolvedValue({ id: 'e1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(
        makeVocabProposalRow({ group: '   ', subgroup: '\t' }),
      ),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      vocabEntryUpsert,
    });
    wireTx(tx);

    await applyProposalDb(PROP_ID, USER);

    expect(collectionGroupCreate).not.toHaveBeenCalled();
    expect(vocabEntryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ groupId: null }),
      }),
    );
  });
});

// ── GRAMMAR domain: B1–B4 re-run via GRAMMAR_TOPIC payload ───────────────────

describe('GRAMMAR domain – B1 re-run: new group + subgroup for GRAMMAR_TOPIC', () => {
  it('creates both groups with domain:GRAMMAR and sets groupId on grammarTopic', async () => {
    const topId = 'gram-top';
    const subId = 'gram-sub';

    const collectionGroupFindFirst = vi.fn().mockResolvedValue(null);
    const collectionGroupCreate = vi
      .fn()
      .mockResolvedValueOnce({ id: topId })
      .mockResolvedValueOnce({ id: subId });
    const grammarTopicCreate = vi.fn().mockResolvedValue({ id: 'gram-1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(
        makeGrammarProposalRow({ group: 'Времена', subgroup: 'Прошедшее' }),
      ),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      grammarTopicCreate,
    });
    wireTx(tx);

    await applyProposalDb(GRAM_PROP_ID, USER);

    // Both creates stamp domain:'GRAMMAR'
    expect(collectionGroupCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ domain: 'GRAMMAR', parentId: null }) }),
    );
    expect(collectionGroupCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ domain: 'GRAMMAR', parentId: topId }) }),
    );

    // grammarTopic.create receives the subgroup's id as groupId
    expect(grammarTopicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ groupId: subId }) }),
    );
  });
});

describe('GRAMMAR domain – B2 re-run: name-based reuse for GRAMMAR_TOPIC', () => {
  it('finds existing GRAMMAR group by name and does not create duplicates', async () => {
    const topId = 'existing-gram-top';

    const collectionGroupFindFirst = vi.fn().mockResolvedValueOnce({ id: topId }); // top found
    const collectionGroupCreate = vi.fn();
    const grammarTopicCreate = vi.fn().mockResolvedValue({ id: 'gram-1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(
        makeGrammarProposalRow({ group: 'Времена' }),
      ),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      grammarTopicCreate,
    });
    wireTx(tx);

    await applyProposalDb(GRAM_PROP_ID, USER);

    expect(collectionGroupCreate).not.toHaveBeenCalled();
    expect(grammarTopicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ groupId: topId }) }),
    );
  });
});

describe('GRAMMAR domain – B3 re-run: id-based reuse for GRAMMAR_TOPIC', () => {
  it('resolves explicit groupId with domain:GRAMMAR in the where', async () => {
    const topId = 'gram-top-explicit';

    const collectionGroupFindFirst = vi.fn().mockResolvedValueOnce({ id: topId });
    const grammarTopicCreate = vi.fn().mockResolvedValue({ id: 'gram-1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(
        makeGrammarProposalRow({ groupId: topId }),
      ),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      grammarTopicCreate,
    });
    wireTx(tx);

    await applyProposalDb(GRAM_PROP_ID, USER);

    // The where clause must include domain:'GRAMMAR'
    expect(collectionGroupFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: topId, domain: 'GRAMMAR', parentId: null }),
      }),
    );
    expect(grammarTopicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ groupId: topId }) }),
    );
  });
});

describe('GRAMMAR domain – B5 re-run: ungrouped GRAMMAR_TOPIC', () => {
  it('routes to null when no group provided in grammar payload', async () => {
    const grammarTopicCreate = vi.fn().mockResolvedValue({ id: 'gram-1' });
    const collectionGroupFindFirst = vi.fn();

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(makeGrammarProposalRow()),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      grammarTopicCreate,
    });
    wireTx(tx);

    await applyProposalDb(GRAM_PROP_ID, USER);

    expect(collectionGroupFindFirst).not.toHaveBeenCalled();
    expect(grammarTopicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ groupId: null }) }),
    );
  });
});

// ── D1: cross-domain id rejected ──────────────────────────────────────────────

describe('D1 – cross-domain id rejected: VOCAB groupId does not resolve under GRAMMAR', () => {
  it('findFirst for domain:GRAMMAR misses on a VOCAB id → falls through to name-create/ungrouped', async () => {
    const vocabGroupId = 'vocab-group-123'; // belongs to a VOCAB group
    const newGrammarTopId = 'grammar-top-new';

    // The id-based findFirst for domain:GRAMMAR will miss (the id belongs to VOCAB)
    // Then name-based fallback: also no group name → ungrouped
    const collectionGroupFindFirst = vi.fn().mockResolvedValue(null);
    const collectionGroupCreate = vi.fn();
    const grammarTopicCreate = vi.fn().mockResolvedValue({ id: 'gram-1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(
        // Payload carries a VOCAB groupId — as if the model copy-pasted from the wrong block
        makeGrammarProposalRow({ groupId: vocabGroupId }),
      ),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      grammarTopicCreate,
    });
    wireTx(tx);

    await applyProposalDb(GRAM_PROP_ID, USER);

    // The lookup was with domain:'GRAMMAR' — the vocab id does NOT match
    expect(collectionGroupFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: vocabGroupId, domain: 'GRAMMAR' }),
      }),
    );

    // Since there's no group name either, no create happened
    expect(collectionGroupCreate).not.toHaveBeenCalled();

    // The vocab id NEVER reaches the grammar topic's data
    expect(grammarTopicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ groupId: null }),
      }),
    );
    const callData = (grammarTopicCreate.mock.calls[0]![0] as { data: { groupId: unknown } }).data;
    expect(callData.groupId).not.toBe(vocabGroupId);
  });
});

// ── D2: domain stamped on create ──────────────────────────────────────────────

describe('D2 – domain isolation on create: each domain stamps the correct domain value', () => {
  it('GRAMMAR_TOPIC create stamps data.domain === GRAMMAR', async () => {
    const collectionGroupFindFirst = vi.fn().mockResolvedValue(null);
    const collectionGroupCreate = vi.fn().mockResolvedValue({ id: 'gram-top' });
    const grammarTopicCreate = vi.fn().mockResolvedValue({ id: 'g1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(
        makeGrammarProposalRow({ group: 'Граммtik' }),
      ),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      grammarTopicCreate,
    });
    wireTx(tx);

    await applyProposalDb(GRAM_PROP_ID, USER);

    const createData = (collectionGroupCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(createData.domain).toBe('GRAMMAR');
  });

  it('CLASS_NOTE create stamps data.domain === NOTE', async () => {
    const collectionGroupFindFirst = vi.fn().mockResolvedValue(null);
    const collectionGroupCreate = vi.fn().mockResolvedValue({ id: 'note-top' });
    const classNoteCreate = vi.fn().mockResolvedValue({ id: 'n1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(
        makeNoteProposalRow({ group: 'Урок' }),
      ),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      classNoteCreate,
    });
    wireTx(tx);

    await applyProposalDb(NOTE_PROP_ID, USER);

    const createData = (collectionGroupCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(createData.domain).toBe('NOTE');
  });
});

// ── D3: same name, different domain — no collision ────────────────────────────

describe('D3 – same name different domain: GRAMMAR findFirst does not match VOCAB row', () => {
  it('a GRAMMAR "Еда" create uses domain:GRAMMAR in the where, not the VOCAB row', async () => {
    // Simulate: a VOCAB "Еда" exists in DB (domain:VOCAB). The findFirst for
    // domain:GRAMMAR returns null → a new GRAMMAR group is created.
    const collectionGroupFindFirst = vi.fn().mockResolvedValue(null); // GRAMMAR findFirst misses
    const collectionGroupCreate = vi.fn().mockResolvedValue({ id: 'grammar-eda' });
    const grammarTopicCreate = vi.fn().mockResolvedValue({ id: 'gram-1' });

    const tx = makeTx({
      proposalFindUnique: vi.fn().mockResolvedValue(
        makeGrammarProposalRow({ group: 'Еда' }),
      ),
      proposalUpdate: vi.fn().mockResolvedValue({}),
      collectionGroupFindFirst,
      collectionGroupCreate,
      grammarTopicCreate,
    });
    wireTx(tx);

    await applyProposalDb(GRAM_PROP_ID, USER);

    // The name-based findFirst used domain:'GRAMMAR', not 'VOCAB'
    expect(collectionGroupFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ domain: 'GRAMMAR', parentId: null, nameNorm: 'еда' }),
      }),
    );

    // A GRAMMAR-domain group was created (domain:'GRAMMAR', not 'VOCAB')
    expect(collectionGroupCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ domain: 'GRAMMAR', nameNorm: 'еда' }),
      }),
    );

    // The GRAMMAR topic got the new GRAMMAR group id
    expect(grammarTopicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ groupId: 'grammar-eda' }) }),
    );
  });
});
