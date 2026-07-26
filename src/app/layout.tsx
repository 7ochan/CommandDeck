import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ElectronBridge } from '@/components/electron/electron-bridge';
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
          {/* ElectronBridge wires native menu actions (Cmd+,, etc.) into React */}
          <ElectronBridge />
          <CommandPaletteProvider>{children}</CommandPaletteProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
