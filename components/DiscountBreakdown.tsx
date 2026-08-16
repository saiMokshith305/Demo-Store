'use client';

/**
 * The money summary at the foot of the cart: subtotal, one row per discount
 * effect, shipping, total.
 *
 * Discounts come from `parsed.discountLines` (derived from the response
 * `effects` array), never from `customerSession.discounts` — the effects array
 * is the authoritative breakdown and carries the campaign labels worth showing
 * on a screen-share. Effects that are not discounts are listed under a
 * collapsible so nothing the API returned is silently dropped.
 */

import { useState, type CSSProperties } from 'react';
import { useStore, cartSubtotal, formatCurrency } from '@/lib/state';
import type { DiscountLine, GenericEffect } from '@/lib/types';

interface GroupedDiscount {
  key: string;
  label: string;
  ruleName?: string;
  position?: number;
  /** summed across every unit in the group */
  value: number;
  /** how many per-unit effects were folded together */
  units: number;
}

/**
 * Talon.One splits a quantity>1 cart line into one effect per unit, so a 2x
 * line returns two identical effects differing only by subPosition. Rendering
 * them as separate rows reads as a duplication bug on a screen-share, so
 * identical labels are folded into a single row carrying a unit count.
 *
 * Only presentation: the summed values still equal `parsed.totalDiscount`,
 * and the raw per-unit effects remain visible in the API inspector.
 */
function groupDiscountLines(lines: DiscountLine[]): GroupedDiscount[] {
  const groups: GroupedDiscount[] = [];
  const byKey = new Map<string, GroupedDiscount>();

  for (const line of lines) {
    const key = `${line.effectType}-${line.label}-${line.position ?? 'na'}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.value += line.value;
      existing.units += 1;
      continue;
    }
    const group: GroupedDiscount = {
      key,
      label: line.label,
      value: line.value,
      units: 1,
      ...(line.ruleName === undefined ? {} : { ruleName: line.ruleName }),
      ...(line.position === undefined ? {} : { position: line.position }),
    };
    byKey.set(key, group);
    groups.push(group);
  }

  return groups;
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 12,
  padding: '3px 0',
};

const amountStyle: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  flexShrink: 0,
};

const labelClampStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/** Renders an effect's props compactly: `key: value` pairs, one per line. */
function EffectProps({ props }: { props: Record<string, unknown> }) {
  const entries = Object.entries(props ?? {});
  if (entries.length === 0) {
    return (
      <div className="subtle" style={{ fontSize: 11 }}>
        no props
      </div>
    );
  }
  return (
    <div className="mono subtle" style={{ fontSize: 11, lineHeight: 1.6 }}>
      {entries.map(([key, value]) => (
        <div key={key} style={{ wordBreak: 'break-word' }}>
          {key}: {typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}
        </div>
      ))}
    </div>
  );
}

function OtherEffects({ effects }: { effects: GenericEffect[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ padding: '2px 4px', fontSize: 12 }}
      >
        <span aria-hidden="true" style={{ fontSize: 9 }}>
          {open ? '▼' : '▶'}
        </span>
        Other effects ({effects.length})
      </button>
      {open ? (
        <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 8 }}>
          {effects.map((effect, index) => (
            <li
              key={`${effect.effectType}-${index}`}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                padding: '6px 8px',
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="mono" style={{ fontWeight: 700 }}>
                  {effect.effectType}
                </span>
                {effect.ruleName ? (
                  <span className="subtle" style={{ fontSize: 11 }}>
                    {effect.ruleName}
                  </span>
                ) : null}
              </div>
              <EffectProps props={effect.props} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function DiscountBreakdown() {
  const { state } = useStore();
  const { cart, parsed, session } = state;

  const subtotal = cartSubtotal(cart);
  const totalDiscount = parsed?.totalDiscount ?? 0;
  const shipping = session.shippingCost > 0 ? session.shippingCost : 0;
  // Clamped: a discount larger than the cart must not render a negative total.
  const total = Math.max(0, subtotal - totalDiscount + shipping);

  const groupedDiscounts = groupDiscountLines(parsed?.discountLines ?? []);
  const otherEffects = parsed?.otherEffects ?? [];

  return (
    <div>
      <div style={rowStyle}>
        <span className="muted">Subtotal</span>
        <span style={amountStyle}>{formatCurrency(subtotal)}</span>
      </div>

      {groupedDiscounts.length > 0 ? (
        groupedDiscounts.map((discount) => (
          <div key={discount.key} style={rowStyle}>
            <span style={labelClampStyle} title={discount.ruleName ?? discount.label}>
              {discount.label}
              {typeof discount.position === 'number' ? (
                <span className="subtle" style={{ fontSize: 11 }}>
                  {' '}
                  · item {discount.position + 1}
                </span>
              ) : null}
              {discount.units > 1 ? (
                <span className="subtle" style={{ fontSize: 11 }}> ×{discount.units}</span>
              ) : null}
            </span>
            <span style={{ ...amountStyle, color: 'var(--success)', fontWeight: 600 }}>
              −{formatCurrency(discount.value)}
            </span>
          </div>
        ))
      ) : (
        <div className="subtle" style={{ fontSize: 12, padding: '3px 0' }}>
          No discounts applied
        </div>
      )}

      {shipping > 0 ? (
        <div style={rowStyle}>
          <span className="muted">Shipping</span>
          <span style={amountStyle}>{formatCurrency(shipping)}</span>
        </div>
      ) : null}

      <div
        style={{
          ...rowStyle,
          marginTop: 8,
          paddingTop: 10,
          borderTop: '1px solid var(--border)',
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        <span>Total</span>
        <span style={amountStyle}>{formatCurrency(total)}</span>
      </div>

      {otherEffects.length > 0 ? <OtherEffects effects={otherEffects} /> : null}
    </div>
  );
}
