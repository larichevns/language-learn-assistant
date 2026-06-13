'use client';

import { useEffect } from 'react';

/** Registers the service worker (production only) for PWA installability. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration is best-effort */
    });
  }, []);
  return null;
}
