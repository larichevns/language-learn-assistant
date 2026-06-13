'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Mic, Send, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiGet } from '@/lib/api/client';
import { streamChat, type ChatProposal } from '@/lib/ai-client/chat-stream';
import { Spinner } from '@/components/ui/feedback';
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

/**
 * Centered, Google-style assistant (ToonyGamy pattern): a persistent centered
 * composer bar at the bottom; focusing/typing/⌘K opens a centered conversation
 * window above it over a scrim. Esc / backdrop closes.
 */
export function AssistantDock() {
  const { open, scope, openDock, closeDock } = useDock();
  const t = useTranslations('assistant');
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollDown = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));

  // ⌘K / Ctrl+K opens, Escape closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openDock();
        requestAnimationFrame(() => inputRef.current?.focus());
      } else if (e.key === 'Escape' && open) {
        closeDock();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, openDock, closeDock]);

  // Reload thread (messages + pending proposals) on open / scope change.
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
        scrollDown();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, scope.type, scope.id]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    if (!open) openDock();
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
        onToken: (tok) => {
          acc += tok;
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

  return (
    <>
      {open && <div className="fixed inset-0 z-40 animate-fade-in bg-foreground/25 backdrop-blur-sm" onClick={closeDock} />}

      <div className="fixed bottom-5 left-1/2 z-50 flex w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-3">
        {open && (
          <div className="flex max-h-[62vh] flex-col overflow-hidden rounded-3xl border border-border bg-popover shadow-[0_24px_60px_rgba(0,0,0,.20)] animate-fade-in">
            <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-display text-sm font-extrabold">{t('title')}</span>
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-foreground">
                  {scope.type === 'GLOBAL' ? t('scopeGlobal') : (scope.label ?? scope.type)}
                </span>
              </div>
              <button onClick={closeDock} aria-label="Закрыть" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div ref={scrollRef} className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
              {messages.length === 0 && !streaming && (
                <div className="py-8 text-center text-sm font-semibold text-muted-foreground">{t('empty')}</div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={cn('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'items-start')}>
                  {m.content && (
                    <div
                      className={cn(
                        'max-w-[86%] rounded-2xl px-3.5 py-2 text-sm font-medium',
                        m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
                      )}
                    >
                      {m.role === 'assistant' ? (
                        <div className="space-y-2 leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-5">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        m.content
                      )}
                    </div>
                  )}
                  {m.proposals?.map((p) => (
                    <div key={p.id} className="w-[86%]">
                      <ProposalCard proposal={p} onResolved={() => queryClient.invalidateQueries()} onRefine={(pr) => setInput(`Уточни: ${pr.summary}. `)} />
                    </div>
                  ))}
                </div>
              ))}
              {streaming && (
                <div className="flex items-start">
                  <div className="max-w-[86%] rounded-2xl bg-secondary px-3.5 py-2 text-sm font-medium text-secondary-foreground">
                    <div className="space-y-2 leading-relaxed [&_strong]:font-bold">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streaming}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
              {busy && !streaming && (
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Spinner /> {t('thinking')}
                </div>
              )}
              {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
            </div>
          </div>
        )}

        {/* persistent centered composer bar (Google-style) */}
        <div className="flex items-center gap-3 rounded-full border border-border bg-popover px-4 py-2.5 shadow-[0_12px_34px_rgba(38,36,48,.16)]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(248_52%_68%)]">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </span>
          <input
            ref={inputRef}
            value={input}
            onFocusCapture={() => !open && openDock()}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('placeholder')}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-medium"
          />
          <span className="hidden text-muted-foreground sm:inline">
            <Mic className="h-[18px] w-[18px]" />
          </span>
          <button
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            aria-label="Отправить"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            {busy ? <Spinner /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </>
  );
}
