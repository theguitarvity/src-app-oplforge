import type { ArtAsset } from '@/types/opl'

export function ArtPreviewGrid({ assets }: { assets: ArtAsset[] }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{assets.slice(0, 12).map((asset) => <div key={asset.url} className="rounded-xl border border-white/10 bg-black/20 p-3"><img src={asset.url} alt={asset.name} className="h-28 w-full rounded-lg object-contain" /><p className="mt-2 truncate text-xs text-muted-foreground">{asset.name}</p></div>)}</div>
}
