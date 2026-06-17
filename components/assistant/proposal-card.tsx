'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiPost } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/feedback';
import type { ChatProposal } from '@/lib/ai-client/chat-stream';
import { cn } from '@/lib/utils';
import { ProposalGroupPath } from './proposal-group-path';

const TARGET_LABELS: Record<string, string> = {
  VOCAB_ENTRY: 'Новое слово',
  GRAMMAR_TOPIC: 'Грамматика',
  HOMEWORK_CORRECTION: 'Исправление ДЗ',
  CLASS_NOTE: 'Заметка',
  EXERCISE_SET: 'Упражнения',
  UNIT: 'Урок',
  LEARNER_PROFILE: 'Профиль',
  LEARNER_PREFERENCE: 'Настройка',
  SRS_CARD: 'Повторение',
};

export function ProposalCard({
  proposal,
  onResolved,
  onRefine,
}: {
  proposal: ChatProposal;
  onResolved?: () => void;
  onRefine?: (proposal: ChatProposal) => void;
}) {
  const t = useTranslations('proposal');
  const tc = useTranslations('common');
  const statusLabel = (s: string) =>
    s === 'APPLIED' ? t('applied') : s === 'DISCARDED' ? t('discarded') : t('superseded');
  const [status, setStatus] = useState(proposal.status);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(kind: 'apply' | 'refine' | 'discard') {
    setBusy(kind);
    setError(null);
    try {
      await apiPost(`/api/proposals/${proposal.id}/${kind}`);
      if (kind === 'apply') {
        setStatus('APPLIED');
        onResolved?.();
      } else if (kind === 'discard') {
        setStatus('DISCARDED');
      } else {
        setStatus('SUPERSEDED');
        onRefine?.(proposal);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const resolved = status !== 'PENDING';

  return (
    <div
      className={cn(
        'rounded-xl border p-3 text-sm transition-colors',
        status === 'APPLIED' ? 'border-success/40 bg-success/5' : 'border-border bg-card',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge variant={status === 'APPLIED' ? 'success' : 'default'}>
          {TARGET_LABELS[proposal.targetType] ?? proposal.targetType}
        </Badge>
        {resolved && <span className="text-xs text-muted-foreground">{statusLabel(status)}</span>}
      </div>

      <p className="mt-2 font-medium leading-snug">{proposal.summary}</p>

      <ProposalGroupPath targetType={proposal.targetType} payload={proposal.payload} />

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">{tc('showDetails')}</summary>
        <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted p-2 text-[11px] leading-relaxed">
          {JSON.stringify(proposal.payload, null, 2)}
        </pre>
      </details>

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}

      {!resolved && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="success" disabled={busy !== null} onClick={() => act('apply')}>
            {t('apply')}
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act('refine')}>
            {t('refine')}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => act('discard')}>
            {t('discard')}
          </Button>
        </div>
      )}
    </div>
  );
}
