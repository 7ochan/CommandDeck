import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@xterm/xterm/css/xterm.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'CommandDeck',
  description: 'A local-first visual terminal workspace.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
