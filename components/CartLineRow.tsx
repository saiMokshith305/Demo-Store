'use client';

/**
 * One line of the cart, in either VIEW or EDIT mode.
 *
 * Everything here dispatches UPDATE_LINE / REMOVE_LINE only — a cart line is a
 * snapshot of a catalog product and editing it must never write back to the
 * catalog (see the design doc: the catalog is the reusable starting point, the
 * cart line is the scenario being demoed).
 */

import { useState, type CSSProperties } from 'react';
import { useStore, formatCurrency } from '@/lib/state';
import type { CartLine } from '@/lib/types';

export interface CartLineRowProps {
  line: CartLine;
  /** Suppresses the divider so it does not double up with the panel footer. */
  isLast?: boolean;
}

// ---------------------------------------------------------------------------
// Numeric parsing — blank inputs must never become NaN
// ---------------------------------------------------------------------------

/** Optional measurement: blank or unparseable → `undefined` (key omitted). */
function toOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Required money value: blank or unparseable → `0`, never NaN. */
function toRequiredNumber(raw: string): number {
  const parsed = toOptionalNumber(raw);
  return parsed === undefined ? 0 : parsed;
}

/** Number → input value, with `undefined` rendering as an empty field. */
function toInputValue(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

// ---------------------------------------------------------------------------
// Local edit draft
// ---------------------------------------------------------------------------

interface Draft {
  name: string;
  sku: string;
  price: string;
  category: string;
  weight: string;
  height: string;
  width: string;
  length: string;
  shipping: string;
}

function draftFromLine(line: CartLine): Draft {
  return {
    name: line.name,
    sku: line.sku,
    price: toInputValue(line.price),
    category: line.category,
    weight: toInputValue(line.weight),
    height: toInputValue(line.height),
    width: toInputValue(line.width),
    length: toInputValue(line.length),
    shipping: toInputValue(line.additionalCosts?.shipping?.price),
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const rowStyle: CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const stepperStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'stretch',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--r-sm)',
  overflow: 'hidden',
  background: 'var(--surface)',
};

const stepperBtnStyle: CSSProperties = {
  width: 28,
  height: 26,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
};

const stepperValueStyle: CSSProperties = {
  minWidth: 34,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  borderLeft: '1px solid var(--border)',
  borderRight: '1px solid var(--border)',
};

const fieldGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
};

const dimensionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 8,
};

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.3 1.9a1.4 1.4 0 0 1 2 2l-7.6 7.6-2.7.7.7-2.7 7.6-7.6Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M2 14.4h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.8 3.8l8.4 8.4M12.2 3.8l-8.4 8.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CartLineRow({ line, isLast = false }: CartLineRowProps) {
  const { dispatch } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFromLine(line));

  const baseStyle: CSSProperties = isLast
    ? { ...rowStyle, borderBottom: 'none' }
    : rowStyle;

  function setField(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startEditing() {
    setDraft(draftFromLine(line));
    setEditing(true);
  }

  function setQuantity(quantity: number) {
    // Never below 1 — dropping a line is the ✕ button's job.
    const next = Math.max(1, Math.floor(quantity));
    if (next === line.quantity) return;
    dispatch({ type: 'UPDATE_LINE', lineId: line.lineId, patch: { quantity: next } });
  }

  function save() {
    const shipping = toOptionalNumber(draft.shipping);
    dispatch({
      type: 'UPDATE_LINE',
      lineId: line.lineId,
      patch: {
        name: draft.name.trim() === '' ? line.name : draft.name.trim(),
        sku: draft.sku.trim(),
        price: toRequiredNumber(draft.price),
        category: draft.category.trim(),
        weight: toOptionalNumber(draft.weight),
        height: toOptionalNumber(draft.height),
        width: toOptionalNumber(draft.width),
        length: toOptionalNumber(draft.length),
        // Omit the whole object when there is no per-item shipping cost.
        additionalCosts:
          shipping !== undefined && shipping > 0 ? { shipping: { price: shipping } } : undefined,
      },
    });
    setEditing(false);
  }

  // -------------------------------------------------------------------------
  // EDIT
  // -------------------------------------------------------------------------

  if (editing) {
    return (
      <div style={{ ...baseStyle, background: 'var(--surface-2)', gap: 12 }}>
        <div style={fieldGridStyle}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor={`name-${line.lineId}`}>
              Name
            </label>
            <input
              id={`name-${line.lineId}`}
              className="input"
              value={draft.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor={`sku-${line.lineId}`}>
              SKU
            </label>
            <input
              id={`sku-${line.lineId}`}
              className="input mono"
              value={draft.sku}
              onChange={(e) => setField('sku', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor={`category-${line.lineId}`}>
              Category
            </label>
            <input
              id={`category-${line.lineId}`}
              className="input"
              value={draft.category}
              onChange={(e) => setField('category', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor={`price-${line.lineId}`}>
              Unit price
            </label>
            <input
              id={`price-${line.lineId}`}
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={draft.price}
              onChange={(e) => setField('price', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor={`shipping-${line.lineId}`}>
              Item shipping
            </label>
            <input
              id={`shipping-${line.lineId}`}
              className="input"
              type="number"
              min="0"
              step="0.01"
              placeholder="none"
              value={draft.shipping}
              onChange={(e) => setField('shipping', e.target.value)}
            />
          </div>
        </div>

        <div>
          <span className="label">Dimensions (g / mm) — optional</span>
          <div style={dimensionGridStyle}>
            <input
              className="input"
              type="number"
              step="1"
              placeholder="weight"
              aria-label="Weight in grams"
              value={draft.weight}
              onChange={(e) => setField('weight', e.target.value)}
            />
            <input
              className="input"
              type="number"
              step="1"
              placeholder="height"
              aria-label="Height in millimetres"
              value={draft.height}
              onChange={(e) => setField('height', e.target.value)}
            />
            <input
              className="input"
              type="number"
              step="1"
              placeholder="width"
              aria-label="Width in millimetres"
              value={draft.width}
              onChange={(e) => setField('width', e.target.value)}
            />
            <input
              className="input"
              type="number"
              step="1"
              placeholder="length"
              aria-label="Length in millimetres"
              value={draft.length}
              onChange={(e) => setField('length', e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-sm" onClick={save}>
            Save
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // VIEW
  // -------------------------------------------------------------------------

  const itemShipping = line.additionalCosts?.shipping?.price;

  return (
    <div style={baseStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, lineHeight: 1.35, wordBreak: 'break-word' }}>
            {line.name}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 4,
            }}
          >
            <span className="mono subtle">{line.sku}</span>
            {line.category ? <span className="chip chip-muted">{line.category}</span> : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={startEditing}
            aria-label={`Edit ${line.name}`}
            title="Edit line"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => dispatch({ type: 'REMOVE_LINE', lineId: line.lineId })}
            aria-label={`Remove ${line.name}`}
            title="Remove from cart"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={stepperStyle}>
          <button
            type="button"
            style={stepperBtnStyle}
            onClick={() => setQuantity(line.quantity - 1)}
            disabled={line.quantity <= 1}
            aria-label={`Decrease quantity of ${line.name}`}
          >
            −
          </button>
          <span style={stepperValueStyle} aria-live="polite">
            {line.quantity}
          </span>
          <button
            type="button"
            style={stepperBtnStyle}
            onClick={() => setQuantity(line.quantity + 1)}
            aria-label={`Increase quantity of ${line.name}`}
          >
            +
          </button>
        </div>

        <span className="subtle" style={{ fontSize: 12 }}>
          {formatCurrency(line.price)} each
          {typeof itemShipping === 'number' && itemShipping > 0
            ? ` · +${formatCurrency(itemShipping)} ship`
            : ''}
        </span>

        <span
          style={{
            marginLeft: 'auto',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatCurrency(line.price * line.quantity)}
        </span>
      </div>
    </div>
  );
}
