'use client';

import { StoreProvider } from '@/lib/state';

export default function Page() {
  return (
    <StoreProvider>
      <main style={{ padding: 24 }}>
        <h1>Best Buy × Talon.One</h1>
        <p className="muted">Scaffold placeholder — panels are wired in next.</p>
      </main>
    </StoreProvider>
  );
}
