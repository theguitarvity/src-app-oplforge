package com.oplforge.mobile.shared

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WriteLockTest {

    @Test
    fun `first write to a path is not a conflict`() = runBlocking {
        val lock = WriteLock()
        val (_, wasConflict) = lock.withWriteLock("/DVD/game.iso") { "written" }
        assertFalse(wasConflict)
    }

    @Test
    fun `second write to the same path is reported as a conflict`() = runBlocking {
        val lock = WriteLock()
        lock.withWriteLock("/DVD/game.iso") { "first" }
        val (_, wasConflict) = lock.withWriteLock("/DVD/game.iso") { "second" }
        assertTrue(wasConflict)
    }

    @Test
    fun `writes to different paths never conflict with each other`() = runBlocking {
        val lock = WriteLock()
        lock.withWriteLock("/DVD/a.iso") { "a" }
        val (_, wasConflict) = lock.withWriteLock("/DVD/b.iso") { "b" }
        assertFalse(wasConflict)
    }
}
