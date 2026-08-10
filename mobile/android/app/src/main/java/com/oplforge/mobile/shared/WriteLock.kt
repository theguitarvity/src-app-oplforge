package com.oplforge.mobile.shared

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantLock

/**
 * Serializes writes to a single logical path across concurrent writers —
 * PS2-initiated SMB writes (spec 007 `WRITE_ANDX`) and Forge-initiated
 * transfer writes (spec 008 downloads/imports) alike, via one shared
 * instance (spec 008 research.md R6). Detects when a second writer touches a
 * path already written this session (FR-033/FR-012/FR-013 write-conflict
 * handling) — reported to the caller so it can emit a conflict event, never
 * left to silently corrupt the file.
 */
class WriteLock {
    private val locks = ConcurrentHashMap<String, ReentrantLock>()
    private val writtenPaths = ConcurrentHashMap.newKeySet<String>()

    /** Returns true if this is the first write to [path] this session (no conflict), false if it's a repeat writer. */
    suspend fun <T> withWriteLock(path: String, block: suspend () -> T): Pair<T, Boolean> {
        val lock = locks.computeIfAbsent(path) { ReentrantLock() }
        lock.lock()
        try {
            val firstWrite = writtenPaths.add(path)
            val result = block()
            return result to !firstWrite
        } finally {
            lock.unlock()
        }
    }
}
