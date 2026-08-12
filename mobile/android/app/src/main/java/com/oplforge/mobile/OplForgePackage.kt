package com.oplforge.mobile

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.oplforge.mobile.art.ArtSyncModule
import com.oplforge.mobile.catalog.CatalogScanModule
import com.oplforge.mobile.diagnostics.DiagnosticsModule
import com.oplforge.mobile.essentials.CustomCatalogModule
import com.oplforge.mobile.essentials.EssentialsModule
import com.oplforge.mobile.library.LibrarySelectionModule
import com.oplforge.mobile.sharing.SharingSessionModule
import com.oplforge.mobile.sources.GoogleDriveModule
import com.oplforge.mobile.transfer.TransferQueueModule

/** Registers this app's own TurboModules — not autolinked, since they live in-app, not as a package. */
class OplForgePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(
            LibrarySelectionModule(reactContext),
            CatalogScanModule(reactContext),
            SharingSessionModule(reactContext),
            TransferQueueModule(reactContext),
            EssentialsModule(reactContext),
            CustomCatalogModule(reactContext),
            DiagnosticsModule(reactContext),
            ArtSyncModule(reactContext),
            GoogleDriveModule(reactContext)
        )

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
