'use client';

import { Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Speak German text via the browser's Web Speech API (free, on-device). */
export function SpeakButton({ text, className }: { text: string; className?: string }) {
  function speak(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'de-DE';
    utter.rate = 0.95;
    const deVoice = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('de'));
    if (deVoice) utter.voice = deVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
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
