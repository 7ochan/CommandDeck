'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { requestDeveloperHubTab } from '@/components/layout/developer-hub-navigation';
import { Icon, type IconName } from '@/components/ui/icon';
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
  const shortcutLabel = '⌘K';
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
    <header className="flex h-13 shrink-0 items-center justify-between gap-3 px-0.5 sm:px-1.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          aria-label="CommandDeck"
        >
          <Icon name="terminal" size={17} strokeWidth={1.9} />
        </span>
        <div className="hidden sm:block">
          <h1 className="text-[13px] leading-4 font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
            CommandDeck
          </h1>
          <p className="text-[10px] leading-3.5 text-[var(--text-muted)]">
            Local command workspace
          </p>
        </div>
      </div>

      <nav
        className="flex items-center rounded-[9px] border border-[var(--border-soft)] bg-[var(--canvas-raised)] p-1"
        aria-label="Primary views"
      >
        <ViewLink href="/" icon="terminal" isActive={activeView === 'terminal'}>
          Terminal
        </ViewLink>
        <ViewLink
          href="/timeline"
          icon="timeline"
          isActive={activeView === 'timeline'}
        >
          Timeline
        </ViewLink>
      </nav>

      <button
        type="button"
        className="cd-button h-9 shrink-0 px-2.5 sm:px-3"
        aria-label="Open Command Palette, Command K or Control K"
        title="Open Command Palette"
        onClick={openPalette}
      >
        <Icon name="search" size={15} />
        <span className="hidden sm:inline">Commands</span>
        <kbd className="cd-kbd hidden md:inline-flex">{shortcutLabel}</kbd>
      </button>
    </header>
  );
}

function ViewLink({
  href,
  icon,
  isActive,
  children,
}: {
  href: string;
  icon: IconName;
  isActive: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition-colors ${
        isActive
          ? 'bg-[var(--surface-3)] text-[var(--text-primary)] shadow-[inset_0_0_0_1px_var(--border)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]'
      }`}
    >
      <Icon name={icon} size={14} />
      {children}
    </Link>
  );
}
