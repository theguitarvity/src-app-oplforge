import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, FolderPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { oplApi } from '@/services/api'
import { useLocalLibraryStore } from '@/stores/local-library-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LocalLibraryChooser() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setFolder = useLocalLibraryStore((state) => state.setFolder)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState(t('shell.localLibraryChooser.defaultName'))
  const [error, setError] = useState('')
  async function selectParent(create: boolean) {
    setError('')
    const [selectedPath] = await oplApi.openPathDialog({ mode: 'folder' })
    if (!selectedPath) return
    try {
      const parent = await oplApi.authorizeLocalFolder(selectedPath)
      const folder = create
        ? await oplApi.createLocalFolder({
            authorizationId: parent.authorizationId,
            rootToken: parent.rootToken,
            folderName: name
          })
        : parent
      setFolder(folder)
      navigate('/catalog?tab=discover')
    } catch (value) {
      setError(value instanceof Error ? value.message : t('shell.localLibraryChooser.genericError'))
    }
  }
  return (
    <div className="space-y-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
      <h3 className="font-semibold text-white">{t('shell.localLibraryChooser.title')}</h3>
      <p className="text-sm text-muted-foreground">{t('shell.localLibraryChooser.description')}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void selectParent(false)}>
          <FolderOpen className="size-4" /> {t('shell.localLibraryChooser.selectExisting')}
        </Button>
        <Button variant="secondary" onClick={() => setCreating((value) => !value)}>
          <FolderPlus className="size-4" /> {t('shell.localLibraryChooser.createNew')}
        </Button>
      </div>
      {creating && (
        <div className="flex gap-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
          <Button onClick={() => void selectParent(true)}>
            {t('shell.localLibraryChooser.chooseAndCreate')}
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  )
}
