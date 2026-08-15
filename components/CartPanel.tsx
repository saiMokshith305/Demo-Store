'use client';

/**
 * Right-hand CART column.
 *
 * The line list scrolls internally so the coupon field and the totals stay
 * pinned and visible at the bottom of the panel no matter how long the cart
 * gets — during a screen-share the discount lines are the point, and they must
 * never scroll out of view.
 */

import type { CSSProperties } from 'react';
import { useStore } from '@/lib/state';
import CartLineRow from './CartLineRow';
import CouponInput from './CouponInput';
import DiscountBreakdown from './DiscountBreakdown';

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
};

const footerStyle: CSSProperties = {
  flexShrink: 0,
  padding: '14px 16px 16px',
  borderTop: '1px solid var(--border)',
  background: 'var(--surface-2)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  borderBottomLeftRadius: 'var(--r-md)',
  borderBottomRightRadius: 'var(--r-md)',
};

function CartIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 4h2.2l2.1 10.2a1.6 1.6 0 0 0 1.6 1.3h7.6a1.6 1.6 0 0 0 1.6-1.2L20 7H6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="19" r="1.3" fill="currentColor" />
      <circle cx="17" cy="19" r="1.3" fill="currentColor" />
    </svg>
  );
}

export default function CartPanel() {
  const { state, dispatch } = useStore();
  const { cart, syncing } = state;

  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const isEmpty = cart.length === 0;

  return (
    <section className="card" style={panelStyle} aria-label="Cart">
      <header style={headerStyle}>
        <h2 className="panel-title" style={{ margin: 0 }}>
          Cart
        </h2>
        <span className="chip chip-muted" aria-label={`${itemCount} items in cart`}>
          {itemCount}
        </span>

        {syncing ? (
          <span
            className="subtle"
            style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            role="status"
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'inline-block',
                opacity: 0.7,
              }}
            />
            syncing…
          </span>
        ) : null}

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => dispatch({ type: 'CLEAR_CART' })}
          disabled={isEmpty}
        >
          Clear
        </button>
      </header>

      <div className="scroll-y" style={{ flex: 1, minHeight: 0 }}>
        {isEmpty ? (
          <div
            style={{
              height: '100%',
              minHeight: 180,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '32px 24px',
              textAlign: 'center',
            }}
          >
            <span style={{ color: 'var(--border-strong)' }}>
              <CartIcon />
            </span>
            <div style={{ fontWeight: 600 }}>Your cart is empty</div>
            <div className="subtle" style={{ fontSize: 12, maxWidth: 240 }}>
              Add products from the catalog to start evaluating campaigns.
            </div>
          </div>
        ) : (
          cart.map((line, index) => (
            <CartLineRow key={line.lineId} line={line} isLast={index === cart.length - 1} />
          ))
        )}
      </div>

      <div style={footerStyle}>
        <CouponInput />
        <DiscountBreakdown />
      </div>
    </section>
  );
}
