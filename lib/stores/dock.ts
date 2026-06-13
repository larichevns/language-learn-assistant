'use client';

import { create } from 'zustand';

export interface DockScope {
  type: string;
  id?: string | null;
  label?: string;
}

/** collapsed (pill) → hover → bar → click/type → window (ToonyGamy pattern). */
export type DockState = 'collapsed' | 'bar' | 'window';

interface DockStore {
  state: DockState;
  scope: DockScope;
  setState: (s: DockState) => void;
  openWindow: () => void;
  expandBar: () => void;
  collapse: () => void;
  toggle: () => void;
  setScope: (scope: DockScope) => void;
}

export const useDock = create<DockStore>((set) => ({
  state: 'collapsed',
  scope: { type: 'GLOBAL', label: 'Весь курс' },
  setState: (s) => set({ state: s }),
  openWindow: () => set({ state: 'window' }),
  expandBar: () => set((st) => (st.state === 'window' ? st : { state: 'bar' })),
  collapse: () => set({ state: 'collapsed' }),
  toggle: () => set((st) => ({ state: st.state === 'window' ? 'collapsed' : 'window' })),
  setScope: (scope) => set({ scope }),
}));
