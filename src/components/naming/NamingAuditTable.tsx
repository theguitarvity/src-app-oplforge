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
  return (
    <table>
      <caption>Auditoria de nomes OPL</caption>
      <thead>
        <tr>
          <th scope="col">Selecionar</th>
          <th scope="col">Atual</th>
          <th scope="col">Canônico</th>
          <th scope="col">Classificação</th>
        </tr>
      </thead>
      <tbody>
        {audit.items.map((item) => (
          <tr key={item.itemId}>
            <td>
              <input
                aria-label={`Selecionar ${item.currentRelativePath}`}
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
