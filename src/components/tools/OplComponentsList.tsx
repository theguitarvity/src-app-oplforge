import { Trophy, CheckCircle2, Download } from 'lucide-react'

interface OplComponentItem {
  id: string
  name: string
  category: string
  description: string
  version: string
  isInstalled: boolean
}

const defaultComponents: OplComponentItem[] = [
  {
    id: 'opl-latest',
    name: 'OPL Build Estável (v1.2.0)',
    category: 'Runtime',
    description: 'Executável oficial Open PS2 Loader para instalação no Memory Card / FMCB.',
    version: '1.2.0',
    isInstalled: true
  },
  {
    id: 'pcsx2-compat-db',
    name: 'Base de Dados de Compatibilidade PCSX2',
    category: 'Database',
    description: 'Tabela de hashes CRC e correções específicas para jogos PS2.',
    version: '2026.08',
    isInstalled: true
  },
  {
    id: 'popstarter-bin',
    name: 'POPStarter PS1 Runtime',
    category: 'Runtime',
    description: 'Componente necessário para execução de jogos PS1 (arquivos VCD) no OPL.',
    version: 'r13',
    isInstalled: false
  },
  {
    id: 'default-art-pack',
    name: 'Pacote de Temas & Capas Padrão',
    category: 'Assets',
    description: 'Modelos de interface e artes genéricas para jogos sem capa oficial.',
    version: '1.0.0',
    isInstalled: false
  }
]

export function OplComponentsList() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-white">Componentes & Arquivos do OPL</h3>
        <p className="text-xs text-muted-foreground">
          Gerencie arquivos essenciais, runtimes e pacotes de compatibilidade do ecossistema OPL.
        </p>
      </div>

      <div className="grid gap-3">
        {defaultComponents.map((comp) => (
          <div
            key={comp.id}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition hover:border-violet-500/30"
          >
            <div className="flex items-center gap-4">
              <div className="grid size-11 place-items-center rounded-xl bg-violet-600/20 text-violet-300 border border-violet-500/30">
                <Trophy className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">{comp.name}</h4>
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono text-violet-300">
                    {comp.category}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{comp.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {comp.isInstalled ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="size-4" /> Instalado ({comp.version})
                </span>
              ) : (
                <button className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-violet-500">
                  <Download className="size-3.5" /> Baixar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
