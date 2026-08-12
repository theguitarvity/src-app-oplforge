import { Cloud, FolderInput, Import, LinkIcon, Unlink } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { joinPath } from '@/utils/path'

type SourceProviderChoice = 'local-folder' | 'google-drive'

// Electron's IPC error boundary only forwards `Error.message` to the
// renderer, dropping any custom `.code` property set in the main process —
// this codebase's existing pattern (DownloadsPage's STALE_REVISION check)
// is to match on message text instead.
const isImportCollision = (error: unknown) =>
  error instanceof Error && /já existe um arquivo com esse nome/i.test(error.message)

export function SourcesPage() {
  const [provider, setProvider] = useState<SourceProviderChoice>('local-folder')
  const [folder, setFolder] = useState('')
  const [destinationDir, setDestinationDir] = useState('')
  const [pendingOverwrite, setPendingOverwrite] = useState<SourceFile | null>(null)
  const [clientIdInput, setClientIdInput] = useState('')
  const [googleDriveError, setGoogleDriveError] = useState('')
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const queryClient = useQueryClient()

  const googleDriveStatusQuery = useQuery({
    queryKey: ['google-drive-status'],
    queryFn: () => oplApi.getGoogleDriveStatus()
  })
  const googleDriveStatus = googleDriveStatusQuery.data

  const { data: files = [], refetch } = useQuery({
    queryKey: ['source-files', provider, folder],
    queryFn: () =>
      oplApi.listSourceFiles(
        provider === 'local-folder'
          ? { provider: 'local-folder', rootPath: folder }
          : { provider: 'google-drive' }
      ),
    enabled: false
  })
  const mutation = useMutation({
    mutationFn: ({ file, overwrite }: { file: SourceFile; overwrite?: boolean }) =>
      oplApi.importFromSource({
        file,
        destination: joinPath(destinationDir || activeDevice?.path || '', file.name),
        overwrite
      }),
    onError: (error, { file }) => {
      if (isImportCollision(error)) setPendingOverwrite(file)
    }
  })
  const saveClientIdMutation = useMutation({
    mutationFn: () => oplApi.saveGoogleDriveClientId(clientIdInput),
    onSuccess: () => {
      setClientIdInput('')
      void queryClient.invalidateQueries({ queryKey: ['google-drive-status'] })
    }
  })
  const connectMutation = useMutation({
    mutationFn: () => oplApi.connectGoogleDrive(),
    onSuccess: () => {
      setGoogleDriveError('')
      void queryClient.invalidateQueries({ queryKey: ['google-drive-status'] })
    },
    onError: (error) =>
      setGoogleDriveError(error instanceof Error ? error.message : 'Falha ao conectar.')
  })
  const disconnectMutation = useMutation({
    mutationFn: () => oplApi.disconnectGoogleDrive(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['google-drive-status'] })
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
          Importe arquivos de uma pasta local autorizada ou da sua própria conta do Google Drive.
        </p>

        <div className="mt-4 flex gap-2 border-b border-white/10">
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium ${provider === 'local-folder' ? 'border-b-2 border-violet-400 text-white' : 'text-muted-foreground'}`}
            onClick={() => setProvider('local-folder')}
          >
            Pasta local
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium ${provider === 'google-drive' ? 'border-b-2 border-violet-400 text-white' : 'text-muted-foreground'}`}
            onClick={() => setProvider('google-drive')}
          >
            Google Drive
          </button>
        </div>

        {provider === 'local-folder' && (
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
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
        )}

        {provider === 'google-drive' && (
          <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
            {!googleDriveStatus?.configured && (
              <div className="space-y-2">
                <Label>Client ID do Google (OAuth, tipo "Desktop app")</Label>
                <p className="text-xs text-muted-foreground">
                  Crie um projeto no{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() =>
                      void oplApi.openExternalUrl(
                        'https://console.cloud.google.com/apis/credentials'
                      )
                    }
                  >
                    Google Cloud Console
                  </button>
                  , ative a Drive API e gere um Client ID tipo "Desktop app" — nenhum client secret
                  é necessário.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={clientIdInput}
                    onChange={(event) => setClientIdInput(event.target.value)}
                    placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                  />
                  <Button
                    type="button"
                    disabled={!clientIdInput.trim() || saveClientIdMutation.isPending}
                    onClick={() => saveClientIdMutation.mutate()}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            )}
            {googleDriveStatus?.configured && !googleDriveStatus.connected && (
              <Button
                type="button"
                disabled={connectMutation.isPending}
                onClick={() => connectMutation.mutate()}
              >
                <LinkIcon className="size-4" /> Conectar ao Google Drive
              </Button>
            )}
            {googleDriveStatus?.connected && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-emerald-300">
                  <Cloud className="size-4" /> Conectado
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={() => void refetch()}>
                    Listar arquivos
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={disconnectMutation.isPending}
                    onClick={() => disconnectMutation.mutate()}
                  >
                    <Unlink className="size-4" /> Desconectar
                  </Button>
                </div>
              </div>
            )}
            {googleDriveError && <p className="text-sm text-red-300">{googleDriveError}</p>}
          </div>
        )}

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
