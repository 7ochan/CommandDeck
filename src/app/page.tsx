import { AppHeader } from '@/components/layout/app-header';
import { TerminalWorkspace } from '@/components/layout/terminal-workspace';

export default function Home() {
  return (
    <main className="cd-app flex h-dvh min-h-0 flex-col overflow-hidden p-2.5 sm:p-3">
      <AppHeader activeView="terminal" />

      <TerminalWorkspace />
    </main>
  );
}
