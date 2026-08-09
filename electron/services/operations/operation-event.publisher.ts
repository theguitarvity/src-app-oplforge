import { EventEmitter } from 'node:events'
import type { OperationSummary } from '../../../src/types/opl-finalization'

export interface UnifiedOperationEvent extends OperationSummary {
  sequence: number
  timestamp: string
}

export class OperationEventPublisher {
  private readonly events = new EventEmitter()
  private readonly summaries = new Map<string, OperationSummary>()
  private readonly sequences = new Map<string, number>()

  publish(summary: OperationSummary): UnifiedOperationEvent {
    const sequence = (this.sequences.get(summary.operationId) ?? 0) + 1
    this.sequences.set(summary.operationId, sequence)
    this.summaries.set(summary.operationId, structuredClone(summary))
    const event = { ...structuredClone(summary), sequence, timestamp: new Date().toISOString() }
    this.events.emit('event', event)
    return event
  }

  list(): OperationSummary[] {
    return [...this.summaries.values()].map((item) => structuredClone(item))
  }

  subscribe(listener: (event: UnifiedOperationEvent) => void): () => void {
    this.events.on('event', listener)
    return () => this.events.off('event', listener)
  }
}

export const operationEvents = new OperationEventPublisher()
