package com.oplforge.mobile.sharing

import java.net.InetAddress

/**
 * Rejects any accepted connection whose source address falls outside RFC1918
 * private ranges (FR-015, contracts/native-modules.md "Shared constraints"),
 * same approach as desktop spec 005's R5.
 */
object LocalNetworkGuard {

    fun isLanAddress(address: InetAddress): Boolean {
        val bytes = address.address
        if (bytes.size != 4) return false // IPv4-only sharing surface, matches desktop precedent
        val a = bytes[0].toInt() and 0xFF
        val b = bytes[1].toInt() and 0xFF
        return when {
            a == 10 -> true
            a == 172 && b in 16..31 -> true
            a == 192 && b == 168 -> true
            a == 127 -> true // loopback — allowed for local integration tests
            else -> false
        }
    }
}
