import { Outlet } from 'react-router-dom'
import { Header } from '@/components/Header'
import { ActivityStatusBar } from '@/components/activity/ActivityStatusBar'
import { ActivityDrawer } from '@/components/activity/ActivityDrawer'
import { ProgressModal } from '@/components/ProgressModal'
import { Sidebar } from '@/components/Sidebar'
import { useElectronEvents } from '@/hooks/use-electron-events'
import { DownloadToast } from '@/components/downloads/DownloadToast'
import { DownloadLifecycleMonitor } from '@/components/downloads/DownloadLifecycleMonitor'

export function AppShell() {
  useElectronEvents()

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Background radial gradient glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.24),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.1),transparent_30%)]" />

      {/* Consolidated 6-item primary sidebar */}
      <Sidebar />

      {/* Main workspace container */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />

        {/* Main page content scrollable pane */}
        <div className="flex-1 overflow-auto px-6 py-5">
          <Outlet />
        </div>

        {/* Dynamic expandable activity console drawer */}
        <ActivityDrawer />

        {/* Non-intrusive 36px bottom status bar */}
        <ActivityStatusBar />
      </main>

      <ProgressModal />
      <DownloadToast />
      <DownloadLifecycleMonitor />
    </div>
  )
}
