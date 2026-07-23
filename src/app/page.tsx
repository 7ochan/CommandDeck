import { TerminalWorkspace } from '@/components/layout/terminal-workspace';

export default function Home() {
  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#05080d] p-3 sm:p-4">
      <header className="flex h-12 shrink-0 items-center justify-between px-1 sm:px-2">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 font-mono text-xs font-semibold text-emerald-300">
            &gt;_
          </span>
          <div>
            <h1 className="font-mono text-sm tracking-[0.18em] text-slate-200 uppercase">
              CommandDeck
            </h1>
            <p className="text-[11px] text-slate-500">
              Visual command workspace
            </p>
          </div>
        </div>

        <span className="rounded-full border border-white/8 bg-white/3 px-3 py-1 font-mono text-[11px] text-slate-500">
          Local only
        </span>
      </header>

      <TerminalWorkspace />
    </main>
  );
}
