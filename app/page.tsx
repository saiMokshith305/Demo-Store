'use client';

import ApiInspector from '@/components/ApiInspector';
import Banner from '@/components/Banner';
import CartPanel from '@/components/CartPanel';
import CatalogPanel from '@/components/CatalogPanel';
import SessionBar from '@/components/SessionBar';
import Toaster from '@/components/Toaster';
import { StoreProvider } from '@/lib/state';
import { useSessionSync } from '@/lib/useSessionSync';

/**
 * Lives inside StoreProvider so the sync hook can reach the store.
 */
function DemoApp() {
  const { reevaluate } = useSessionSync();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        // keep content clear of the collapsed inspector drawer
        paddingBottom: 'var(--drawer-collapsed-h)',
      }}
    >
      <SessionBar />
      <Banner />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(360px, 1fr)',
          gap: 16,
          padding: 16,
        }}
      >
        <CatalogPanel />
        <CartPanel />
      </div>

      <ApiInspector onReevaluate={reevaluate} />
      <Toaster />
    </div>
  );
}

export default function Page() {
  return (
    <StoreProvider>
      <DemoApp />
    </StoreProvider>
  );
}
