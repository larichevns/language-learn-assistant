'use client';

import { create } from 'zustand';

export interface DockScope {
  type: string;
  id?: string | null;
  label?: string;
}

interface DockStore {
  open: boolean;
  scope: DockScope;
  openDock: () => void;
  closeDock: () => void;
  toggle: () => void;
  setScope: (scope: DockScope) => void;
}

export const useDock = create<DockStore>((set) => ({
  open: false,
  scope: { type: 'GLOBAL', label: 'Весь курс' },
  openDock: () => set({ open: true }),
  closeDock: () => set({ open: false }),
  toggle: () => set((s) => ({ open: !s.open })),
  setScope: (scope) => set({ scope }),
}));
