import * as React from 'react'
import { cn } from '@/utils/cn'

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20',
        className
      )}
      {...props}
    />
  )
)
Select.displayName = 'Select'
