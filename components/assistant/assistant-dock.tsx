'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { MessageSquarePlus, Mic, Send, Sparkles, Square, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiGet, apiPost } from '@/lib/api/client';
import { streamChat, type ChatProposal } from '@/lib/ai-client/chat-stream';
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

// One soft spring shared across the dock so every surface settles the same way.
const SPRING = { type: 'spring', stiffness: 260, damping: 28, mass: 0.9 } as const;

/**
 * Centered, Google-style assistant (ToonyGamy pattern):
 *   collapsed pill → hover → bar → click/type → window (centered, over a scrim).
 * Esc / backdrop / X collapses. ⌘K opens the window. Mobile = full-width bottom sheet.
 */
export function AssistantDock() {
  const { state, scope, openWindow, expandBar, collapse } = useDock();
  const open = state === 'window';
  const t = useTranslations('assistant');
  const queryClient = useQueryClient();
  const prefersReduced = useReducedMotion();
  const reduce = !!prefersReduced;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const discardRef = useRef(false); // set by "New chat" to drop an in-flight reply

  // Only follow the stream when the user is already near the bottom — never yank
  // them away from older messages they scrolled up to read.
  const nearBottom = () => {
    const el = scrollRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  const scrollDown = (force = false) => {
    if (!force && !nearBottom()) return;
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: force ? 'smooth' : 'auto' }),
    );
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openWindow();
        requestAnimationFrame(() => inputRef.current?.focus());
      } else if (e.key === 'Escape' && open) {
        collapse();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, openWindow, collapse]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const qs = `scopeType=${encodeURIComponent(scope.type)}${scope.id ? `&scopeId=${encodeURIComponent(scope.id)}` : ''}`;
    apiGet<{ threadId: string; messages: Array<{ role: 'user' | 'assistant'; content: string }>; proposals: ChatProposal[] }>(
      `/api/threads/resolve?${qs}`,
    )
      .then((data) => {
        if (cancelled) return;
        setThreadId(data.threadId);
        const loaded: Msg[] = data.messages.map((m) => ({ id: nextId(), role: m.role, content: m.content }));
        if (data.proposals.length) loaded.push({ id: nextId(), role: 'assistant', content: '', proposals: data.proposals });
        setMessages(loaded);
        scrollDown(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, scope.type, scope.id]);

  // hover-intent: collapsed → bar → collapsed (desktop only; touch taps the pill → window)
  function onEnter() {
    if (state !== 'collapsed') return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    enterTimer.current = setTimeout(() => expandBar(), 150);
  }
  function onLeave() {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    if (state === 'bar') leaveTimer.current = setTimeout(() => collapse(), 220);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    discardRef.current = false;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    openWindow();
    setInput('');
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { id: nextId(), role: 'user', content: text }]);
    scrollDown(true);
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
        onDone: (d) => setThreadId(d.threadId),
        onError: (e) => setError(e.retryAfter ? `${e.message} (повтор через ${e.retryAfter}с)` : e.message),
      },
      ctrl.signal,
    );
    abortRef.current = null;
    // "New chat" fired mid-stream — drop this reply, the thread was already reset.
    if (discardRef.current) {
      discardRef.current = false;
      setStreaming('');
      setBusy(false);
      return;
    }
    if (acc || proposals.length) {
      setMessages((m) => [...m, { id: nextId(), role: 'assistant', content: acc, proposals }]);
    }
    setStreaming('');
    setBusy(false);
    scrollDown();
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function newChat() {
    discardRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    const id = threadId;
    setMessages([]);
    setStreaming('');
    setError(null);
    setBusy(false);
    inputRef.current?.focus();
    if (id) await apiPost(`/api/threads/${id}/clear`).catch(() => {});
    queryClient.invalidateQueries();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const composer = (
    <div className="flex items-center gap-3 rounded-full border border-border bg-popover px-4 py-2.5 shadow-[0_12px_34px_rgba(38,36,48,.16)]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(248_52%_68%)]">
        <Sparkles className="h-4 w-4 text-primary-foreground" />
      </span>
      <input
        ref={inputRef}
        value={input}
        onFocusCapture={() => !open && openWindow()}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('placeholder')}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground"
      />
      <span className="hidden text-muted-foreground sm:inline">
        <Mic className="h-[18px] w-[18px]" />
      </span>
      <button
        onClick={() => (busy ? stop() : void send())}
        disabled={!busy && !input.trim()}
        aria-label={busy ? t('stop') : t('sendLabel')}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40',
          busy ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90',
        )}
      >
        {busy ? <Square className="h-3.5 w-3.5 fill-current" /> : <Send className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm"
            onClick={collapse}
          />
        )}
      </AnimatePresence>

      <div
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 px-2 pb-2 sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:w-[min(680px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:px-0 sm:pb-0"
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
              transition={SPRING}
              style={{ transformOrigin: 'bottom center' }}
              className="flex max-h-[75vh] flex-col overflow-hidden rounded-t-3xl border border-border bg-popover shadow-[0_24px_60px_rgba(0,0,0,.2)] sm:max-h-[62vh] sm:rounded-3xl"
            >
              <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-display text-sm font-extrabold">{t('title')}</span>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-foreground">
                    {scope.type === 'GLOBAL' ? t('scopeGlobal') : (scope.label ?? scope.type)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => void newChat()}
                    aria-label={t('newChat')}
                    title={t('newChat')}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={collapse}
                    aria-label={t('closeLabel')}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </header>
              <div ref={scrollRef} className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
                {messages.length === 0 && !streaming && !busy && (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="py-8 text-center text-sm font-semibold text-muted-foreground"
                  >
                    {t('empty')}
                  </motion.div>
                )}
                <AnimatePresence initial={false}>
                  {messages.map((m) => (
                    <motion.div
                      key={m.id}
                      layout={reduce ? false : 'position'}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                      transition={SPRING}
                      className={cn('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'items-start')}
                    >
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
                    </motion.div>
                  ))}
                </AnimatePresence>
                {streaming && (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={SPRING}
                    className="flex items-start"
                  >
                    <div className="max-w-[86%] rounded-2xl bg-secondary px-3.5 py-2 text-sm font-medium text-secondary-foreground">
                      <div className="space-y-2 leading-relaxed [&_strong]:font-bold">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{streaming}</ReactMarkdown>
                      </div>
                      <motion.span
                        aria-hidden
                        className="mt-1 inline-block h-3.5 w-[3px] rounded-full bg-current align-middle"
                        animate={reduce ? undefined : { opacity: [1, 0.15, 1] }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </div>
                  </motion.div>
                )}
                {busy && !streaming && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-current"
                          animate={reduce ? undefined : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
                        />
                      ))}
                    </span>
                    {t('thinking')}
                  </div>
                )}
                {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {state === 'collapsed' ? (
          <motion.button
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING}
            onClick={openWindow}
            className="mx-auto flex items-center gap-2.5 rounded-full border border-border bg-popover px-5 py-3 text-sm font-bold shadow-[0_12px_30px_rgba(38,36,48,.14)] transition-shadow hover:shadow-[0_16px_38px_rgba(38,36,48,.2)]"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(248_52%_68%)]">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </span>
            {t('title')}
            <kbd className="ml-1 hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground sm:inline">⌘K</kbd>
          </motion.button>
        ) : (
          composer
        )}
      </div>
    </>
  );
}
