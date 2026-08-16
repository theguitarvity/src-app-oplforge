import os from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  },
  dialog: {
    showOpenDialog: vi.fn()
  }
}))

const { registerDialogIpc } = await import('@electron/ipc/dialog.ipc')
const { dialog } = await import('electron')

registerDialogIpc()
const openPathHandler = handlers.get('dialog:open-path')!

describe('dialog:open-path — restrictSystemRoots (opt-in)', () => {
  const createdSubfolders: string[] = []
  afterEach(async () => {
    await Promise.all(
      createdSubfolders.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
    )
  })

  it('rejects the home directory when restrictSystemRoots is true', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [os.homedir()]
    })
    await expect(
      openPathHandler(null, { mode: 'folder', restrictSystemRoots: true })
    ).rejects.toThrow(/raiz do disco|pasta pessoal/)
  })

  it('rejects the filesystem root when restrictSystemRoots is true', async () => {
    const root = path.parse(process.cwd()).root
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [root]
    })
    await expect(
      openPathHandler(null, { mode: 'folder', restrictSystemRoots: true })
    ).rejects.toThrow(/raiz do disco|pasta pessoal/)
  })

  it('allows a subfolder of the home directory when restrictSystemRoots is true', async () => {
    const subfolder = await mkdtemp(path.join(os.homedir(), '.oplforge-test-'))
    createdSubfolders.push(subfolder)
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [subfolder]
    })
    await expect(
      openPathHandler(null, { mode: 'folder', restrictSystemRoots: true })
    ).resolves.toEqual([subfolder])
  })

  it('does not restrict anything when restrictSystemRoots is not passed (existing callers unaffected)', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [os.homedir()]
    })
    await expect(openPathHandler(null, { mode: 'folder' })).resolves.toEqual([os.homedir()])
  })

  it('still returns [] on cancellation regardless of restrictSystemRoots', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: true, filePaths: [] })
    await expect(
      openPathHandler(null, { mode: 'folder', restrictSystemRoots: true })
    ).resolves.toEqual([])
  })
})

describe('dialog:open-path — withinRoot (opt-in, subfolder picker)', () => {
  const createdSubfolders: string[] = []
  afterEach(async () => {
    await Promise.all(
      createdSubfolders.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
    )
  })

  it('accepts a folder nested inside withinRoot', async () => {
    const root = await mkdtemp(path.join(os.homedir(), '.oplforge-root-'))
    createdSubfolders.push(root)
    const nested = path.join(root, 'sub')
    await import('node:fs/promises').then((fs) => fs.mkdir(nested))

    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: false, filePaths: [nested] })
    await expect(openPathHandler(null, { mode: 'folder', withinRoot: root })).resolves.toEqual([
      nested
    ])
  })

  it('rejects a folder outside withinRoot', async () => {
    const root = await mkdtemp(path.join(os.homedir(), '.oplforge-root-'))
    createdSubfolders.push(root)
    const outside = await mkdtemp(path.join(os.homedir(), '.oplforge-outside-'))
    createdSubfolders.push(outside)

    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [outside]
    })
    await expect(openPathHandler(null, { mode: 'folder', withinRoot: root })).rejects.toThrow(
      /dentro do dispositivo/
    )
  })

  it('does not restrict anything when withinRoot is not passed', async () => {
    const outside = await mkdtemp(path.join(os.homedir(), '.oplforge-outside-'))
    createdSubfolders.push(outside)
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [outside]
    })
    await expect(openPathHandler(null, { mode: 'folder' })).resolves.toEqual([outside])
  })

  it('forwards defaultPath to dialog.showOpenDialog', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: true, filePaths: [] })
    await openPathHandler(null, { mode: 'folder', defaultPath: '/some/device/path' })
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: '/some/device/path' })
    )
  })
})
