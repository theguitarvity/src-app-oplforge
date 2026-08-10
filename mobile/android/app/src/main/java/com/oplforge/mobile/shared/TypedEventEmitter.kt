package com.oplforge.mobile.shared

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Native → RN event bridge (SharingSessionEvent/CatalogScanEvent, data-model.md).
 * Thin wrapper over RCTDeviceEventEmitter so each TurboModule doesn't repeat
 * the same emit boilerplate.
 */
class TypedEventEmitter(private val reactContext: ReactApplicationContext) {

    fun emit(eventName: String, payload: WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, payload)
    }

    companion object {
        const val CATALOG_SCAN_EVENT = "onCatalogScanEvent"
        const val SHARING_SESSION_EVENT = "onSharingSessionEvent"
        const val TRANSFER_QUEUE_EVENT = "onTransferQueueEvent"
    }
}
