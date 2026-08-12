import { useTranslation } from 'react-i18next'
import type { NamingAudit } from '../../types/opl-finalization'

export function NamingAuditTable({
  audit,
  selected,
  onToggle
}: {
  audit: NamingAudit
  selected: Set<string>
  onToggle(itemId: string): void
}) {
  const { t } = useTranslation()
  return (
    <table>
      <caption>{t('components.namingAuditTable.caption')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('components.namingAuditTable.select')}</th>
          <th scope="col">{t('components.namingAuditTable.current')}</th>
          <th scope="col">{t('components.namingAuditTable.canonical')}</th>
          <th scope="col">{t('components.namingAuditTable.classification')}</th>
        </tr>
      </thead>
      <tbody>
        {audit.items.map((item) => (
          <tr key={item.itemId}>
            <td>
              <input
                aria-label={
                  t('components.namingAuditTable.selectAriaLabel', {
                    path: item.currentRelativePath
                  }) ?? ''
                }
                type="checkbox"
                disabled={item.classification !== 'correctable'}
                checked={selected.has(item.itemId)}
                onChange={() => onToggle(item.itemId)}
              />
            </td>
            <td>{item.currentRelativePath}</td>
            <td>{item.canonicalRelativePath ?? '—'}</td>
            <td>{item.classification}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
