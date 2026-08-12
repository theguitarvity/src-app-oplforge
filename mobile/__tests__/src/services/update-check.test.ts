import { checkForAndroidUpdate } from '../../../src/services/update-check'

describe('checkForAndroidUpdate (FR-008/FR-010/FR-016)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('reports updateAvailable when a newer mobile-tagged release exists', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { tag_name: 'mobile-v99.0.0', html_url: 'https://example.com/release', draft: false, prerelease: false }
      ]
    }) as unknown as typeof fetch

    const status = await checkForAndroidUpdate()

    expect(status.checkFailed).toBe(false)
    expect(status.updateAvailable).toBe(true)
    expect(status.latestVersion).toBe('99.0.0')
    expect(status.releaseUrl).toBe('https://example.com/release')
  })

  it('reports no update available when no mobile-tagged release exists', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ tag_name: 'v1.0.0', html_url: 'https://example.com/desktop', draft: false, prerelease: false }]
    }) as unknown as typeof fetch

    const status = await checkForAndroidUpdate()

    expect(status.checkFailed).toBe(false)
    expect(status.updateAvailable).toBe(false)
    expect(status.latestVersion).toBeNull()
  })

  it('never throws and reports checkFailed on network failure (FR-010)', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch

    const status = await checkForAndroidUpdate()

    expect(status.checkFailed).toBe(true)
    expect(status.updateAvailable).toBe(false)
  })

  it('never throws and reports checkFailed on a non-ok response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch

    const status = await checkForAndroidUpdate()

    expect(status.checkFailed).toBe(true)
  })
})
