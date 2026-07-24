import { AppHeader } from '@/components/layout/app-header';
import { TerminalWorkspace } from '@/components/layout/terminal-workspace';

export default function Home() {
  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#05080d] p-3 sm:p-4">
      <AppHeader activeView="terminal" />

      <TerminalWorkspace />
    </main>
  );
}
