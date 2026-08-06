import { describe, expect, it, vi } from 'vitest'
import { DownloadEventPublisher } from '@electron/services/downloads/download-event-publisher'

describe('pipeline observability load', () => {
  it('coalesces progress independently for 100 operations while transitions remain immediate', () => {
    vi.useFakeTimers()
    const events: unknown[] = []
    const publisher = new DownloadEventPublisher((event) => events.push(event))
    for (let task = 0; task < 100; task += 1)
      for (let progress = 0; progress < 20; progress += 1)
        publisher.progress({
          operationId: `t${task}`,
          kind: 'download',
          phase: 'transferring',
          progress,
          message: 'safe'
        })
    expect(events).toHaveLength(100)
    vi.advanceTimersByTime(250)
    expect(events).toHaveLength(200)
    publisher.stop()
    vi.useRealTimers()
  })
})
