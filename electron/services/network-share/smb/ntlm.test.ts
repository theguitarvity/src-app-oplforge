import { describe, expect, it } from 'vitest'
import { createNtlmV1Response, verifyNtlmV1Response } from './ntlm'

describe('NTLMv1 challenge-response', () => {
  it('matches the published MS-NLMP Password/challenge response vector', () => {
    const challenge = Buffer.from('0123456789abcdef', 'hex')
    const response = createNtlmV1Response('Password', challenge)

    expect(response.toString('hex')).toBe('67c43011f30298a2ad35ece64f16331c44bdbed927841f94')
    expect(verifyNtlmV1Response('Password', challenge, response)).toBe(true)
    expect(verifyNtlmV1Response('wrong', challenge, response)).toBe(false)
  })
})
