package com.oplforge.mobile.sharing

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.InetAddress

class LocalNetworkGuardTest {

    private fun address(text: String) = InetAddress.getByName(text)

    @Test
    fun `accepts RFC1918 private ranges`() {
        assertTrue(LocalNetworkGuard.isLanAddress(address("10.0.0.5")))
        assertTrue(LocalNetworkGuard.isLanAddress(address("172.16.0.1")))
        assertTrue(LocalNetworkGuard.isLanAddress(address("172.31.255.254")))
        assertTrue(LocalNetworkGuard.isLanAddress(address("192.168.1.42")))
    }

    @Test
    fun `accepts loopback for local integration testing`() {
        assertTrue(LocalNetworkGuard.isLanAddress(address("127.0.0.1")))
    }

    @Test
    fun `rejects public internet addresses`() {
        assertFalse(LocalNetworkGuard.isLanAddress(address("8.8.8.8")))
        assertFalse(LocalNetworkGuard.isLanAddress(address("1.1.1.1")))
    }

    @Test
    fun `rejects addresses just outside the 172-16-31 private range`() {
        assertFalse(LocalNetworkGuard.isLanAddress(address("172.15.0.1")))
        assertFalse(LocalNetworkGuard.isLanAddress(address("172.32.0.1")))
    }
}
