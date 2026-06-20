import { Outlet } from 'react-router-dom'
import { Header } from '@/components/Header'
import { LogPanel } from '@/components/LogPanel'
import { ProgressModal } from '@/components/ProgressModal'
import { Sidebar } from '@/components/Sidebar'
import { useElectronEvents } from '@/hooks/use-electron-events'

export function AppShell() {
  useElectronEvents()

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.12),transparent_28%)]" />
      <Sidebar />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Header />
        <div className="flex-1 overflow-auto px-6 py-5">
          <Outlet />
        </div>
        <LogPanel />
      </main>
      <ProgressModal />
    </div>
  )
}
