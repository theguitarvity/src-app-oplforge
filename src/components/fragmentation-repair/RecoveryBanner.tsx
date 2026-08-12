import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RecoveryItem, ResolveRecoveryInput } from '@/types/opl'
import { Button } from '@/components/ui/button'

type RecoveryWithRevision = RecoveryItem & { revision?: number }
type RecoveryAction = ResolveRecoveryInput['action']

export function RecoveryBanner({
  items,
  pending,
  error,
  onResolve
}: {
  items: RecoveryWithRevision[]
  pending?: boolean
  error?: string
  onResolve(input: ResolveRecoveryInput): void
}) {
  const { t } = useTranslation()
  const [selection, setSelection] = useState<{
    item: RecoveryWithRevision
    action: RecoveryAction
  }>()
  const [confirmation, setConfirmation] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selection) inputRef.current?.focus()
  }, [selection])
  if (items.length === 0) return null
  function choose(item: RecoveryWithRevision, action: RecoveryAction) {
    setConfirmation('')
    setSelection({ item, action })
  }
  function resolve() {
    if (!selection || selection.item.revision === undefined) return
    onResolve({
      journalId: selection.item.journalId,
      expectedRevision: selection.item.revision,
      action: selection.action,
      // Literal confirmation phrase expected by the backend — not localized (Constitution Principle I).
      confirmation: 'RECUPERAR JOGO'
    })
  }
  return (
    <section
      aria-labelledby="recovery-title"
      className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4"
    >
      <h3 id="recovery-title" className="font-semibold text-amber-100">
        {t('components.recoveryBanner.title')}
      </h3>
      <p className="mt-1 text-sm text-amber-100">{t('components.recoveryBanner.description')}</p>
      <div className="mt-3 space-y-3">
        {items.map((item) => {
          const revisionAvailable = item.revision !== undefined
          return (
            <article key={item.journalId} className="rounded-lg bg-black/20 p-3">
              <p className="font-medium text-white">
                {t('components.recoveryBanner.installationLabel', { id: item.installationId })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('components.recoveryBanner.stateJournal', {
                  state: item.state,
                  journalId: item.journalId
                })}
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {item.instructions.map((instruction) => (
                  <li key={instruction}>{instruction}</li>
                ))}
              </ul>
              {!revisionAvailable ? (
                <p className="mt-2 text-sm text-amber-200">
                  {t('components.recoveryBanner.actionBlocked')}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!revisionAvailable || pending}
                  onClick={() => choose(item, 'restore-original')}
                >
                  {t('components.recoveryBanner.restoreOriginal')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!revisionAvailable || pending}
                  onClick={() => choose(item, 'clean-verified-residue')}
                >
                  {t('components.recoveryBanner.cleanVerifiedResidue')}
                </Button>
              </div>
            </article>
          )
        })}
      </div>
      {selection ? (
        <div
          className="mt-4 rounded-lg border border-amber-300/30 bg-black/20 p-3"
          role="group"
          aria-label={t('components.recoveryBanner.confirmRecoveryAriaLabel') ?? ''}
        >
          <p className="text-sm">
            {t('components.recoveryBanner.actionLabel')}{' '}
            {selection.action === 'restore-original'
              ? t('components.recoveryBanner.actionRestoreOriginal')
              : t('components.recoveryBanner.actionCleanResidue')}
            .
          </p>
          <label className="mt-2 block text-sm text-muted-foreground">
            {t('components.recoveryBanner.typeToConfirm')}
            <input
              ref={inputRef}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-amber-300"
              autoComplete="off"
            />
          </label>
          {error ? (
            <p className="mt-2 text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelection(undefined)}
              disabled={pending}
            >
              {t('components.recoveryBanner.cancel')}
            </Button>
            <Button
              type="button"
              onClick={resolve}
              // Literal confirmation phrase expected by the backend — not localized (Constitution Principle I).
              disabled={confirmation !== 'RECUPERAR JOGO' || pending}
            >
              {t('components.recoveryBanner.authorizeRecovery')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
