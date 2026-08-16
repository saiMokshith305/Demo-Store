'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useStore } from '@/lib/state';
import type { SessionState } from '@/lib/types';

/** `partially_returned` is derived by Talon.One from returns, so it is not offered. */
const SESSION_STATES: { value: SessionState; hint: string }[] = [
  { value: 'open', hint: 'Cart is live and evaluated for promotions' },
  { value: 'closed', hint: 'Order placed — closing the session commits the discounts' },
  { value: 'cancelled', hint: 'Session voided — releases any committed effects' },
];

/**
 * Fixed-height top bar: brand, read-only session id (+ copy), editable
 * profile id / shipping cost, and the dry-run toggle with its campaign ids.
 */
export default function SessionBar() {
  const { state, dispatch } = useStore();
  const {
    sessionId,
    profileId,
    shippingCost,
    dryRun,
    evaluableCampaignIds,
    state: sessionState,
  } = state.session;

  const [copied, setCopied] = useState(false);
  const [shippingText, setShippingText] = useState<string>(
    shippingCost ? String(shippingCost) : '',
  );
  const [campaignText, setCampaignText] = useState<string>(evaluableCampaignIds.join(', '));

  // Re-sync the local text buffer if the value changes from elsewhere.
  useEffect(() => {
    const local = shippingText.trim() === '' ? 0 : Number(shippingText);
    if (!Number.isFinite(local) || local !== shippingCost) {
      setShippingText(shippingCost ? String(shippingCost) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingCost]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  async function copySessionId() {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function onShippingChange(raw: string) {
    setShippingText(raw);
    const trimmed = raw.trim();
    if (trimmed === '') {
      dispatch({ type: 'SET_SHIPPING_COST', shippingCost: 0 });
      return;
    }
    const parsed = Number(trimmed);
    dispatch({
      type: 'SET_SHIPPING_COST',
      shippingCost: Number.isFinite(parsed) ? parsed : 0,
    });
  }

  function onCampaignChange(raw: string) {
    setCampaignText(raw);
    const ids = raw
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .map((part) => Number(part))
      .filter((n) => Number.isFinite(n));
    dispatch({ type: 'SET_EVALUABLE_CAMPAIGN_IDS', ids });
  }

  const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column' };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        height: 'var(--header-h)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '0 18px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', flexShrink: 0 }}>
        Best Buy <span className="subtle">×</span> Talon.One
      </div>

      <div style={{ ...fieldStyle, flexShrink: 0 }}>
        <span className="label" style={{ marginBottom: 2 }}>
          Session ID
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className="mono"
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--r-sm)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: sessionId ? 'var(--text)' : 'var(--text-subtle)',
              minWidth: 120,
              display: 'inline-block',
            }}
          >
            {sessionId || 'generating…'}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={copySessionId}
            disabled={!sessionId}
            title="Copy session ID"
            aria-label="Copy session ID"
          >
            {copied ? '✓' : '⧉'}
          </button>
        </div>
      </div>

      <div style={{ ...fieldStyle, width: 160, flexShrink: 0 }}>
        <label className="label" htmlFor="profile-id" style={{ marginBottom: 2 }}>
          Profile ID
        </label>
        <input
          id="profile-id"
          className="input mono"
          style={{ padding: '4px 8px' }}
          value={profileId}
          onChange={(e) => dispatch({ type: 'SET_PROFILE_ID', profileId: e.target.value })}
          placeholder="demo-customer-1"
        />
      </div>

      <div style={{ ...fieldStyle, flexShrink: 0 }}>
        <span className="label" style={{ marginBottom: 2 }}>
          Session state
        </span>
        <div className="segmented" role="group" aria-label="Session state">
          {SESSION_STATES.map(({ value, hint }) => (
            <button
              key={value}
              type="button"
              className="segmented-option"
              aria-pressed={sessionState === value}
              title={hint}
              onClick={() => dispatch({ type: 'SET_SESSION_STATE', state: value })}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...fieldStyle, width: 110, flexShrink: 0 }}>
        <label className="label" htmlFor="shipping-cost" style={{ marginBottom: 2 }}>
          Shipping
        </label>
        <input
          id="shipping-cost"
          className="input mono"
          style={{ padding: '4px 8px' }}
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={shippingText}
          onChange={(e) => onShippingChange(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginLeft: 'auto',
          flexShrink: 0,
          paddingLeft: 12,
          borderLeft: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          role="switch"
          aria-checked={dryRun}
          onClick={() => dispatch({ type: 'SET_DRY_RUN', dryRun: !dryRun })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: 'var(--text)',
            fontWeight: 600,
          }}
          title="Evaluate without persisting the session"
        >
          <span
            aria-hidden
            style={{
              width: 34,
              height: 20,
              borderRadius: 999,
              background: dryRun ? 'var(--accent)' : 'var(--border-strong)',
              position: 'relative',
              transition: 'background 0.15s ease',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: dryRun ? 16 : 2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: 'var(--shadow-sm)',
                transition: 'left 0.15s ease',
              }}
            />
          </span>
          Dry run
        </button>

        <span
          className="subtle"
          style={{ fontSize: 11, lineHeight: 1.25, maxWidth: 230, whiteSpace: 'normal' }}
        >
          Evaluates without persisting the session; returns{' '}
          <span className="mono">ruleFailureReasons</span>.
        </span>

        {dryRun && (
          <div style={{ ...fieldStyle, width: 170 }}>
            <label className="label" htmlFor="campaign-ids" style={{ marginBottom: 2 }}>
              Campaign IDs
            </label>
            <input
              id="campaign-ids"
              className="input mono"
              style={{ padding: '4px 8px' }}
              value={campaignText}
              onChange={(e) => onCampaignChange(e.target.value)}
              placeholder="42, 43"
            />
          </div>
        )}
      </div>
    </header>
  );
}
