import { Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function SmartFillButton({
  disabled,
  onClick
}: {
  disabled?: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  return (
    <Button variant="secondary" disabled={disabled} onClick={onClick}>
      <Wand2 className="size-4" /> {t('components.smartFillButton.label')}
    </Button>
  )
}
