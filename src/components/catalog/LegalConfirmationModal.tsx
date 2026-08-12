import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { CatalogGame } from '@/types/opl'

// Literal confirmation phrase expected by the backend — not localized (Constitution Principle I).
export const LEGAL_CONFIRMATION_TEXT =
  'Confirmo que possuo este jogo fisicamente/digitalmente ou tenho autorização legal para baixar este backup.'

interface LegalConfirmationModalProps {
  open: boolean
  games: CatalogGame[]
  onOpenChange: (open: boolean) => void
  onConfirm: (text: string) => void
}

export function LegalConfirmationModal({
  open,
  games,
  onOpenChange,
  onConfirm
}: LegalConfirmationModalProps) {
  const { t } = useTranslation()
  const [checked, setChecked] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[#12111b] p-6 shadow-glow">
          <Dialog.Title className="text-xl font-semibold text-white">
            {t('components.legalConfirmationModal.title')}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {t('components.legalConfirmationModal.description')}
          </Dialog.Description>
          <div className="mt-4 max-h-40 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75">
            {games.map((game) => (
              <p key={game.id}>{game.title}</p>
            ))}
          </div>
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-violet-400/20 bg-violet-500/10 p-4 text-sm text-white/85">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-1 size-4 accent-violet-500"
            />
            {LEGAL_CONFIRMATION_TEXT}
          </label>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('components.legalConfirmationModal.cancel')}
            </Button>
            <Button disabled={!checked} onClick={() => onConfirm(LEGAL_CONFIRMATION_TEXT)}>
              {t('components.legalConfirmationModal.confirmAndQueue')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
