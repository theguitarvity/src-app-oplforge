import { describe, expect, it } from 'vitest'
import { generateCatalogItems } from '../fixtures/catalog/generate-500'

describe('500-game catalog performance', () => {
  it('filters and selects without perceptible domain latency', () => {
    const items = generateCatalogItems()
    const started = performance.now()
    const filtered = items.filter((item) =>
      `${item.title} ${item.gameId}`.toLowerCase().includes('game 49')
    )
    const selected = items.find((item) => item.itemId === 'item-499')
    const elapsed = performance.now() - started
    expect(items).toHaveLength(500)
    expect(filtered.length).toBeGreaterThan(0)
    expect(selected?.gameId).toBe('SLUS_499.00')
    expect(elapsed).toBeLessThan(100)
  })
})
