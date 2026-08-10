package com.oplforge.mobile.essentials

import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import org.junit.Assert.assertNull
import org.junit.Test

class LibretroArtIndexTest {

    @Test
    fun `returns null for an unmapped media type without any network call`() = runBlocking {
        val index = LibretroArtIndex(OkHttpClient())
        // "unknown" isn't ps2-dvd/ps2-cd/ps1, so this must short-circuit before
        // ever touching the network (offline-safe, fast unit test).
        assertNull(index.findBoxArtUrl("Shadow of the Colossus", "unknown"))
    }
}
