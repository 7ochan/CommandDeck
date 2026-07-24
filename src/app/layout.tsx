import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { CommandPaletteProvider } from '@/features/command-palette/command-palette-provider';

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
      <body>
        <CommandPaletteProvider>{children}</CommandPaletteProvider>
      </body>
    </html>
  );
}
