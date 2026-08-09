import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { dispatchSmbCommand, SmbSession } from './command-handlers'
import type { SmbMessage } from './frame-codec'
import { SMB_COMMAND } from './protocol-constants'

function baseHeader(
  command: number,
  overrides: Partial<SmbMessage['header']> = {}
): SmbMessage['header'] {
  return {
    command,
    status: 0,
    flags: 0,
    flags2: 0,
    pidHigh: 0,
    securityFeatures: Buffer.alloc(8),
    tid: 1,
    pidLow: 0,
    uid: 1,
    mid: 1,
    ...overrides
  }
}

/** Builds an SMB_COM_NT_CREATE_ANDX request for `relativeName`, with `nameLength`
 * counting exactly the bytes passed (mirrors how real OPL requests are observed
 * to include the NUL terminator in NameLength for some paths). */
function ntCreateRequest(relativeName: string, includeTrailingNul: boolean): SmbMessage {
  const nameBytes = Buffer.from(includeTrailingNul ? `${relativeName}\0` : relativeName, 'latin1')
  const params = Buffer.alloc(39)
  params.writeUInt16LE(nameBytes.length, 5) // NameLength
  // CreateDisposition: FILE_OVERWRITE_IF (5) — one of the "may create" values
  // (0/2/5) that in the pre-fix code fell through to the unguarded second
  // fs.stat() and is what the real OPL client hit in the field.
  params.writeUInt32LE(5, 35)
  // uid/tid 0 to match a fresh SmbSession's defaults (no SESSION_SETUP/TREE_CONNECT round-trip in this test).
  return {
    header: baseHeader(SMB_COMMAND.NT_CREATE_ANDX, { uid: 0, tid: 0 }),
    params,
    data: nameBytes
  }
}

describe('handleNtCreate — trailing NUL in NameLength (real OPL client quirk)', () => {
  let root: string
  let session: SmbSession

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'oplforge-smb-'))
    await writeFile(path.join(root, 'games.bin'), 'fake iso registry')
    session = new SmbSession(
      { username: 'tester', password: 'secret' },
      { onActivity: () => undefined, onWriteConflict: () => undefined }
    )
    session.authenticated = true
    session.treeConnected = true
    session.libraryRootPath = root
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('opens the file when NameLength excludes the NUL (well-behaved client)', async () => {
    const response = await dispatchSmbCommand(ntCreateRequest('games.bin', false), session, root)
    expect(response.header.status).toBe(0)
  })

  it('strips a trailing NUL folded into NameLength instead of crashing the connection', async () => {
    // Before the fix, this NUL byte survived into fs.stat()/fs.mkdir() and
    // threw a TypeError ("path ... without null bytes"), which propagated
    // out of dispatchSmbCommand uncaught and the caller destroyed the socket.
    const response = await dispatchSmbCommand(ntCreateRequest('games.bin', true), session, root)
    expect(response.header.status).toBe(0)
  })
})
