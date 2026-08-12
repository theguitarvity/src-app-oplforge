import { useEffect, useState } from 'react'
import { Wifi, WifiOff, ShieldAlert, Users, Loader2, Gamepad2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { useNetworkShareStore } from '@/stores/network-share-store'
import { NetworkShareSetupTutorial } from './NetworkShareSetupTutorial'
import type { NetworkShareProtocol } from '@/types/opl'

function protocolLabel(protocol: NetworkShareProtocol) {
  return protocol === 'smb' ? 'SMB' : 'FTP'
}

export function NetworkShareStatus() {
  const { t } = useTranslation()
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const config = useNetworkShareStore((state) => state.config)
  const status = useNetworkShareStore((state) => state.status)
  const setConfig = useNetworkShareStore((state) => state.setConfig)
  const setStatus = useNetworkShareStore((state) => state.setStatus)

  const [enabledProtocols, setEnabledProtocols] = useState<NetworkShareProtocol[]>(['smb'])
  const [shareName, setShareName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [smbPort, setSmbPort] = useState(445)
  const [ftpPort, setFtpPort] = useState(21)
  const [writeAccessChecked, setWriteAccessChecked] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tutorialProtocol, setTutorialProtocol] = useState<NetworkShareProtocol | null>(null)

  useEffect(() => {
    let unsubscribe = () => {}
    void (async () => {
      try {
        const [loadedConfig, loadedStatus] = await Promise.all([
          oplApi.getNetworkShareConfig(),
          oplApi.getNetworkShareStatus()
        ])
        setConfig(loadedConfig)
        setStatus(loadedStatus)
        setEnabledProtocols(
          loadedConfig.enabledProtocols.length ? loadedConfig.enabledProtocols : ['smb']
        )
        setShareName(loadedConfig.shareName)
        setUsername(loadedConfig.username)
        setSmbPort(loadedConfig.smbPort)
        setFtpPort(loadedConfig.ftpPort)
        unsubscribe = oplApi.onNetworkShareEvent((event) => setStatus(event.status))
      } catch {
        // Electron API unavailable (e.g. running the renderer standalone) —
        // the UI simply stays in its off/unconfigured initial state.
      }
    })()
    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isRunning = status?.smb.state === 'running' || status?.ftp.state === 'running'
  const connectedCount = status?.connectedClients.length ?? 0

  const toggleProtocol = (protocol: NetworkShareProtocol) => {
    setEnabledProtocols((current) =>
      current.includes(protocol)
        ? current.filter((item) => item !== protocol)
        : [...current, protocol]
    )
  }

  const handleStart = async () => {
    if (!activeDevice) {
      setError(t('components.networkShareStatus.errorSelectDevice'))
      return
    }
    if (!username.trim()) {
      setError(t('components.networkShareStatus.errorProvideUsername'))
      return
    }
    if (!config?.username && !password) {
      setError(t('components.networkShareStatus.errorSetPassword'))
      return
    }
    setIsBusy(true)
    setError(null)
    try {
      const savedConfig = await oplApi.saveNetworkShareConfig({
        libraryRootPath: activeDevice.path,
        enabledProtocols,
        shareName: shareName || 'OPL Forge',
        username,
        password: password || undefined,
        smbPort,
        ftpPort,
        autoStartOnLaunch: false
      })
      setConfig(savedConfig)

      if (!savedConfig.writeAccessAcknowledgedAt) {
        if (!writeAccessChecked) {
          setError(t('components.networkShareStatus.errorConfirmWriteAccess'))
          return
        }
        const acknowledged = await oplApi.acknowledgeNetworkShareWriteAccess()
        setConfig(acknowledged)
      }

      const newStatus = await oplApi.startNetworkShare()
      setStatus(newStatus)
      setPassword('')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('components.networkShareStatus.errorStartFailed')
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleStop = async () => {
    setIsBusy(true)
    setError(null)
    try {
      setStatus(await oplApi.stopNetworkShare())
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('components.networkShareStatus.errorStopFailed')
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isRunning ? (
              <Wifi className="size-6 text-emerald-400" />
            ) : (
              <WifiOff className="size-6 text-muted-foreground" />
            )}
            <div>
              <h2 className="text-xl font-semibold text-white">
                {t('components.networkShareStatus.title')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {!isRunning && t('components.networkShareStatus.off')}
                {isRunning && connectedCount === 0 && t('components.networkShareStatus.activeIdle')}
                {isRunning &&
                  connectedCount > 0 &&
                  t('components.networkShareStatus.activeConnections', {
                    count: connectedCount,
                    label:
                      connectedCount === 1
                        ? t('components.networkShareStatus.activeConnectionSingular')
                        : t('components.networkShareStatus.activeConnectionPlural')
                  })}
              </p>
            </div>
          </div>
          {isRunning ? (
            <Button variant="secondary" onClick={handleStop} disabled={isBusy}>
              {isBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t('components.networkShareStatus.turnOff')
              )}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleStart} disabled={isBusy || !activeDevice}>
              {isBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t('components.networkShareStatus.turnOn')
              )}
            </Button>
          )}
        </div>

        {!isRunning && !activeDevice && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              {t('components.networkShareStatus.noActiveDevicePrefix')}{' '}
              <strong>{t('components.networkShareStatus.devicesLabel')}</strong>{' '}
              {t('components.networkShareStatus.noActiveDeviceSuffix')}
            </span>
          </div>
        )}

        {!isRunning && activeDevice && (
          <p className="mt-4 text-sm text-muted-foreground">
            {t('components.networkShareStatus.willShare')}{' '}
            <span className="text-white">{activeDevice.name}</span> ({activeDevice.path})
          </p>
        )}

        {connectedCount > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              <Users className="size-4" />
              {status?.connectedClients.map((client) => (
                <span key={client.id}>
                  {client.remoteAddress} ({client.activity})
                </span>
              ))}
            </div>
            {status?.connectedClients
              .filter((client) => client.currentFile)
              .map((client) => (
                <div
                  key={client.id}
                  className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-white"
                >
                  <Gamepad2 className="size-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">
                    {t('components.networkShareStatus.streamingNow')}
                  </span>
                  <span className="font-medium">{client.currentFile}</span>
                </div>
              ))}
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      {!isRunning && (
        <Card>
          <h3 className="text-lg font-semibold text-white">
            {t('components.networkShareStatus.configuration')}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('components.networkShareStatus.protocols')}</Label>
              <div className="flex gap-4">
                {(['smb', 'ftp'] as const).map((protocol) => (
                  <label key={protocol} className="flex items-center gap-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={enabledProtocols.includes(protocol)}
                      onChange={() => toggleProtocol(protocol)}
                    />
                    {protocolLabel(protocol)}
                  </label>
                ))}
              </div>
              {enabledProtocols.includes('ftp') && !enabledProtocols.includes('smb') && (
                <p className="text-xs text-amber-300">
                  {t('components.networkShareStatus.ftpOnlyWarning')}
                </p>
              )}
            </div>
            {enabledProtocols.includes('smb') && (
              <div className="space-y-2">
                <Label htmlFor="network-share-smb-port">
                  {t('components.networkShareStatus.smbPort')}
                </Label>
                <Input
                  id="network-share-smb-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={smbPort}
                  onChange={(event) => setSmbPort(Number(event.target.value))}
                />
              </div>
            )}
            {enabledProtocols.includes('ftp') && (
              <div className="space-y-2">
                <Label htmlFor="network-share-ftp-port">
                  {t('components.networkShareStatus.ftpPort')}
                </Label>
                <Input
                  id="network-share-ftp-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={ftpPort}
                  onChange={(event) => setFtpPort(Number(event.target.value))}
                />
              </div>
            )}
            {(smbPort < 1024 || (enabledProtocols.includes('ftp') && ftpPort < 1024)) && (
              <p className="text-xs text-amber-300 sm:col-span-2">
                {t('components.networkShareStatus.lowPortWarning')}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="network-share-name">
                {t('components.networkShareStatus.shareName')}
              </Label>
              <Input
                id="network-share-name"
                value={shareName}
                onChange={(event) => setShareName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="network-share-username">
                {t('components.networkShareStatus.username')}
              </Label>
              <Input
                id="network-share-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="network-share-password">
                {t('components.networkShareStatus.password')}
              </Label>
              <Input
                id="network-share-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  config?.username
                    ? (t('components.networkShareStatus.keepCurrentPassword') ?? '')
                    : ''
                }
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-white sm:col-span-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={writeAccessChecked}
                onChange={(event) => setWriteAccessChecked(event.target.checked)}
              />
              <span>
                {t('components.networkShareStatus.writeAccessPrefix')}{' '}
                <strong>{t('components.networkShareStatus.writeAccessBold')}</strong>{' '}
                {t('components.networkShareStatus.writeAccessSuffix')}
              </span>
            </label>
          </div>
        </Card>
      )}

      {isRunning && (
        <Card>
          <h3 className="text-lg font-semibold text-white">
            {t('components.networkShareStatus.connectionDetails')}
          </h3>
          <div className="mt-4 space-y-3">
            {enabledProtocols.includes('smb') && status?.smb.state === 'running' && (
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-sm text-white">
                  <div className="font-medium">
                    SMB — {status.smb.boundAddresses.join(' ou ')}:{status.smb.port}
                  </div>
                  <div className="text-muted-foreground">
                    {t('components.networkShareStatus.shareLabel', { name: config?.shareName })}
                  </div>
                  {status.smb.boundAddresses.length > 1 && (
                    <div className="text-xs text-amber-300">
                      {t('components.networkShareStatus.multipleNetworksWarning')}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setTutorialProtocol('smb')}>
                  {t('components.networkShareStatus.viewTutorial')}
                </Button>
              </div>
            )}
            {enabledProtocols.includes('ftp') && status?.ftp.state === 'running' && (
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-sm text-white">
                  <div className="font-medium">
                    FTP — {status.ftp.boundAddresses.join(' ou ')}:{status.ftp.port}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setTutorialProtocol('ftp')}>
                  {t('components.networkShareStatus.viewTutorial')}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {tutorialProtocol && (
        <NetworkShareSetupTutorial
          protocol={tutorialProtocol}
          onClose={() => setTutorialProtocol(null)}
        />
      )}
    </div>
  )
}
