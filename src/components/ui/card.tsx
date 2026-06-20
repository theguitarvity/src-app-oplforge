import * as React from 'react'
import { cn } from '@/utils/cn'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-card/75 p-5 text-card-foreground shadow-2xl shadow-black/20 backdrop-blur-xl',
        className
      )}
      {...props}
    />
  )
}
