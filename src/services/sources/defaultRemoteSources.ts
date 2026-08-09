import type { ManagedSourceConfig } from '@/types/opl'

export const DEFAULT_REMOTE_SOURCES: ManagedSourceConfig[] = [
  {
    id: 'ia-playstation2-essentials',
    name: 'Internet Archive - PlayStation 2 Essentials',
    type: 'internet-archive-directory',
    baseUrl: 'https://archive.org/download/playstation2_essentials',
    detailsUrl: 'https://archive.org/details/playstation2_essentials',
    enabled: true,
    legalMode: 'user-owned-backup-required'
  },
  {
    id: 'ia-playstation2-essentials-part2',
    name: 'Internet Archive - PlayStation 2 Essentials Part 2',
    type: 'internet-archive-directory',
    baseUrl: 'https://archive.org/download/playstation2_essentials_part2',
    detailsUrl: 'https://archive.org/details/playstation2_essentials_part2',
    enabled: true,
    legalMode: 'user-owned-backup-required'
  },
  {
    id: 'ia-oplm-art-2024-09',
    name: 'OPLM ART 2024-09',
    type: 'internet-archive-art-pack',
    baseUrl: 'https://archive.org/details/OPLM_ART_2024_09',
    enabled: true,
    legalMode: 'metadata-assets'
  }
]
