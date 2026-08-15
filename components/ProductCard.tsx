'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { formatCurrency, useStore } from '@/lib/state';
import type { Product } from '@/lib/types';

// ---------------------------------------------------------------------------
// Draft helpers — every editable field is held as a string while editing so
// the inputs can be emptied without ever producing NaN in state.
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
}

function numToDraft(value: number | undefined): string {
  return value === undefined || Number.isNaN(value) ? '' : String(value);
}

function toDraft(product: Product): Draft {
  return {
    name: product.name,
    sku: product.sku,
    price: numToDraft(product.price),
    category: product.category,
    weight: numToDraft(product.weight),
    height: numToDraft(product.height),
    width: numToDraft(product.width),
    length: numToDraft(product.length),
  };
}

interface ParsedNumber {
  ok: boolean;
  /** undefined means "field left blank" */
  value: number | undefined;
}

/** Blank -> undefined. Non-numeric -> not ok (save is blocked). */
function parseOptionalNumber(raw: string): ParsedNumber {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: undefined };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return { ok: false, value: undefined };
  return { ok: true, value: parsed };
}

/** Blank -> 0. Non-numeric -> not ok (save is blocked). Never NaN. */
function parsePrice(raw: string): ParsedNumber {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: 0 };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return { ok: false, value: 0 };
  return { ok: true, value: parsed };
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function IconButton({
  label,
  onClick,
  children,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  tone?: 'default' | 'danger';
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26,
        height: 26,
        padding: 0,
        borderRadius: 'var(--r-sm)',
        lineHeight: 1,
        fontSize: 13,
        color: hover
          ? tone === 'danger'
            ? 'var(--danger)'
            : 'var(--accent)'
          : 'var(--text-subtle)',
        background: hover
          ? tone === 'danger'
            ? 'var(--danger-soft)'
            : 'var(--accent-soft)'
          : 'transparent',
      }}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

const invalidStyle: CSSProperties = {
  borderColor: 'var(--danger)',
  boxShadow: '0 0 0 3px var(--danger-soft)',
};

// ---------------------------------------------------------------------------
// ProductCard
// ---------------------------------------------------------------------------

export interface ProductCardProps {
  product: Product;
  /**
   * Controlled edit mode. When omitted the card manages its own edit state.
   * CatalogPanel uses this to open a freshly added product in edit mode.
   */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

export default function ProductCard({ product, editing, onEditingChange }: ProductCardProps) {
  const { dispatch } = useStore();
  const [internalEditing, setInternalEditing] = useState(false);
  const [hover, setHover] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(product));

  const isEditing = editing ?? internalEditing;

  const setEditing = (next: boolean) => {
    if (editing === undefined) setInternalEditing(next);
    onEditingChange?.(next);
  };

  // Reset the draft from the product every time the card enters edit mode, so
  // Cancel is a true revert and a re-open never shows stale text.
  useEffect(() => {
    if (isEditing) setDraft(toDraft(product));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const set = (key: keyof Draft) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // --- validation ---------------------------------------------------------
  const nameOk = draft.name.trim() !== '';
  const categoryOk = draft.category.trim() !== '';
  const price = parsePrice(draft.price);
  const weight = parseOptionalNumber(draft.weight);
  const height = parseOptionalNumber(draft.height);
  const width = parseOptionalNumber(draft.width);
  const length = parseOptionalNumber(draft.length);
  const canSave =
    nameOk && categoryOk && price.ok && weight.ok && height.ok && width.ok && length.ok;

  const save = () => {
    if (!canSave) return;
    // Blank dimensions become `undefined` (never NaN, never 0); price is always
    // a finite number. Catalog-only: cart lines already added are untouched.
    dispatch({
      type: 'UPDATE_PRODUCT',
      id: product.id,
      patch: {
        name: draft.name.trim(),
        sku: draft.sku.trim(),
        price: price.value ?? 0,
        category: draft.category.trim(),
        weight: weight.value,
        height: height.value,
        width: width.value,
        length: length.value,
      },
    });
    setEditing(false);
  };

  const cancel = () => {
    setDraft(toDraft(product));
    setEditing(false);
  };

  const cardStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: 14,
    height: '100%',
    minWidth: 0,
    transition: 'box-shadow 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
  };

  // ------------------------------------------------------------------ EDIT --
  if (isEditing) {
    return (
      <div
        className="card"
        style={{
          ...cardStyle,
          gap: 10,
          gridColumn: '1 / -1',
          borderColor: 'var(--accent)',
          boxShadow: '0 0 0 3px var(--accent-soft)',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            save();
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="panel-title">Edit product</span>
          <span className="mono subtle" style={{ marginLeft: 'auto' }}>
            {product.id}
          </span>
        </div>

        <Field label="Name">
          <input
            className="input"
            value={draft.name}
            autoFocus
            onChange={(e) => set('name')(e.target.value)}
            style={nameOk ? undefined : invalidStyle}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: 10 }}>
          <Field label="SKU">
            <input
              className="input mono"
              value={draft.sku}
              onChange={(e) => set('sku')(e.target.value)}
            />
          </Field>
          <Field label="Price (USD)">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={draft.price}
              placeholder="0.00"
              onChange={(e) => set('price')(e.target.value)}
              style={price.ok ? undefined : invalidStyle}
            />
          </Field>
          <Field label="Category">
            <input
              className="input"
              value={draft.category}
              placeholder="e.g. cables"
              onChange={(e) => set('category')(e.target.value)}
              style={categoryOk ? undefined : invalidStyle}
            />
          </Field>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
            gap: 10,
          }}
        >
          <Field label="Weight (g)">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={draft.weight}
              placeholder="—"
              onChange={(e) => set('weight')(e.target.value)}
              style={weight.ok ? undefined : invalidStyle}
            />
          </Field>
          <Field label="Height (mm)">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={draft.height}
              placeholder="—"
              onChange={(e) => set('height')(e.target.value)}
              style={height.ok ? undefined : invalidStyle}
            />
          </Field>
          <Field label="Width (mm)">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={draft.width}
              placeholder="—"
              onChange={(e) => set('width')(e.target.value)}
              style={width.ok ? undefined : invalidStyle}
            />
          </Field>
          <Field label="Length (mm)">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={draft.length}
              placeholder="—"
              onChange={(e) => set('length')(e.target.value)}
              style={length.ok ? undefined : invalidStyle}
            />
          </Field>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span className="subtle" style={{ fontSize: 11 }}>
            {canSave
              ? 'Blank dimensions are omitted from the API payload.'
              : 'Name and category are required; price must be a number.'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={cancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm" onClick={save} disabled={!canSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ VIEW --
  return (
    <div
      className="card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...cardStyle,
        gap: 6,
        boxShadow: hover ? 'var(--shadow-md)' : undefined,
        borderColor: hover ? 'var(--border-strong)' : undefined,
        transform: hover ? 'translateY(-1px)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span className="chip chip-muted" style={{ maxWidth: '100%', overflow: 'hidden' }}>
          <span
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={product.category}
          >
            {product.category || '—'}
          </span>
        </span>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: 2,
            opacity: hover ? 1 : 0.55,
            transition: 'opacity 0.15s ease',
          }}
        >
          <IconButton label={`Edit ${product.name}`} onClick={() => setEditing(true)}>
            ✎
          </IconButton>
          <IconButton
            label={`Remove ${product.name} from catalog`}
            tone="danger"
            onClick={() => dispatch({ type: 'REMOVE_PRODUCT', id: product.id })}
          >
            ✕
          </IconButton>
        </div>
      </div>

      <div
        title={product.name}
        style={{
          fontWeight: 600,
          lineHeight: 1.35,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: '2.7em',
        }}
      >
        {product.name}
      </div>

      <div
        className="mono subtle"
        title={product.sku}
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {product.sku}
      </div>

      <div
        style={{
          marginTop: 'auto',
          paddingTop: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>
          {formatCurrency(product.price)}
        </span>
      </div>

      <button
        type="button"
        className="btn btn-sm"
        style={{ width: '100%', marginTop: 8 }}
        onClick={() => dispatch({ type: 'ADD_TO_CART', product })}
      >
        Add to cart
      </button>
    </div>
  );
}
