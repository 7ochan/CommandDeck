import Link from 'next/link';

type AppHeaderProps = {
  activeView: 'terminal' | 'timeline';
};

export function AppHeader({ activeView }: AppHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 px-1 sm:px-2">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 font-mono text-xs font-semibold text-emerald-300">
          &gt;_
        </span>
        <div>
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

      <span className="hidden rounded-full border border-white/8 bg-white/3 px-3 py-1 font-mono text-[11px] text-slate-500 sm:block">
        Local only
      </span>
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
