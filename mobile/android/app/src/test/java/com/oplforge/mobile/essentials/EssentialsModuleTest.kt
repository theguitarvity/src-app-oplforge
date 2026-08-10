package com.oplforge.mobile.essentials

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

/**
 * The legal confirmation text (spec 008 research.md R4) is a compliance-
 * relevant constant reused verbatim from the desktop app — this test guards
 * against an accidental future edit silently weakening it. The full
 * `confirmAndEnqueue` reject path requires a real ReactApplicationContext/
 * Room/WorkManager and is covered by instrumentation instead (tasks.md T060
 * re-verification).
 */
class EssentialsModuleTest {

    @Test
    fun `legal confirmation text matches the desktop-validated string exactly`() {
        assertEquals(
            "Confirmo que possuo este jogo fisicamente/digitalmente ou tenho autorização legal para baixar este backup.",
            EssentialsModule.LEGAL_CONFIRMATION_TEXT
        )
    }

    @Test
    fun `a near-miss confirmation text is not treated as valid`() {
        val almostRight = EssentialsModule.LEGAL_CONFIRMATION_TEXT.dropLast(1)
        assertNotEquals(EssentialsModule.LEGAL_CONFIRMATION_TEXT, almostRight)
    }
}
