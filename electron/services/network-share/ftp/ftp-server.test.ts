import { describe, expect, it } from 'vitest'
import { FtpProtocolServer } from './ftp-server'
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

describe('FtpProtocolServer bind failures', () => {
  it('fails on privileged port 21 with a human-readable message, not the raw Node error', async () => {
    const server = new FtpProtocolServer()
    let reportedError: { code: string; message: string } | undefined
    await expect(
      server.start(
        noopContext({
          port: 21,
          onBindError: (error) => {
            reportedError = error
          }
        })
      )
    ).rejects.toMatchObject({ code: 'BIND_FAILED' })

    expect(reportedError?.message).not.toMatch(/^listen EACCES/)
    expect(reportedError?.message).toMatch(/porta 21/i)
    expect(reportedError?.message).toMatch(/acima de 1024/i)
  })
})
