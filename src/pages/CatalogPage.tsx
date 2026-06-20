import { Link } from 'react-router-dom'
import { BookOpen, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'

export function CatalogPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <Sparkles className="size-7 text-violet-200" />
        <h2 className="mt-4 text-2xl font-semibold text-white">Essentials Catalog</h2>
        <p className="mt-2 text-sm text-muted-foreground">Catálogo curado com scoring local, Smart Fill 500GB e fila seletiva via torrent.</p>
        <Link className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-glow hover:bg-violet-500" to="/catalog/essentials">Abrir Essentials</Link>
      </Card>
      <Card>
        <BookOpen className="size-7 text-violet-200" />
        <h2 className="mt-4 text-2xl font-semibold text-white">ART Manager</h2>
        <p className="mt-2 text-sm text-muted-foreground">Indexe e copie artes OPLM compatíveis com COV, COV2, LAB, ICO, SCR, BG e LGO.</p>
        <Link className="mt-5 inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/8 px-4 text-sm font-medium text-white hover:bg-white/12" to="/art-manager">Gerenciar artes</Link>
      </Card>
    </div>
  )
}
