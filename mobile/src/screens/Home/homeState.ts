import { useLibraryStore } from '../../stores/library-store'
import { useCatalogStore } from '../../stores/catalog-store'
import { useSharingStore } from '../../stores/sharing-store'
import { semanticColor, type SemanticStatus } from '../../design-system/tokens'
import i18n from '../../i18n'

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
      title: i18n.t('homeState.noLibrary.title'),
      subtitle: i18n.t('homeState.noLibrary.subtitle'),
      status: 'neutral',
      primaryAction: 'select-library'
    }
  }

  if (catalog.snapshot && catalog.snapshot.issueCount > 0) {
    return {
      state: 'library-issues',
      title: i18n.t('homeState.libraryIssues.title'),
      subtitle: i18n.t('homeState.libraryIssues.subtitle', { count: catalog.snapshot.issueCount }),
      status: 'warning',
      primaryAction: 'catalog-library'
    }
  }

  if (sharing.session?.state === 'running-connected') {
    return {
      state: 'ps2-connected',
      title: i18n.t('homeState.ps2Connected.title'),
      subtitle: i18n.t('homeState.ps2Connected.subtitle', { address: sharing.session.boundAddress }),
      status: 'active',
      primaryAction: 'go-to-sharing'
    }
  }

  if (sharing.session?.state === 'running-idle' || sharing.session?.state === 'starting') {
    return {
      state: 'sharing-on-idle',
      title: i18n.t('homeState.sharingOnIdle.title'),
      subtitle: i18n.t('homeState.sharingOnIdle.subtitle'),
      status: 'success',
      primaryAction: 'go-to-sharing'
    }
  }

  if (!catalog.snapshot || catalog.snapshot.state !== 'completed') {
    return {
      state: 'ready-to-share',
      title: i18n.t('homeState.readyToShare.title'),
      subtitle: i18n.t('homeState.readyToShare.subtitle'),
      status: 'neutral',
      primaryAction: 'catalog-library'
    }
  }

  return {
    state: 'sharing-off',
    title: i18n.t('homeState.sharingOff.title'),
    subtitle: i18n.t('homeState.sharingOff.subtitle', {
      count:
        catalog.snapshot.countsByType.dvd +
        catalog.snapshot.countsByType.cd +
        catalog.snapshot.countsByType.ps1 +
        catalog.snapshot.countsByType.app
    }),
    status: 'neutral',
    primaryAction: 'go-to-sharing'
  }
}

export function homeStateColor(view: HomeStatusView): string {
  return semanticColor(view.status)
}
