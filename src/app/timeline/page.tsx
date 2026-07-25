import { AppHeader } from '@/components/layout/app-header';
import { WorkspaceTimelinePage } from '@/features/timeline/components/workspace-timeline-page';

export default function TimelinePage() {
  return (
    <main className="cd-app flex h-dvh min-h-0 flex-col overflow-hidden p-2.5 sm:p-3">
      <AppHeader activeView="timeline" />
      <WorkspaceTimelinePage />
    </main>
  );
}
