import { afterEach, describe, expect, it, vi } from 'vitest'
import { DownloadEventPublisher } from '@electron/services/downloads/download-event-publisher'
import type { PipelineEvent } from '@/types/opl-finalization'

afterEach(() => vi.useRealTimers())

describe('DownloadEventPublisher', () => {
  it('publishes transitions immediately with monotonic sequence and revision', () => {
    const events: PipelineEvent[] = []
    const publisher = new DownloadEventPublisher(
      (event) => events.push(event),
      () => new Date('2026-01-01T00:00:00Z')
    )
    publisher.transition({
      operationId: 'task-1',
      kind: 'download',
      phase: 'queued',
      message: 'Queued'
    })
    publisher.transition({
      operationId: 'task-1',
      kind: 'download',
      phase: 'probing',
      message: 'Probing'
    })
    expect(events.map(({ sequence, revision }) => ({ sequence, revision }))).toEqual([
      { sequence: 1, revision: 1 },
      { sequence: 2, revision: 2 }
    ])
  })

  it('coalesces progress to at most four events per second and emits the latest value', () => {
    vi.useFakeTimers()
    const events: PipelineEvent[] = []
    const publisher = new DownloadEventPublisher((event) => events.push(event))
    for (let progress = 1; progress <= 10; progress += 1) {
      publisher.progress({
        operationId: 'task-1',
        kind: 'download',
        phase: 'transferring',
        progress,
        message: `${progress}`
      })
    }
    expect(events).toHaveLength(1)
    vi.advanceTimersByTime(250)
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({ progress: 10, message: '10', sequence: 2, revision: 2 })
  })

  it('redacts credentials, query strings and absolute internal paths', () => {
    const events: PipelineEvent[] = []
    const publisher = new DownloadEventPublisher((event) => events.push(event))
    publisher.transition({
      operationId: 'task-1',
      kind: 'download',
      phase: 'failed',
      message:
        'Failed https://user:secret@example.test/game.iso?token=secret at /home/private/cache/game.iso',
      currentItem: 'C:\\Users\\Private\\game.iso',
      error: { code: 'NETWORK', message: 'token at /tmp/private.part', retryable: true }
    })
    const serialized = JSON.stringify(events[0])
    expect(serialized).not.toContain('secret')
    expect(serialized).not.toContain('/home/private')
    expect(serialized).not.toContain('C:\\\\Users')
    expect(serialized).toContain('[REDACTED_URL]')
    expect(serialized).toContain('[REDACTED_PATH]')
  })
})
