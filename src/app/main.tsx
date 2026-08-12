import React from 'react'
import ReactDOM from 'react-dom/client'
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@/layouts/AppShell'
import { CatalogPage } from '@/pages/CatalogPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DevicesPage } from '@/pages/DevicesPage'
import { GameLibraryPage } from '@/pages/GameLibraryPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ToolsPage } from '@/pages/ToolsPage'
import '@/i18n'
import '@/styles/globals.css'

const queryClient = new QueryClient()

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'devices', element: <DevicesPage /> },
      { path: 'library', element: <GameLibraryPage /> },
      { path: 'catalog', element: <CatalogPage /> },
      { path: 'tools', element: <ToolsPage /> },
      { path: 'settings', element: <SettingsPage /> },

      // Backward compatibility redirects for legacy routes
      { path: 'dashboard', element: <Navigate to="/" replace /> },
      { path: 'prepare', element: <Navigate to="/devices?action=prepare" replace /> },
      { path: 'games/ps2', element: <Navigate to="/library?type=ps2" replace /> },
      { path: 'games/ps1', element: <Navigate to="/library?type=ps1" replace /> },
      { path: 'apps', element: <Navigate to="/library?type=apps" replace /> },
      { path: 'fragmentation-repair', element: <Navigate to="/tools?tab=diagnostics" replace /> },
      { path: 'naming', element: <Navigate to="/library" replace /> },
      { path: 'validation', element: <Navigate to="/library" replace /> },
      { path: 'catalog/essentials', element: <Navigate to="/catalog?tab=discover" replace /> },
      { path: 'art-manager', element: <Navigate to="/catalog?tab=artsync" replace /> },
      { path: 'sources', element: <Navigate to="/library?action=add" replace /> },
      { path: 'sources/online', element: <Navigate to="/catalog?tab=online" replace /> },
      { path: 'downloads', element: <Navigate to="/catalog?tab=downloads" replace /> },
      { path: 'history', element: <Navigate to="/tools?tab=history" replace /> },
      { path: 'settings/sources', element: <Navigate to="/settings?tab=sources" replace /> }
    ]
  }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
)
