import { Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SmartFillButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return <Button variant="secondary" disabled={disabled} onClick={onClick}><Wand2 className="size-4" /> Smart Fill 500GB</Button>
}
