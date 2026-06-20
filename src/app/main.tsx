import React from 'react'
import ReactDOM from 'react-dom/client'
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@/layouts/AppShell'
import { ArtManagerPage } from '@/pages/ArtManagerPage'
import { AppsPage } from '@/pages/AppsPage'
import { CatalogPage } from '@/pages/CatalogPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DevicesPage } from '@/pages/DevicesPage'
import { DownloadsPage } from '@/pages/DownloadsPage'
import { EssentialsCatalogPage } from '@/pages/EssentialsCatalogPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { OnlineSourcesPage } from '@/pages/OnlineSourcesPage'
import { PreparePage } from '@/pages/PreparePage'
import { Ps1ImportPage } from '@/pages/Ps1ImportPage'
import { Ps2ImportPage } from '@/pages/Ps2ImportPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SourceSettingsPage } from '@/pages/SourceSettingsPage'
import { SourcesPage } from '@/pages/SourcesPage'
import '@/styles/globals.css'

const queryClient = new QueryClient()

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'devices', element: <DevicesPage /> },
      { path: 'prepare', element: <PreparePage /> },
      { path: 'games/ps2', element: <Ps2ImportPage /> },
      { path: 'games/ps1', element: <Ps1ImportPage /> },
      { path: 'apps', element: <AppsPage /> },
      { path: 'catalog', element: <CatalogPage /> },
      { path: 'catalog/essentials', element: <EssentialsCatalogPage /> },
      { path: 'art-manager', element: <ArtManagerPage /> },
      { path: 'sources', element: <SourcesPage /> },
      { path: 'sources/online', element: <OnlineSourcesPage /> },
      { path: 'downloads', element: <DownloadsPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/sources', element: <SourceSettingsPage /> }
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
