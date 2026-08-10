package com.oplforge.mobile.sharing.smb

import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

/**
 * NTLMv1 challenge-response (MS-NLMP), needed because a real PS2 OPL client
 * never sends a plaintext password — it always hashes the negotiated 8-byte
 * challenge into a 24-byte response. This is a Kotlin port of desktop's
 * `electron/services/network-share/smb/ntlm.ts`, which fixed the identical
 * bug there: advertising challenge/response auth (SecurityMode) while only
 * ever comparing plaintext bytes, which a real OPL response can never equal.
 */
object NtlmV1 {

    fun randomChallenge(): ByteArray = ByteArray(8).also { SecureRandom().nextBytes(it) }

    /** MD4 of [input] — the JVM has no built-in MD4 provider (unlike MD5/SHA), so it's hand-rolled here too. */
    private fun md4(input: ByteArray): ByteArray {
        val bitLength = input.size.toLong() * 8
        val paddingLength = (56 - (input.size + 1) % 64 + 64) % 64
        val padded = ByteArray(input.size + 1 + paddingLength + 8)
        input.copyInto(padded)
        padded[input.size] = 0x80.toByte()
        for (i in 0 until 8) {
            padded[padded.size - 8 + i] = ((bitLength ushr (8 * i)) and 0xFF).toByte()
        }

        var a = 0x67452301
        var b = -0x10325477 // 0xefcdab89
        var c = -0x67452302 // 0x98badcfe
        var d = 0x10325476
        val rotations1 = intArrayOf(3, 7, 11, 19)
        val rotations2 = intArrayOf(3, 5, 9, 13)
        val rotations3 = intArrayOf(3, 9, 11, 15)

        fun leftRotate(value: Int, bits: Int): Int = (value shl bits) or (value ushr (32 - bits))
        fun wordAt(offset: Int, index: Int): Int {
            val base = offset + index * 4
            return (padded[base].toInt() and 0xFF) or
                ((padded[base + 1].toInt() and 0xFF) shl 8) or
                ((padded[base + 2].toInt() and 0xFF) shl 16) or
                ((padded[base + 3].toInt() and 0xFF) shl 24)
        }

        var offset = 0
        while (offset < padded.size) {
            val words = IntArray(16) { wordAt(offset, it) }
            val initialA = a; val initialB = b; val initialC = c; val initialD = d

            for (index in 0 until 16) {
                val next = a + ((b and c) or (b.inv() and d)) + words[index]
                val newB = leftRotate(next, rotations1[index % 4])
                a = d; d = c; c = b; b = newB
            }
            for (index in 0 until 16) {
                val wordIndex = (index % 4) * 4 + index / 4
                val next = a + ((b and c) or (b and d) or (c and d)) + words[wordIndex] + 0x5a827999
                val newB = leftRotate(next, rotations2[index % 4])
                a = d; d = c; c = b; b = newB
            }
            val order = intArrayOf(0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15)
            for (index in 0 until 16) {
                val next = a + (b xor c xor d) + words[order[index]] + 0x6ed9eba1
                val newB = leftRotate(next, rotations3[index % 4])
                a = d; d = c; c = b; b = newB
            }
            a += initialA; b += initialB; c += initialC; d += initialD
            offset += 64
        }

        val result = ByteArray(16)
        listOf(a, b, c, d).forEachIndexed { index, value ->
            for (i in 0 until 4) result[index * 4 + i] = ((value ushr (8 * i)) and 0xFF).toByte()
        }
        return result
    }

    /** Expands a 7-byte block to an 8-byte DES key (parity bits left at 0 — DES-ECB encryption ignores them). */
    private fun expandDesKey(key: ByteArray): ByteArray {
        fun b(i: Int): Int = key[i].toInt() and 0xFF
        val result = ByteArray(8)
        result[0] = (b(0) and 0xfe).toByte()
        result[1] = (((b(0) shl 7) or (b(1) ushr 1)) and 0xfe).toByte()
        result[2] = (((b(1) shl 6) or (b(2) ushr 2)) and 0xfe).toByte()
        result[3] = (((b(2) shl 5) or (b(3) ushr 3)) and 0xfe).toByte()
        result[4] = (((b(3) shl 4) or (b(4) ushr 4)) and 0xfe).toByte()
        result[5] = (((b(4) shl 3) or (b(5) ushr 5)) and 0xfe).toByte()
        result[6] = (((b(5) shl 2) or (b(6) ushr 6)) and 0xfe).toByte()
        result[7] = ((b(6) shl 1) and 0xfe).toByte()
        return result
    }

    private fun desEncryptBlock(key: ByteArray, block: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("DES/ECB/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "DES"))
        return cipher.doFinal(block)
    }

    fun createResponse(password: String, challenge: ByteArray): ByteArray {
        val passwordHash = md4(password.toByteArray(Charsets.UTF_16LE))
        val paddedHash = passwordHash + ByteArray(5)
        val blocks = mutableListOf<Byte>()
        var offset = 0
        while (offset < 21) {
            val desKey = expandDesKey(paddedHash.copyOfRange(offset, offset + 7))
            blocks.addAll(desEncryptBlock(desKey, challenge).toList())
            offset += 7
        }
        return blocks.toByteArray()
    }

    fun verifyResponse(password: String, challenge: ByteArray, response: ByteArray): Boolean {
        if (response.size != 24) return false
        return MessageDigest.isEqual(createResponse(password, challenge), response)
    }
}
