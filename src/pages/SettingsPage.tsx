import { FlaskConical, Moon, Settings } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

export function SettingsPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-5 flex items-center gap-3"><Settings className="size-6 text-violet-200" /><div><h2 className="text-2xl font-semibold text-white">Settings</h2><p className="text-sm text-muted-foreground">Preferencias locais preparadas para persistencia em JSON e futura migracao para SQLite.</p></div></div>
        <div className="grid gap-4">
          <div className="space-y-2"><Label>Tema</Label><Select defaultValue="dark"><option value="dark">Dark First</option><option value="system">Sistema</option></Select></div>
          <div className="space-y-2"><Label>Diretorio padrao</Label><Input placeholder="Selecione um diretorio padrao para importacoes" /></div>
          <div className="space-y-2"><Label>Nivel de logs</Label><Select defaultValue="info"><option value="info">INFO</option><option value="warning">WARNING</option><option value="error">ERROR</option></Select></div>
          <div className="space-y-2"><Label>Atualizacoes</Label><Select defaultValue="manual"><option value="manual">Manual</option><option value="notify">Notificar quando houver update</option></Select></div>
        </div>
      </Card>
      <Card className="border-violet-400/20 bg-violet-500/10">
        <Moon className="size-7 text-violet-200" />
        <h3 className="mt-4 text-lg font-semibold text-white">Design dark moderno</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Interface inspirada em Rocketseat, Linear, Raycast e Arc, com glassmorphism leve, gradientes discretos e sidebar elegante.</p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white"><FlaskConical className="size-4 text-fuchsia-200" /> Experimental Features</div>
          <p className="mt-2 text-sm text-muted-foreground">Providers remotos, SQLite e fluxo visual de formatacao estao preparados como extensoes futuras.</p>
        </div>
      </Card>
    </div>
  )
}
