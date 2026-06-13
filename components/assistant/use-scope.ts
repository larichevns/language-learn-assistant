'use client';

import { useEffect } from 'react';
import { useDock, type DockScope } from '@/lib/stores/dock';

const GLOBAL: DockScope = { type: 'GLOBAL', label: 'Весь курс' };

/** Point the Assistant Dock at the object on screen; reset to GLOBAL on leave. */
export function useScope(scope: DockScope) {
  const setScope = useDock((s) => s.setScope);
  useEffect(() => {
    setScope(scope);
    return () => setScope(GLOBAL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.type, scope.id]);
}
