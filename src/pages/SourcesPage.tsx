import { FolderInput, Import } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import type { SourceFile } from '@/types/opl'
import { formatBytes } from '@/utils/format'
import { basename, joinPath } from '@/utils/path'

// Electron's IPC error boundary only forwards `Error.message` to the
// renderer, dropping any custom `.code` property set in the main process —
// this codebase's existing pattern (DownloadsPage's STALE_REVISION check)
// is to match on message text instead.
const isImportCollision = (error: unknown) =>
  error instanceof Error && /já existe um arquivo com esse nome/i.test(error.message)

export function SourcesPage() {
  const [folder, setFolder] = useState('')
  const [destinationDir, setDestinationDir] = useState('')
  const [pendingOverwrite, setPendingOverwrite] = useState<SourceFile | null>(null)
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const { data: files = [], refetch } = useQuery({
    queryKey: ['source-files', folder],
    queryFn: () => oplApi.listSourceFiles({ provider: 'local-folder', rootPath: folder }),
    enabled: false
  })
  const mutation = useMutation({
    mutationFn: ({ file, overwrite }: { file: SourceFile; overwrite?: boolean }) =>
      oplApi.importFromSource({
        file,
        destination: joinPath(destinationDir || activeDevice?.path || '', basename(file.path)),
        overwrite
      }),
    onError: (error, { file }) => {
      if (isImportCollision(error)) setPendingOverwrite(file)
    }
  })

  async function pickFolder() {
    const [selected] = await oplApi.openPathDialog({ mode: 'folder' })
    if (selected) setFolder(selected)
  }

  async function pickDestination() {
    const [selected] = await oplApi.openPathDialog({ mode: 'folder' })
    if (selected) setDestinationDir(selected)
  }

  if (!activeDevice)
    return (
      <EmptyState
        icon={FolderInput}
        title="Selecione um dispositivo"
        description="Escolha um dispositivo ativo para importar arquivos de fontes autorizadas."
      />
    )

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-2xl font-semibold text-white">Fontes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Arquitetura pronta para UrlProvider, GoogleDriveProvider e MegaProvider. MVP implementa
          LocalFolderProvider.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <Label>Pasta local autorizada</Label>
            <Input value={folder} onChange={(event) => setFolder(event.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" variant="secondary" onClick={pickFolder}>
              Selecionar
            </Button>
            <Button type="button" onClick={() => void refetch()} disabled={!folder}>
              Listar
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <Label>Destino</Label>
            <Input
              value={destinationDir || activeDevice.path}
              onChange={(event) => setDestinationDir(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="secondary" onClick={pickDestination}>
              Alterar destino
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-3">
        {files.map((file) => (
          <Card key={file.id} className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="font-medium text-white">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {file.extension || 'arquivo'} - {formatBytes(file.size)}
              </p>
            </div>
            <Button onClick={() => mutation.mutate({ file })} disabled={mutation.isPending}>
              <Import className="size-4" /> Importar
            </Button>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={pendingOverwrite !== null}
        onOpenChange={(open) => {
          if (!open) setPendingOverwrite(null)
        }}
        title="Substituir arquivo existente?"
        description={`Já existe um arquivo com o nome "${pendingOverwrite?.name}" no destino. Sobrescrever substitui o arquivo existente permanentemente.`}
        confirmLabel="Sobrescrever"
        onConfirm={() => {
          if (pendingOverwrite) mutation.mutate({ file: pendingOverwrite, overwrite: true })
          setPendingOverwrite(null)
        }}
      />
    </div>
  )
}
