import { create } from 'zustand'
import type { LocalFolderAuthorization } from '@/types/opl'
export const useLocalLibraryStore = create<{
  folder?: LocalFolderAuthorization
  setFolder(folder: LocalFolderAuthorization): void
}>((set) => ({ setFolder: (folder) => set({ folder }) }))
