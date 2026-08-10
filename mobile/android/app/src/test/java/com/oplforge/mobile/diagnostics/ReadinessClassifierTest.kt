package com.oplforge.mobile.diagnostics

import org.junit.Assert.assertEquals
import org.junit.Test

class ReadinessClassifierTest {

    @Test
    fun `ready when nothing missing, free space known, and no catalog issues`() {
        assertEquals(
            "ready",
            ReadinessClassifier.classify(emptyList(), freeBytes = 10_000L, catalogIssueCount = 0, libraryAccessValid = true)
        )
    }

    @Test
    fun `ready-with-warnings when free space unknown`() {
        assertEquals(
            "ready-with-warnings",
            ReadinessClassifier.classify(emptyList(), freeBytes = null, catalogIssueCount = 0, libraryAccessValid = true)
        )
    }

    @Test
    fun `ready-with-warnings when catalog has naming issues`() {
        assertEquals(
            "ready-with-warnings",
            ReadinessClassifier.classify(emptyList(), freeBytes = 10_000L, catalogIssueCount = 3, libraryAccessValid = true)
        )
    }

    @Test
    fun `requires-reorganization when some but not all folders are missing`() {
        assertEquals(
            "requires-reorganization",
            ReadinessClassifier.classify(listOf("ART", "CFG"), freeBytes = 10_000L, catalogIssueCount = 0, libraryAccessValid = true)
        )
    }

    @Test
    fun `incompatible when library access is invalid regardless of folders`() {
        assertEquals(
            "incompatible",
            ReadinessClassifier.classify(emptyList(), freeBytes = 10_000L, catalogIssueCount = 0, libraryAccessValid = false)
        )
    }

    @Test
    fun `incompatible when all essential media folders are missing`() {
        assertEquals(
            "incompatible",
            ReadinessClassifier.classify(listOf("DVD", "CD", "PS1", "APPS"), freeBytes = 10_000L, catalogIssueCount = 0, libraryAccessValid = true)
        )
    }
}
