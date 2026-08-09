import { useSearchParams } from 'react-router-dom'
import { FlaskConical, Moon, Settings, DatabaseZap, Wifi } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SourceSettingsPage } from '@/pages/SourceSettingsPage'
import { NetworkShareStatus } from '@/components/network/NetworkShareStatus'

function GeneralSettingsView() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-5 flex items-center gap-3">
          <Settings className="size-6 text-violet-200" />
          <div>
            <h2 className="text-2xl font-semibold text-white">Settings</h2>
            <p className="text-sm text-muted-foreground">
              Preferencias locais preparadas para persistencia em JSON e futura migracao para
              SQLite.
            </p>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Tema</Label>
            <Select defaultValue="dark">
              <option value="dark">Dark First</option>
              <option value="system">Sistema</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Diretorio padrao</Label>
            <Input placeholder="Selecione um diretorio padrao para importacoes" />
          </div>
          <div className="space-y-2">
            <Label>Nivel de logs</Label>
            <Select defaultValue="info">
              <option value="info">INFO</option>
              <option value="warning">WARNING</option>
              <option value="error">ERROR</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Atualizacoes</Label>
            <Select defaultValue="manual">
              <option value="manual">Manual</option>
              <option value="notify">Notificar quando houver update</option>
            </Select>
          </div>
        </div>
      </Card>
      <Card className="border-violet-400/20 bg-violet-500/10">
        <Moon className="size-7 text-violet-200" />
        <h3 className="mt-4 text-lg font-semibold text-white">Design dark moderno</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Interface inspirada em Rocketseat, Linear, Raycast e Arc, com glassmorphism leve,
          gradientes discretos e sidebar elegante.
        </p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <FlaskConical className="size-4 text-fuchsia-200" /> Experimental Features
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Providers remotos, SQLite e fluxo visual de formatacao estao preparados como extensoes
            futuras.
          </p>
        </div>
      </Card>
    </div>
  )
}

const tabs = [
  { id: 'general', label: 'Geral', icon: Settings },
  { id: 'sources', label: 'Fontes de Download', icon: DatabaseZap },
  { id: 'network', label: 'Rede', icon: Wifi }
] as const

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'general'

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex border-b border-white/10 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSearchParams({ tab: tab.id })}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab.id
                ? 'border-violet-500 text-white bg-white/5 font-semibold'
                : 'border-transparent text-muted-foreground hover:text-white'
            }`}
          >
            <tab.icon className="size-4 text-violet-400" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        {activeTab === 'general' && <GeneralSettingsView />}
        {activeTab === 'sources' && <SourceSettingsPage />}
        {activeTab === 'network' && <NetworkShareStatus />}
      </div>
    </div>
  )
}
