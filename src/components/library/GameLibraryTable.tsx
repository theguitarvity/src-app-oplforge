import { useState } from 'react'
import type { CatalogItem } from '@/types/opl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function GameLibraryTable({
  items,
  onOverride,
  onHash
}: {
  items: CatalogItem[]
  onOverride(item: CatalogItem, gameId: string): void
  onHash(item: CatalogItem): void
}) {
  const [edits, setEdits] = useState<Record<string, string>>({})
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-3">Jogo</th>
            <th>Formato</th>
            <th>Tamanho</th>
            <th>Arte</th>
            <th>Integridade</th>
            <th>Fragmentação</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.itemId} className="border-t border-white/10 align-top">
              <td className="p-3">
                <p className="font-medium text-white">{item.title ?? 'Não reconhecido'}</p>
                <p className="text-xs text-muted-foreground">
                  {item.gameId ?? 'Game ID ausente'} · {item.gameIdSource}
                </p>
                <p className="max-w-80 break-all text-xs text-muted-foreground">
                  {item.relativePath}
                </p>
                {item.findings.map((finding) => (
                  <p key={finding.code + finding.message} className="text-xs text-amber-300">
                    {finding.message}
                  </p>
                ))}
              </td>
              <td>
                {item.mediaType}
                <br />
                {item.installFormat}
              </td>
              <td>{(item.totalBytes / 1024 / 1024).toFixed(1)} MiB</td>
              <td>{item.artStatus}</td>
              <td>
                <span data-status={item.classification}>{item.classification}</span>
              </td>
              <td>{item.fragmentation}</td>
              <td className="space-y-2 p-2">
                <div className="flex min-w-64 gap-2">
                  <Input
                    value={edits[item.itemId] ?? item.gameId ?? ''}
                    onChange={(event) =>
                      setEdits({ ...edits, [item.itemId]: event.target.value.toUpperCase() })
                    }
                    placeholder="AAAA_000.00"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onOverride(item, edits[item.itemId] ?? item.gameId ?? '')}
                  >
                    Corrigir ID
                  </Button>
                </div>
                <Button type="button" variant="ghost" onClick={() => onHash(item)}>
                  Calcular hash
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
