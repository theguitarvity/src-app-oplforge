export interface PrimaryNavItem {
  id: string
  label: string
  to: string
  iconName: 'Home' | 'HardDrive' | 'LibraryBig' | 'Search' | 'Wrench' | 'Settings'
  badgeCount?: number
}

export const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  { id: 'home', label: 'Home', to: '/', iconName: 'Home' },
  { id: 'devices', label: 'Dispositivos', to: '/devices', iconName: 'HardDrive' },
  { id: 'library', label: 'Biblioteca', to: '/library', iconName: 'LibraryBig' },
  { id: 'catalog', label: 'Catálogo', to: '/catalog', iconName: 'Search' },
  { id: 'tools', label: 'Ferramentas', to: '/tools', iconName: 'Wrench' },
  { id: 'settings', label: 'Configurações', to: '/settings', iconName: 'Settings' }
]
