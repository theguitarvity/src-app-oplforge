import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <Card className="flex min-h-56 flex-col items-center justify-center text-center">
      <div className="rounded-2xl border border-white/10 bg-white/8 p-4 text-violet-200">
        <Icon className="size-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    </Card>
  )
}
