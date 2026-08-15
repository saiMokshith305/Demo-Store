'use client';

import { useMemo, useState } from 'react';
import ProductCard from '@/components/ProductCard';
import { nextId, useStore } from '@/lib/state';
import type { Product } from '@/lib/types';

const ALL = '__all__';

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      className={`chip ${active ? '' : 'chip-muted'}`}
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: '1px solid',
        borderColor: active ? 'transparent' : hover ? 'var(--border-strong)' : 'var(--border)',
        background: active ? 'var(--accent-soft)' : hover ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        padding: '4px 10px',
        transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
      }}
    >
      <span>{label}</span>
      <span style={{ opacity: 0.65, fontWeight: 600 }}>{count}</span>
    </button>
  );
}

export default function CatalogPanel() {
  const { state, dispatch } = useStore();
  const catalog = state.catalog;

  const [selected, setSelected] = useState<string>(ALL);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Categories are derived from the products themselves — they are editable
  // free text, so nothing here may be hardcoded.
  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const p of catalog) {
      const key = p.category.trim();
      if (!key) continue;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalog]);

  // If the selected category was renamed or removed, fall back to "All".
  const effective = selected !== ALL && categories.some(([c]) => c === selected) ? selected : ALL;

  const visible = useMemo(
    () => (effective === ALL ? catalog : catalog.filter((p) => p.category.trim() === effective)),
    [catalog, effective],
  );

  const addProduct = () => {
    const product: Product = {
      id: nextId('product'),
      name: 'New product',
      sku: 'NEW-SKU',
      price: 0,
      category: 'accessories',
    };
    dispatch({ type: 'ADD_PRODUCT', product });
    setSelected(ALL); // make sure the new card is not hidden by the active filter
    setEditingId(product.id);
  };

  return (
    <section
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span className="panel-title">Catalog</span>
        <span className="subtle" style={{ fontSize: 12 }}>
          {catalog.length} {catalog.length === 1 ? 'product' : 'products'}
          {effective !== ALL ? ` · ${visible.length} shown` : ''}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={addProduct}
          style={{ marginLeft: 'auto' }}
        >
          <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>
            +
          </span>
          Add product
        </button>
      </header>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
        }}
      >
        <CategoryChip
          label="All"
          count={catalog.length}
          active={effective === ALL}
          onClick={() => setSelected(ALL)}
        />
        {categories.map(([category, count]) => (
          <CategoryChip
            key={category}
            label={category}
            count={count}
            active={effective === category}
            onClick={() => setSelected(category)}
          />
        ))}
      </div>

      <div className="scroll-y" style={{ flex: 1, minHeight: 0, padding: 16 }}>
        {visible.length === 0 ? (
          <div
            className="muted"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '48px 16px',
              textAlign: 'center',
            }}
          >
            <span>No products in the catalog yet.</span>
            <button type="button" className="btn btn-sm" onClick={addProduct}>
              Add product
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
              alignItems: 'stretch',
            }}
          >
            {visible.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                editing={editingId === product.id}
                onEditingChange={(editing) => setEditingId(editing ? product.id : null)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
