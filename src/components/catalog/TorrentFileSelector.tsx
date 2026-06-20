import type { TorrentFileEntry } from '@/types/opl'
import { formatBytes } from '@/utils/format'

export function TorrentFileSelector({ files, selected, onChange }: { files: TorrentFileEntry[]; selected: string[]; onChange: (files: string[]) => void }) {
  return <div className="space-y-2">{files.map((file) => <label key={file.path} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"><span><input type="checkbox" className="mr-2 accent-violet-500" checked={selected.includes(file.path)} onChange={(event) => onChange(event.target.checked ? [...selected, file.path] : selected.filter((item) => item !== file.path))} />{file.name}</span><span className="text-xs text-muted-foreground">{formatBytes(file.sizeBytes)}</span></label>)}</div>
}
