import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { CommandPaletteProvider } from '@/features/command-palette/command-palette-provider';
import { SettingsProvider } from '@/features/settings/settings-provider';

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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <SettingsProvider>
          <CommandPaletteProvider>{children}</CommandPaletteProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
