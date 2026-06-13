'use client';

import { Volume2 } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * Speak German text via the browser's Web Speech API (free, on-device).
 *
 * Chrome loads voices asynchronously: `getVoices()` is often empty on the first
 * call, so a naive lookup finds no German voice and the engine falls back to the
 * SYSTEM DEFAULT (commonly an English voice like "Daniel [en-GB]") — which reads
 * German with English phonetics. We therefore warm a cache on mount + on
 * `voiceschanged`, prefer an exact de-DE voice, and if voices still aren't ready
 * at click time we wait for them before speaking instead of falling back.
 */
let cachedVoices: SpeechSynthesisVoice[] = [];

function refreshVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const v = window.speechSynthesis.getVoices();
  if (v.length) cachedVoices = v;
}

function germanVoice(): SpeechSynthesisVoice | undefined {
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang?.toLowerCase() === 'de-de') ?? voices.find((v) => v.lang?.toLowerCase().startsWith('de'))
  );
}

export function SpeakButton({ text, className }: { text: string; className?: string }) {
  useEffect(() => {
    refreshVoices();
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    synth?.addEventListener('voiceschanged', refreshVoices);
    return () => synth?.removeEventListener('voiceschanged', refreshVoices);
  }, []);

  function speak(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!synth) return;

    const emit = () => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'de-DE';
      utter.rate = 0.95;
      const voice = germanVoice();
      if (voice) utter.voice = voice; // force German — never fall back to the English default
      synth.cancel();
      synth.speak(utter);
    };

    if (germanVoice()) {
      emit();
      return;
    }
    // Voices not loaded yet (typical on the very first interaction): wait once.
    let done = false;
    const onReady = () => {
      if (done) return;
      done = true;
      synth.removeEventListener('voiceschanged', onReady);
      refreshVoices();
      emit();
    };
    synth.addEventListener('voiceschanged', onReady);
    refreshVoices();
    if (germanVoice()) onReady();
    else setTimeout(onReady, 600); // fallback if voiceschanged never fires
  }

  return (
    <button
      type="button"
      onClick={speak}
      aria-label="Произнести по-немецки"
      className={cn('inline-flex items-center text-muted-foreground transition-colors hover:text-primary', className)}
    >
      <Volume2 className="h-4 w-4" />
    </button>
  );
}
