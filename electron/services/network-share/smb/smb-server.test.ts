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

describe('SmbProtocolServer idle timeout', () => {
  it('closes a connection that goes silent, so a PS2 that vanishes from the network (no FIN) does not stay "connected" forever', async () => {
    // A real client that never sends anything after connecting reproduces a
    // PS2 that dropped off Wi-Fi mid-session without a clean TCP close.
    const probe = net.createServer()
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const port = (probe.address() as net.AddressInfo).port
    await new Promise<void>((resolve) => probe.close(() => resolve()))

    const server = new SmbProtocolServer(50)
    await server.start(noopContext({ port }))

    const client = net.createConnection({ host: '127.0.0.1', port })
    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve)
      client.once('error', reject)
    })

    const closed = new Promise<void>((resolve) => client.once('close', resolve))
    await Promise.race([
      closed,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('idle timeout did not close the connection')), 2000)
      )
    ])

    await server.stop()
  })
})
