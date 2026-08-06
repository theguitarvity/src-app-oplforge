import type { DeviceDiagnostic } from '@/types/opl'

export function DiagnosticSummary({ diagnostic }: { diagnostic: DeviceDiagnostic }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Diagnóstico</h3>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm">{diagnostic.readiness}</span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Filesystem</dt>
          <dd>{diagnostic.device.fileSystem}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cluster</dt>
          <dd>{diagnostic.device.clusterBytes ?? 'não verificado'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Arquivos &gt; 4 GiB</dt>
          <dd>{diagnostic.device.supportsLargeFiles}</dd>
        </div>
      </dl>
      <div className="mt-3 space-y-1">
        {diagnostic.findings.map((finding, index) => (
          <p
            key={`${finding.code}-${index}`}
            className={
              finding.severity === 'error'
                ? 'text-red-300'
                : finding.severity === 'warning'
                  ? 'text-amber-300'
                  : 'text-muted-foreground'
            }
          >
            {finding.message} — {finding.state}
            {finding.remediation ? ` · ${finding.remediation}` : ''}
          </p>
        ))}
      </div>
    </div>
  )
}
