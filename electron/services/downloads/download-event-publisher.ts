import type { PipelineEvent } from '../../../src/types/opl-finalization'

export type PipelineEventDraft = Omit<PipelineEvent, 'revision' | 'sequence' | 'timestamp'>

interface OperationClock {
  revision: number
  sequence: number
  lastProgressAt?: number
  pending?: PipelineEventDraft
  timer?: ReturnType<typeof setTimeout>
}

const URL_PATTERN = /https?:\/\/[^\s]+/gi
const WINDOWS_PATH_PATTERN = /(?:[A-Za-z]:\\|\\\\)[^\s]+/g
const POSIX_PATH_PATTERN = /(?:^|\s)\/(?:[^\s/]+\/)*[^\s]*/g

function redactText(value: string): string {
  return value
    .replace(URL_PATTERN, '[REDACTED_URL]')
    .replace(WINDOWS_PATH_PATTERN, '[REDACTED_PATH]')
    .replace(POSIX_PATH_PATTERN, (match) => `${match.startsWith(' ') ? ' ' : ''}[REDACTED_PATH]`)
}

function redactDraft(draft: PipelineEventDraft): PipelineEventDraft {
  return {
    ...draft,
    message: redactText(draft.message),
    currentItem: draft.currentItem ? redactText(draft.currentItem) : undefined,
    error: draft.error
      ? {
          ...draft.error,
          message: redactText(draft.error.message),
          action: draft.error.action ? redactText(draft.error.action) : undefined
        }
      : undefined
  }
}

export class DownloadEventPublisher {
  private readonly operations = new Map<string, OperationClock>()

  constructor(
    private readonly publishEvent: (event: PipelineEvent) => void,
    private readonly now: () => Date = () => new Date(),
    private readonly progressIntervalMs = 250
  ) {}

  transition(draft: PipelineEventDraft): PipelineEvent {
    const clock = this.clock(draft.operationId)
    if (clock.timer) clearTimeout(clock.timer)
    clock.timer = undefined
    clock.pending = undefined
    return this.emit(draft, clock)
  }

  progress(draft: PipelineEventDraft): PipelineEvent | undefined {
    const clock = this.clock(draft.operationId)
    const elapsed =
      clock.lastProgressAt === undefined
        ? Number.POSITIVE_INFINITY
        : Date.now() - clock.lastProgressAt
    if (elapsed >= this.progressIntervalMs) {
      clock.lastProgressAt = Date.now()
      return this.emit(draft, clock)
    }
    clock.pending = draft
    if (!clock.timer) {
      clock.timer = setTimeout(() => {
        clock.timer = undefined
        const pending = clock.pending
        clock.pending = undefined
        if (!pending) return
        clock.lastProgressAt = Date.now()
        this.emit(pending, clock)
      }, this.progressIntervalMs - elapsed)
    }
    return undefined
  }

  stop(): void {
    for (const clock of this.operations.values()) if (clock.timer) clearTimeout(clock.timer)
    this.operations.clear()
  }

  private clock(operationId: string): OperationClock {
    const current = this.operations.get(operationId)
    if (current) return current
    const created = { revision: 0, sequence: 0 }
    this.operations.set(operationId, created)
    return created
  }

  private emit(draft: PipelineEventDraft, clock: OperationClock): PipelineEvent {
    clock.revision += 1
    clock.sequence += 1
    const event: PipelineEvent = {
      ...redactDraft(draft),
      revision: clock.revision,
      sequence: clock.sequence,
      timestamp: this.now().toISOString()
    }
    this.publishEvent(event)
    return event
  }
}
