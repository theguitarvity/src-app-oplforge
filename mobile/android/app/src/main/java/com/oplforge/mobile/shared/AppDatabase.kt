package com.oplforge.mobile.shared

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.oplforge.mobile.catalog.CatalogEntryDao
import com.oplforge.mobile.catalog.CatalogEntryEntity
import com.oplforge.mobile.catalog.CatalogSnapshotDao
import com.oplforge.mobile.catalog.CatalogSnapshotEntity
import com.oplforge.mobile.catalog.StructuralIssuesConverter
import com.oplforge.mobile.diagnostics.DiagnosticsReportDao
import com.oplforge.mobile.diagnostics.DiagnosticsReportEntity
import com.oplforge.mobile.essentials.CatalogListingCacheDao
import com.oplforge.mobile.essentials.CatalogListingCacheEntity
import com.oplforge.mobile.essentials.CustomCatalogEntryDao
import com.oplforge.mobile.essentials.CustomCatalogEntryEntity
import com.oplforge.mobile.transfer.TransferDao
import com.oplforge.mobile.transfer.TransferItemEntity

@Database(
    entities = [
        CatalogSnapshotEntity::class,
        CatalogEntryEntity::class,
        LocalHistoryEntity::class,
        TransferItemEntity::class,
        DiagnosticsReportEntity::class,
        CatalogListingCacheEntity::class,
        CustomCatalogEntryEntity::class
    ],
    version = 6,
    exportSchema = false
)
@TypeConverters(StructuralIssuesConverter::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun catalogSnapshotDao(): CatalogSnapshotDao
    abstract fun catalogEntryDao(): CatalogEntryDao
    abstract fun localHistoryDao(): LocalHistoryDao
    abstract fun transferDao(): TransferDao
    abstract fun diagnosticsReportDao(): DiagnosticsReportDao
    abstract fun catalogListingCacheDao(): CatalogListingCacheDao
    abstract fun customCatalogEntryDao(): CustomCatalogEntryDao

    companion object {
        @Volatile private var instance: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "oplforge.db"
                )
                    // Pre-release app, no shipped user data to preserve yet (spec 008 T006) —
                    // a real migration path is warranted once this database has real users.
                    .fallbackToDestructiveMigration(true)
                    .build().also { instance = it }
            }
        }

        /** Test-only: an isolated in-memory database, never touching production data. */
        fun createInMemory(context: Context): AppDatabase =
            Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
                .allowMainThreadQueries()
                .build()
    }
}
