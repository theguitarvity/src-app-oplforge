package com.oplforge.mobile.sharing.smb

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

private fun hexToBytes(hex: String): ByteArray =
    ByteArray(hex.length / 2) { ((Character.digit(hex[it * 2], 16) shl 4) + Character.digit(hex[it * 2 + 1], 16)).toByte() }

private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

/**
 * Regression guard for the mobile SMB "303 / cannot log in" bug: the server
 * advertised NTLMv1 challenge/response auth but only ever compared plaintext
 * bytes, so a real PS2 OPL client (which always sends a hashed response)
 * could never authenticate. Same published MS-NLMP test vector as desktop's
 * electron/services/network-share/smb/ntlm.test.ts, so both implementations
 * are verified against the same known-correct answer.
 */
class NtlmV1Test {

    @Test
    fun `matches the published MS-NLMP Password-challenge response vector`() {
        val challenge = hexToBytes("0123456789abcdef")
        val response = NtlmV1.createResponse("Password", challenge)

        assertEquals("67c43011f30298a2ad35ece64f16331c44bdbed927841f94", response.toHex())
        assertTrue(NtlmV1.verifyResponse("Password", challenge, response))
        assertFalse(NtlmV1.verifyResponse("wrong", challenge, response))
    }

    @Test
    fun `rejects a response of the wrong length`() {
        val challenge = hexToBytes("0123456789abcdef")
        assertFalse(NtlmV1.verifyResponse("Password", challenge, ByteArray(10)))
    }
}
