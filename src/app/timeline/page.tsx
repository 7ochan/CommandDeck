import { AppHeader } from '@/components/layout/app-header';
import { WorkspaceTimelinePage } from '@/features/timeline/components/workspace-timeline-page';

export default function TimelinePage() {
  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#05080d] p-3 sm:p-4">
      <AppHeader activeView="timeline" />
      <WorkspaceTimelinePage />
    </main>
  );
}
