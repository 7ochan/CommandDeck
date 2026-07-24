'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { requestDeveloperHubTab } from '@/components/layout/developer-hub-navigation';
import {
  useCommandPalette,
  useRegisterCommandPaletteActions,
} from '@/features/command-palette/command-palette-provider';
import type { CommandPaletteAction } from '@/features/command-palette/types';

type AppHeaderProps = {
  activeView: 'terminal' | 'timeline';
};

export function AppHeader({ activeView }: AppHeaderProps) {
  const router = useRouter();
  const { openPalette } = useCommandPalette();
  const shortcutLabel = '⌘K / Ctrl K';
  const navigationActions = useMemo<CommandPaletteAction[]>(
    () => [
      {
        id: 'open-terminal',
        label: 'Open Terminal',
        description: 'Return to the active terminal workspace',
        group: 'Navigation',
        icon: '>_',
        keywords: ['terminal view', 'home'],
        priority: 120,
        execute: () => router.push('/'),
      },
      {
        id: 'open-timeline',
        label: 'Open Timeline',
        description: 'Browse Workspace activity sessions',
        group: 'Navigation',
        icon: '↗',
        keywords: ['timeline view', 'activity'],
        priority: 120,
        execute: () => router.push('/timeline'),
      },
      {
        id: 'open-deck',
        label: 'Open Deck tab',
        description: 'Show the Command Deck in Developer Hub',
        group: 'Navigation',
        icon: '▶',
        tone: 'cyan',
        keywords: ['developer hub', 'commands'],
        priority: 115,
        execute: () => {
          requestDeveloperHubTab('deck');
          router.push('/');
        },
      },
      {
        id: 'open-history',
        label: 'Open History tab',
        description: 'Show Command History in Developer Hub',
        group: 'Navigation',
        icon: '↺',
        tone: 'green',
        keywords: ['developer hub', 'past commands'],
        priority: 115,
        execute: () => {
          requestDeveloperHubTab('history');
          router.push('/');
        },
      },
    ],
    [router],
  );

  useRegisterCommandPaletteActions('app-navigation', navigationActions);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 px-1 sm:px-2">
      <div className="flex items-center gap-3">
        <span
          className="flex size-8 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 font-mono text-xs font-semibold text-emerald-300"
          aria-label="CommandDeck"
        >
          &gt;_
        </span>
        <div className="hidden sm:block">
          <h1 className="font-mono text-sm tracking-[0.18em] text-slate-200 uppercase">
            CommandDeck
          </h1>
          <p className="text-[11px] text-slate-500">Visual command workspace</p>
        </div>
      </div>

      <nav
        className="flex items-center rounded-lg border border-white/8 bg-white/3 p-0.5"
        aria-label="Primary views"
      >
        <ViewLink href="/" isActive={activeView === 'terminal'}>
          Terminal
        </ViewLink>
        <ViewLink href="/timeline" isActive={activeView === 'timeline'}>
          Timeline
        </ViewLink>
      </nav>

      <button
        type="button"
        className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-2 text-slate-500 transition-colors hover:border-cyan-300/20 hover:bg-cyan-300/5 hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:outline-none sm:px-2.5"
        aria-label={`Open Command Palette, ${shortcutLabel}`}
        title="Open Command Palette"
        onClick={openPalette}
      >
        <span className="font-mono text-xs text-cyan-200/60" aria-hidden="true">
          ⌕
        </span>
        <span className="hidden text-[10px] sm:inline">Command</span>
        <kbd className="hidden rounded border border-white/8 bg-black/15 px-1.5 py-0.5 font-mono text-[8px] text-slate-600 md:inline">
          {shortcutLabel}
        </kbd>
      </button>
    </header>
  );
}

function ViewLink({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`rounded-md px-3 py-1.5 font-mono text-[10px] transition-colors focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:outline-none ${
        isActive
          ? 'bg-white/8 text-slate-200'
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {children}
    </Link>
  );
}
