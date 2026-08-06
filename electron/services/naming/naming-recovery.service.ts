import { access, readFile, readdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import type { NamingRenameStep } from './naming-plan.service'

export class NamingRecoveryService {
  async reconcile(devicePath: string): Promise<number> {
    const staging = path.join(devicePath, '.oplforge-staging')
    const names = await readdir(staging).catch(() => [])
    let recovered = 0
    for (const name of names.filter(
      (item) => item.startsWith('naming-') && item.endsWith('.json')
    )) {
      const journalPath = path.join(staging, name)
      try {
        const journal = JSON.parse(await readFile(journalPath, 'utf8')) as {
          state: string
          steps: NamingRenameStep[]
          completed: string[]
        }
        let ambiguous = false
        for (const step of [...journal.steps].reverse()) {
          const from = path.join(devicePath, step.fromRelativePath)
          const to = path.join(devicePath, step.toRelativePath)
          const temporary = path.join(devicePath, step.temporaryRelativePath)
          const [hasFrom, hasTo, hasTemporary] = await Promise.all(
            [from, to, temporary].map((item) =>
              access(item).then(
                () => true,
                () => false
              )
            )
          )
          if (journal.state === 'recovery-pending' && journal.completed.includes(step.itemId)) {
            if (hasTo && !hasFrom && !hasTemporary) await rename(to, from)
            else if (hasTemporary && !hasFrom && !hasTo) await rename(temporary, from)
            else if (!(hasFrom && !hasTo && !hasTemporary)) ambiguous = true
          } else {
            // A running journal can be concluded only when the filesystem proves
            // either the untouched source or the fully promoted destination.
            if (hasTemporary && !hasFrom && !hasTo) await rename(temporary, from)
            else if (!(
              (hasFrom && !hasTo && !hasTemporary) ||
              (hasTo && !hasFrom && !hasTemporary)
            ))
              ambiguous = true
          }
        }
        if (!ambiguous) {
          await rm(journalPath, { force: true })
          recovered += 1
        }
      } catch {
        /* ambiguous evidence remains for a future/manual recovery */
      }
    }
    return recovered
  }
}
