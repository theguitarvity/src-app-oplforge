import net from 'node:net'
import { describe, expect, it } from 'vitest'
import { SmbProtocolServer } from './smb-server'
import type { ProtocolServerContext } from '../network-share.service'

function noopContext(overrides: Partial<ProtocolServerContext> = {}): ProtocolServerContext {
  return {
    libraryRootPath: '/tmp',
    address: '127.0.0.1',
    port: 0,
    username: 'tester',
    password: 'secret',
    isLocalAddress: () => true,
    onListening: () => undefined,
    onBindError: () => undefined,
    onClientConnected: () => undefined,
    onClientDisconnected: () => undefined,
    onClientActivity: () => undefined,
    onWriteConflict: () => undefined,
    ...overrides
  }
}

describe('SmbProtocolServer bind failures', () => {
  it('reproduces the real bug report: privileged port 445 fails with a human-readable message, not the raw Node error', async () => {
    const server = new SmbProtocolServer()
    let reportedError: { code: string; message: string } | undefined
    await expect(
      server.start(
        noopContext({
          port: 445,
          onBindError: (error) => {
            reportedError = error
          }
        })
      )
    ).rejects.toMatchObject({ code: 'BIND_FAILED' })

    // The exact regression: the message the user saw verbatim was the raw
    // Node error string. It must now be replaced with actionable guidance.
    expect(reportedError?.message).not.toMatch(/^listen EACCES/)
    expect(reportedError?.message).toMatch(/porta 445/i)
    expect(reportedError?.message).toMatch(/acima de 1024/i)
  })

  it('reports PORT_IN_USE with a friendly message when the port is already bound', async () => {
    const blocker = net.createServer()
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve))
    const port = (blocker.address() as net.AddressInfo).port

    try {
      const server = new SmbProtocolServer()
      let reportedError: { code: string; message: string } | undefined
      await expect(
        server.start(
          noopContext({
            port,
            onBindError: (error) => {
              reportedError = error
            }
          })
        )
      ).rejects.toMatchObject({ code: 'PORT_IN_USE' })

      expect(reportedError?.code).toBe('PORT_IN_USE')
      expect(reportedError?.message).toMatch(new RegExp(`porta ${port}`))
      expect(reportedError?.message).not.toMatch(/EADDRINUSE/)
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()))
    }
  })
})
