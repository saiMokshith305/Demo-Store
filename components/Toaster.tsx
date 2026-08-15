'use client';

import { useCallback, useEffect, type Dispatch } from 'react';
import { useStore, type Action } from '@/lib/state';
import type { Toast } from '@/lib/types';

const TOAST_TTL_MS = 3000;

function ToastItem({ toast, dispatch }: { toast: Toast; dispatch: Dispatch<Action> }) {
  // `dispatch` is reducer-stable, so this timer is armed once per toast and
  // always cleared on unmount — it can neither leak nor double-fire.
  const dismiss = useCallback(() => {
    dispatch({ type: 'DISMISS_TOAST', id: toast.id });
  }, [dispatch, toast.id]);

  useEffect(() => {
    const timer = setTimeout(dismiss, TOAST_TTL_MS);
    return () => clearTimeout(timer);
  }, [dismiss]);

  const success = toast.tone === 'success';

  return (
    <button
      type="button"
      onClick={dismiss}
      title="Dismiss"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: 320,
        textAlign: 'left',
        padding: '9px 12px',
        borderRadius: 'var(--r-md)',
        border: `1px solid ${success ? 'var(--success)' : 'var(--border-strong)'}`,
        background: success ? 'var(--success-soft)' : 'var(--surface)',
        color: success ? 'var(--success)' : 'var(--text)',
        boxShadow: 'var(--shadow-md)',
        fontWeight: 600,
        animation: 'slide-up 0.18s ease-out',
        pointerEvents: 'auto',
      }}
    >
      <span aria-hidden style={{ flexShrink: 0 }}>
        {success ? '✓' : 'ℹ'}
      </span>
      <span style={{ wordBreak: 'break-word' }}>{toast.message}</span>
    </button>
  );
}

/** Floating transient confirmations, stacked above the API inspector drawer. */
export default function Toaster() {
  const { state, dispatch } = useStore();

  if (state.toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 18,
        bottom: 'calc(var(--drawer-collapsed-h) + 18px)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {state.toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} dispatch={dispatch} />
      ))}
    </div>
  );
}
