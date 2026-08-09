import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NetworkShareClientActivity } from '../../../src/types/opl'
import { defaultSecurityFeatures, type SmbMessage } from './smb/frame-codec'
import { dispatchSmbCommand, SmbSession } from './smb/command-handlers'
import { SMB_COMMAND } from './smb/protocol-constants'

function baseHeader(command: number) {
  return {
    command,
    status: 0,
    flags: 0x18,
    flags2: 0,
    pidHigh: 0,
    securityFeatures: defaultSecurityFeatures(),
    tid: 1,
    pidLow: 1,
    uid: 1,
    mid: 1
  }
}

function ntCreateRequest(fileName: string): SmbMessage {
  const params = Buffer.alloc(39)
  params.writeUInt16LE(fileName.length, 5) // NameLength
  params.writeUInt32LE(1, 35) // FILE_OPEN — do not create, must already exist
  return {
    header: baseHeader(SMB_COMMAND.NT_CREATE_ANDX),
    params,
    data: Buffer.from(fileName, 'latin1')
  }
}

function closeRequest(fid: number): SmbMessage {
  const params = Buffer.alloc(2)
  params.writeUInt16LE(fid, 0)
  return { header: baseHeader(SMB_COMMAND.CLOSE), params, data: Buffer.alloc(0) }
}

function readAndxRequest(fid: number, maxCount: number): SmbMessage {
  const params = Buffer.alloc(12)
  params.writeUInt16LE(fid, 2)
  params.writeUInt32LE(0, 4) // offset
  params.writeUInt16LE(maxCount, 10)
  return { header: baseHeader(SMB_COMMAND.READ_ANDX), params, data: Buffer.alloc(0) }
}

describe('SMB1 command-handler activity classification', () => {
  let libraryRoot: string
  let session: SmbSession
  let activities: NetworkShareClientActivity[]

  beforeEach(async () => {
    libraryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opl-forge-activity-'))
    await fs.writeFile(path.join(libraryRoot, 'game.iso'), Buffer.from('PS2ISO'))
    activities = []
    session = new SmbSession(
      { username: 'tester', password: 'secret' },
      {
        onActivity: (activity) => activities.push(activity),
        onWriteConflict: vi.fn()
      }
    )
    session.authenticated = true
    session.treeConnected = true
    session.libraryRootPath = libraryRoot
  })

  afterEach(async () => {
    await fs.rm(libraryRoot, { recursive: true, force: true })
  })

  it('marks NT_CREATE_ANDX as browsing, READ_ANDX as transferring, and CLOSE as idle', async () => {
    const createResponse = await dispatchSmbCommand(
      ntCreateRequest('game.iso'),
      session,
      libraryRoot
    )
    const fid = createResponse.params.readUInt16LE(5)
    expect(activities).toEqual(['browsing'])

    await dispatchSmbCommand(readAndxRequest(fid, 4), session, libraryRoot)
    expect(activities).toEqual(['browsing', 'transferring'])

    await dispatchSmbCommand(closeRequest(fid), session, libraryRoot)
    expect(activities).toEqual(['browsing', 'transferring', 'idle'])
  })

  it('checkCredentials only accepts the exact configured username/password (FR-015)', () => {
    expect(session.checkCredentials('tester', 'secret')).toBe(true)
    expect(session.checkCredentials('tester', 'wrong')).toBe(false)
    expect(session.checkCredentials('wrong', 'secret')).toBe(false)
  })
})
