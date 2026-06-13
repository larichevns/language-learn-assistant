'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Send, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiGet } from '@/lib/api/client';
import { streamChat, type ChatProposal } from '@/lib/ai-client/chat-stream';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Badge, Spinner } from '@/components/ui/feedback';
import { useDock } from '@/lib/stores/dock';
import { cn } from '@/lib/utils';
import { ProposalCard } from './proposal-card';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposals?: ChatProposal[];
}

let counter = 0;
const nextId = () => `m${++counter}`;

export function AssistantDock() {
  const { open, scope, openDock, closeDock } = useDock();
  const t = useTranslations('assistant');
  const tn = useTranslations('nav');
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollDown = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));

  // Reload the thread (messages + pending proposals) from the DB on open / scope change.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const qs = `scopeType=${encodeURIComponent(scope.type)}${scope.id ? `&scopeId=${encodeURIComponent(scope.id)}` : ''}`;
    apiGet<{ messages: Array<{ role: 'user' | 'assistant'; content: string }>; proposals: ChatProposal[] }>(`/api/threads/resolve?${qs}`)
      .then((data) => {
        if (cancelled) return;
        const loaded: Msg[] = data.messages.map((m) => ({ id: nextId(), role: m.role, content: m.content }));
        if (data.proposals.length) loaded.push({ id: nextId(), role: 'assistant', content: '', proposals: data.proposals });
        setMessages(loaded);
      })
      .catch(() => {
        /* keep whatever is on screen */
      });
    return () => {
      cancelled = true;
    };
  }, [open, scope.type, scope.id]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { id: nextId(), role: 'user', content: text }]);
    scrollDown();

    let acc = '';
    const proposals: ChatProposal[] = [];
    await streamChat(
      { message: text, scopeType: scope.type, scopeId: scope.id ?? undefined, feature: 'tutor_chat' },
      {
        onToken: (t) => {
          acc += t;
          setStreaming(acc);
          scrollDown();
        },
        onProposal: (p) => proposals.push(p),
        onError: (e) => setError(e.retryAfter ? `${e.message} (повтор через ${e.retryAfter}с)` : e.message),
      },
    );

    setMessages((m) => [...m, { id: nextId(), role: 'assistant', content: acc || '…', proposals }]);
    setStreaming('');
    setBusy(false);
    scrollDown();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  if (!open) {
    return (
      <button
        onClick={openDock}
        className="fixed bottom-5 right-5 z-50 flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Sparkles className="h-5 w-5" />
        {tn('assistant')}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[min(580px,calc(100dvh-2rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl animate-fade-in">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-semibold">{t('title')}</span>
          <Badge variant="muted">{scope.type === 'GLOBAL' ? t('scopeGlobal') : (scope.label ?? scope.type)}</Badge>
        </div>
        <Button variant="ghost" size="icon" aria-label="Закрыть" onClick={closeDock}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !streaming && (
          <div className="mt-6 text-center text-sm text-muted-foreground">{t('empty')}</div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'items-start')}>
            {m.content && (
              <div
                className={cn(
                  'max-w-[88%] rounded-2xl px-3.5 py-2 text-sm',
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
                )}
              >
                {m.role === 'assistant' ? (
                  <div className="space-y-2 leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            )}
            {m.proposals?.map((p) => (
              <div key={p.id} className="w-[88%]">
                <ProposalCard proposal={p} onResolved={() => queryClient.invalidateQueries()} onRefine={(pr) => setInput(`Уточни: ${pr.summary}. `)} />
              </div>
            ))}
          </div>
        ))}

        {streaming && (
          <div className="flex items-start">
            <div className="max-w-[88%] rounded-2xl bg-secondary px-3.5 py-2 text-sm text-secondary-foreground">
              <div className="prose-chat space-y-2 [&_strong]:font-semibold">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streaming}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {busy && !streaming && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> {t('thinking')}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <footer className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('placeholder')}
            rows={1}
            className="max-h-32 min-h-[40px] resize-none"
          />
          <Button size="icon" onClick={() => void send()} disabled={busy || !input.trim()} aria-label="Отправить">
            {busy ? <Spinner /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </footer>
    </div>
  );
}
