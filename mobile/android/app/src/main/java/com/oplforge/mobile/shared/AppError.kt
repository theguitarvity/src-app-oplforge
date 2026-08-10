package com.oplforge.mobile.shared

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap

/**
 * A known, plain-language failure (FR-030) — the only kind of error any
 * TurboModule in this app is allowed to reject a promise with. Never wraps a
 * raw Kotlin exception message directly: every throw site must choose one of
 * these codes deliberately, so credentials/paths/stack traces can never leak
 * into what the UI displays (contracts/native-modules.md "Shared constraints").
 */
class AppError(val code: String, message: String) : Exception(message)

object ErrorMapping {

    /** Rejects [promise] with a [SerializableError]-shaped payload, never a raw stack trace. */
    fun reject(promise: Promise, error: AppError) {
        promise.reject(error.code, error.message)
    }

    /**
     * Rejects with a generic, unexpected-failure code — used only as a last-resort catch-all.
     * [throwable] is logged locally (Logcat only, never reaches the UI/promise) so a developer
     * can diagnose it without any technical detail leaking into what the user sees (FR-030).
     */
    fun rejectUnexpected(promise: Promise, throwable: Throwable) {
        Log.e("OplForgeMobile", "Unexpected error", throwable)
        promise.reject("UNEXPECTED_ERROR", "Ocorreu um erro inesperado. Tente novamente.")
    }

    fun toWritableMap(error: AppError): WritableMap {
        val map = com.facebook.react.bridge.Arguments.createMap()
        map.putString("code", error.code)
        map.putString("message", error.message)
        return map
    }
}
