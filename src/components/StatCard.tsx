import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  hint?: string
}

export function StatCard({ label, value, icon: Icon, hint }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-8 -top-8 size-24 rounded-full bg-violet-500/10 blur-2xl" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <strong className="mt-2 block text-2xl font-semibold tracking-tight text-white">{value}</strong>
          {hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/8 p-2 text-violet-200">
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  )
}
