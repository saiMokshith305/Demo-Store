'use client';

import { useStore } from '@/lib/state';
import type { AppError } from '@/lib/types';

/** Coupon problems are warnings; config / transport problems are failures. */
function paletteFor(kind: AppError['kind']) {
  if (kind === 'coupon') {
    return { fg: 'var(--warning)', bg: 'var(--warning-soft)', glyph: '⚠' };
  }
  return { fg: 'var(--danger)', bg: 'var(--danger-soft)', glyph: '✕' };
}

const KIND_LABEL: Record<AppError['kind'], string> = {
  config: 'Configuration',
  http: 'API error',
  network: 'Network error',
  coupon: 'Coupon rejected',
};

/** Persistent error banners. `config` errors cannot be dismissed — they must be fixed. */
export default function Banner() {
  const { state, dispatch } = useStore();

  if (state.errors.length === 0) return null;

  return (
    <div
      role="alert"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 18px 0' }}
    >
      {state.errors.map((error) => {
        const palette = paletteFor(error.kind);
        const dismissible = error.kind !== 'config';
        return (
          <div
            key={error.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 'var(--r-md)',
              background: palette.bg,
              border: `1px solid ${palette.fg}`,
              color: palette.fg,
            }}
          >
            <span aria-hidden style={{ fontWeight: 700, lineHeight: '20px' }}>
              {palette.glyph}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="panel-title"
                style={{ color: palette.fg, opacity: 0.85, marginBottom: 2 }}
              >
                {KIND_LABEL[error.kind]}
              </div>
              <div style={{ color: palette.fg, wordBreak: 'break-word' }}>{error.message}</div>
            </div>
            {dismissible && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: palette.fg, flexShrink: 0 }}
                onClick={() => dispatch({ type: 'DISMISS_ERROR', id: error.id })}
                aria-label="Dismiss"
                title="Dismiss"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
