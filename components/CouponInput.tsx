'use client';

/**
 * Coupon entry for the cart panel.
 *
 * A single code is supported (matching SessionConfig.couponCode). Once applied,
 * the bare input is replaced by a removable chip whose styling reflects what the
 * last Talon.One response said about that code: accepted, rejected, or — while
 * the sync is still in flight or the effect list says nothing — neutral.
 */

import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useStore } from '@/lib/state';
import type { CouponRejection, ParsedEffects } from '@/lib/types';

type CouponStatus = 'accepted' | 'rejected' | 'pending';

interface CouponOutcome {
  status: CouponStatus;
  rejection: CouponRejection | null;
}

/** Case-insensitive lookup of a code's outcome in the parsed effects. */
export function couponOutcome(
  code: string,
  parsed: ParsedEffects | null,
): CouponOutcome {
  if (!parsed) return { status: 'pending', rejection: null };

  const target = code.trim().toLowerCase();
  const rejection =
    parsed.rejections.find((r) => r.code.trim().toLowerCase() === target) ?? null;
  if (rejection) return { status: 'rejected', rejection };

  const accepted = parsed.acceptedCoupons.some((c) => c.trim().toLowerCase() === target);
  return { status: accepted ? 'accepted' : 'pending', rejection: null };
}

const chipCloseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  lineHeight: 1,
  padding: 0,
  marginLeft: 2,
  opacity: 0.75,
};

export default function CouponInput() {
  const { state, dispatch } = useStore();
  const [value, setValue] = useState('');

  const applied = state.session.couponCode;

  function apply() {
    const code = value.trim();
    if (code === '') return;
    dispatch({ type: 'SET_COUPON', code });
    setValue('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      apply();
    }
  }

  // -------------------------------------------------------------------------
  // Applied — show the code as a removable chip
  // -------------------------------------------------------------------------

  if (applied) {
    const { status, rejection } = couponOutcome(applied, state.parsed);
    const chipClass =
      status === 'accepted'
        ? 'chip chip-success'
        : status === 'rejected'
          ? 'chip chip-danger'
          : 'chip chip-muted';

    return (
      <div>
        <span className="label">Coupon</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className={chipClass}>
            <span className="mono" style={{ color: 'inherit', fontWeight: 700 }}>
              {applied}
            </span>
            {status === 'accepted' ? <span aria-hidden="true">✓</span> : null}
            <button
              type="button"
              style={chipCloseStyle}
              onClick={() => dispatch({ type: 'SET_COUPON', code: null })}
              aria-label={`Remove coupon ${applied}`}
              title="Remove coupon"
            >
              ✕
            </button>
          </span>
          {status === 'pending' ? (
            <span className="subtle" style={{ fontSize: 12 }}>
              awaiting evaluation
            </span>
          ) : null}
        </div>
        {rejection ? (
          <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>
            {rejection.reason}
          </div>
        ) : null}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Empty — input + Apply
  // -------------------------------------------------------------------------

  return (
    <div>
      <label className="label" htmlFor="coupon-code">
        Coupon
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id="coupon-code"
          className="input mono"
          placeholder="Enter code"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={apply}
          disabled={value.trim() === ''}
          style={{ flexShrink: 0 }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
