import { useLibraryStore } from '../../stores/library-store'
import { useCatalogStore } from '../../stores/catalog-store'
import { useSharingStore } from '../../stores/sharing-store'
import { semanticColor, type SemanticStatus } from '../../design-system/tokens'

/**
 * FR-025 — the six Home states the user must be able to distinguish at a
 * glance, without navigating into submenus: no library / ready / issues /
 * sharing off / sharing on / PS2 connected. Pure selector combining
 * library-store + catalog-store + sharing-store, no side effects.
 */
export type HomeState =
  | 'no-library'
  | 'library-issues'
  | 'ready-to-share'
  | 'sharing-off'
  | 'sharing-on-idle'
  | 'ps2-connected'

export interface HomeStatusView {
  state: HomeState
  title: string
  subtitle: string
  status: SemanticStatus
  primaryAction: 'select-library' | 'catalog-library' | 'go-to-sharing' | 'none'
}

export function deriveHomeState(): HomeStatusView {
  const library = useLibraryStore.getState()
  const catalog = useCatalogStore.getState()
  const sharing = useSharingStore.getState()

  if (!library.library || !library.library.accessValid) {
    return {
      state: 'no-library',
      title: 'Nenhuma biblioteca configurada',
      subtitle: 'Selecione a pasta que representa sua biblioteca OPL para começar.',
      status: 'neutral',
      primaryAction: 'select-library'
    }
  }

  if (catalog.snapshot && catalog.snapshot.issueCount > 0) {
    return {
      state: 'library-issues',
      title: 'Biblioteca com problemas',
      subtitle: `${catalog.snapshot.issueCount} item(ns) precisam de atenção.`,
      status: 'warning',
      primaryAction: 'catalog-library'
    }
  }

  if (sharing.session?.state === 'running-connected') {
    return {
      state: 'ps2-connected',
      title: 'PS2 conectado',
      subtitle: `Biblioteca disponível em ${sharing.session.boundAddress}.`,
      status: 'active',
      primaryAction: 'go-to-sharing'
    }
  }

  if (sharing.session?.state === 'running-idle' || sharing.session?.state === 'starting') {
    return {
      state: 'sharing-on-idle',
      title: 'Compartilhando, aguardando conexão',
      subtitle: 'Configure o PS2 para se conectar à biblioteca.',
      status: 'success',
      primaryAction: 'go-to-sharing'
    }
  }

  if (!catalog.snapshot || catalog.snapshot.state !== 'completed') {
    return {
      state: 'ready-to-share',
      title: 'Biblioteca pronta',
      subtitle: 'Catalogue a biblioteca antes de compartilhar com o PS2.',
      status: 'neutral',
      primaryAction: 'catalog-library'
    }
  }

  return {
    state: 'sharing-off',
    title: 'Compartilhamento desligado',
    subtitle: `${catalog.snapshot.countsByType.dvd + catalog.snapshot.countsByType.cd + catalog.snapshot.countsByType.ps1 + catalog.snapshot.countsByType.app} jogos catalogados.`,
    status: 'neutral',
    primaryAction: 'go-to-sharing'
  }
}

export function homeStateColor(view: HomeStatusView): string {
  return semanticColor(view.status)
}
