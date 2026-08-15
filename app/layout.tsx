import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Best Buy × Talon.One Demo',
  description: 'Cart and campaign demo harness for the Talon.One Integration API',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
