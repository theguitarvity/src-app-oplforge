import { describe, expect, it, vi } from 'vitest'

// Regression coverage for the Windows drive-root bug: on win32, path.resolve('D:\\')
// already ends in a separator, so a naive `startsWith(root + sep)` containment
// check rejected every legitimate subpath. Force win32 path semantics here since
// this suite may run on any host OS.
vi.mock('node:path', async () => {
  const { win32 } = await vi.importActual<typeof import('node:path')>('node:path')
  return { default: win32 }
})

describe('resolveSharePath — Windows drive-root confinement', () => {
  it('accepts a subpath under a bare drive-root library (e.g. D:\\)', async () => {
    const { resolveSharePath } = await import('./wire-helpers')
    const resolved = resolveSharePath('D:\\', '\\DVD\\GAME.ISO')
    expect(resolved).toBe('D:\\DVD\\GAME.ISO')
  })

  it('accepts the share root itself', async () => {
    const { resolveSharePath } = await import('./wire-helpers')
    expect(resolveSharePath('D:\\', '')).toBe('D:\\')
    expect(resolveSharePath('D:\\', '\\')).toBe('D:\\')
  })

  it('accepts a subpath under a non-root library folder (e.g. D:\\Games)', async () => {
    const { resolveSharePath } = await import('./wire-helpers')
    const resolved = resolveSharePath('D:\\Games', '\\DVD\\GAME.ISO')
    expect(resolved).toBe('D:\\Games\\DVD\\GAME.ISO')
  })

  it('still rejects a path that escapes a non-root library folder', async () => {
    const { resolveSharePath } = await import('./wire-helpers')
    expect(() => resolveSharePath('D:\\Games', '..\\..\\Windows\\System32')).toThrow(
      /escapes the shared library root/
    )
  })

  it('a drive root has no parent to escape to (Windows path semantics, not a confinement gap)', async () => {
    const { resolveSharePath } = await import('./wire-helpers')
    expect(resolveSharePath('D:\\', '..\\..\\Windows\\System32')).toBe('D:\\Windows\\System32')
  })
})
