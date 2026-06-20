import * as React from 'react'

export function Label(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="text-sm font-medium text-white/80" {...props} />
}
