'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { requestDeveloperHubTab } from '@/components/layout/developer-hub-navigation';
import { Icon, type IconName } from '@/components/ui/icon';
import {
  useCommandPalette,
  useRegisterCommandPaletteActions,
} from '@/features/command-palette/command-palette-provider';
import type { CommandPaletteAction } from '@/features/command-palette/types';
import { useKeybindings } from '@/features/keybindings/keybindings-provider';
import { useSettings } from '@/features/settings/settings-provider';

type AppHeaderProps = {
  activeView: 'terminal' | 'timeline';
};

export function AppHeader({ activeView }: AppHeaderProps) {
  const router = useRouter();
  const { openPalette } = useCommandPalette();
  const { openSettings, settings, updateSettings } = useSettings();
  const { setActionHandler, formatShortcut, actions } = useKeybindings();

  const commandPaletteAction = actions.find(
    (a) => a.id === 'app.openCommandPalette',
  );
  const shortcutLabel = commandPaletteAction
    ? formatShortcut(commandPaletteAction.currentShortcut)
    : '⌘K';

  useEffect(() => {
    const unbindSettings = setActionHandler('app.openSettings', openSettings);
    const unbindHistory = setActionHandler('app.toggleHistory', () => {
      requestDeveloperHubTab('history');
      router.push('/');
    });
    const unbindDeck = setActionHandler('app.toggleDeck', () => {
      requestDeveloperHubTab('deck');
      router.push('/');
    });
    return () => {
      unbindSettings();
      unbindHistory();
      unbindDeck();
    };
  }, [openSettings, router, setActionHandler]);
  const navigationActions = useMemo<CommandPaletteAction[]>(
    () => [
      {
        id: 'open-settings',
        label: 'Open Settings',
        description: 'Configure CommandDeck preferences',
        group: 'Navigation',
        icon: '⚙',
        keywords: ['preferences', 'terminal font', 'theme'],
        priority: 115,
        execute: openSettings,
      },
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
    [openSettings, router],
  );

  useRegisterCommandPaletteActions('app-navigation', navigationActions);

  return (
    <header className="flex h-13 shrink-0 items-center justify-between gap-3 px-0.5 sm:px-1.5">
      <div className="flex min-w-0 items-center">
        <h1 className="cd-brand-title text-[15px] leading-4 font-normal tracking-[-0.01em] text-[var(--text-primary)]">
          CommandDeck
        </h1>
      </div>

      <nav
        className="cd-inset-tray flex items-center rounded-[10px] p-1"
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

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          className="cd-button h-9 px-2.5 sm:px-3"
          aria-label={`Open Command Palette (${shortcutLabel})`}
          title="Open Command Palette"
          onClick={openPalette}
        >
          <Icon name="search" size={15} />
          <span className="hidden sm:inline">Commands</span>
          <kbd className="cd-kbd hidden md:inline-flex">{shortcutLabel}</kbd>
        </button>
        <button
          type="button"
          className="cd-icon-button h-9 w-9"
          aria-label="Open Settings"
          title="Settings"
          onClick={openSettings}
        >
          <Icon name="settings" size={16} />
        </button>
      </div>
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
      className={`flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-[background-color,color,border-color,box-shadow] ${
        isActive
          ? 'cd-segment-active'
          : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]'
      }`}
    >
      <Icon name={icon} size={14} />
      {children}
    </Link>
  );
}
